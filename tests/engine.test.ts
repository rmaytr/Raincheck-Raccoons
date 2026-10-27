import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAction, createRoom, GameError, HOST_OFFLINE_MS, joinRoom, MAX_PLAYERS,
  PLANNING_MS, projectRoom, REVEAL_MS, requirePlayer, ROLES, ROOF_IDS,
  scoreRound, tickRoom, type EngineContext, type RoomState,
} from "../lib/engine.ts";
import type { Choice, Role, RoofId } from "../lib/types.ts";

const epoch = 1_800_000_000_000;
const ctx = (offset = 0, random = () => 0.3): EngineContext => ({ now: epoch + offset, random });
function roomWith(count = 4) {
  const room = createRoom("ABC234", { id: "p0", sessionHash: "hash0", name: "Raccoon 0", avatar: 0 }, false, ctx());
  for (let i = 1; i < count; i++) joinRoom(room, { id: `p${i}`, sessionHash: `hash${i}`, name: `Raccoon ${i}`, avatar: i % 8 }, ctx());
  applyAction(room, "p0", { type: "start" }, ctx());
  return room;
}
function choices(room: RoomState, roles: Role[], roof: RoofId = "garden") {
  room.choices = Object.fromEntries(roles.map((role, i) => [`p${i}`, { role, roofId: roof }]));
  return scoreRound(room).roofs.find((item) => item.roofId === roof)!;
}
function assertGameError(fn: () => unknown, code: string) {
  assert.throws(fn, (error) => error instanceof GameError && error.code === code);
}
test("noise equal to capacity succeeds, exceeding it busts everyone", () => {
  const room = roomWith(3);
  const exact = choices(room, ["sneak", "sneak", "sneak"], "noodle");
  assert.equal(exact.noise, exact.capacity);
  assert.equal(exact.busted, false);
  assert.ok(exact.players.every((p) => p.earned > 0));
  const loud = choices(room, ["scoop", "scoop", "sneak"], "noodle");
  assert.equal(loud.busted, true);
  assert.equal(loud.players.reduce((sum, p) => sum + p.earned, 0), 0);
});
test("finite loot divides in 2/4/2 weights with integer rounding", () => {
  const room = roomWith(3);
  room.roofs.find((r) => r.id === "garden")!.loot = 21;
  const result = choices(room, ["sneak", "scoop", "lookout"]);
  assert.deepEqual(result.players.map((p) => p.earned), [5, 10, 5]);
  assert.ok(result.players.reduce((sum, p) => sum + p.earned, 0) <= 21);
});
test("lookout cover applies once rather than stacking", () => {
  const room = roomWith(4);
  const result = choices(room, ["scoop", "scoop", "lookout", "lookout"], "bakery");
  assert.equal(result.capacity, 4);
  assert.equal(result.busted, false);
});
test("a crew of only lookouts earns nothing", () => {
  const room = roomWith(4);
  const result = choices(room, ["lookout", "lookout", "lookout", "lookout"]);
  assert.ok(result.players.every((p) => p.earned === 0));
  assert.match(result.headline, /nobody collecting/i);
});
test("one lookout cancels both weather penalties and adds cover", () => {
  const room = roomWith(2);
  room.weather = { id: "test", title: "Storm", description: "", roofId: "bakery", lootPenalty: 5, capacityPenalty: 1 };
  const roof = room.roofs.find((r) => r.id === "bakery")!;
  const without = choices(room, ["sneak", "sneak"], "bakery");
  assert.equal(without.capacity, roof.capacity - 1);
  assert.equal(without.loot, roof.loot - 5);
  assert.equal(without.busted, true);
  const withCover = choices(room, ["scoop", "lookout"], "bakery");
  assert.equal(withCover.capacity, roof.capacity + 2);
  assert.equal(withCover.loot, roof.loot);
  assert.equal(withCover.busted, false);
});
test("weather affects only its named roof", () => {
  const room = roomWith(2);
  room.weather = { id: "test", title: "Storm", description: "", roofId: "bakery", lootPenalty: 5, capacityPenalty: 1 };
  const result = choices(room, ["sneak", "sneak"], "garden");
  const base = room.roofs.find((r) => r.id === "garden")!;
  assert.equal(result.capacity, base.capacity);
  assert.equal(result.loot, base.loot);
});
test("stashes, weights and capacity stay finite across 400 seeded configurations", () => {
  let seed = 9001;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let attempt = 0; attempt < 400; attempt++) {
    const room = roomWith(2 + Math.floor(rand() * 9));
    for (const p of room.players) room.choices[p.id] = { roofId: ROOF_IDS[Math.floor(rand() * 4)], role: ROLES[Math.floor(rand() * 3)] };
    const result = scoreRound(room);
    for (const roof of result.roofs) {
      assert.ok(roof.players.reduce((sum, p) => sum + p.earned, 0) <= roof.loot);
      assert.ok(roof.players.every((p) => Number.isInteger(p.earned) && p.earned >= 0));
      if (roof.busted) assert.ok(roof.players.every((p) => p.earned === 0));
    }
  }
});
test("planning view excludes other choices, hashes, bot schedule and private state", () => {
  const room = roomWith(3);
  room.choices.p0 = { roofId: "bakery", role: "scoop" };
  room.choices.p1 = { roofId: "noodle", role: "sneak" };
  const view = projectRoom(room, "p2", epoch);
  assert.equal(view.myChoice, null);
  assert.equal(view.result, null);
  assert.deepEqual(view.submittedIds, ["p0", "p1"]);
  const serialized = JSON.stringify(view);
  for (const secret of ["hash0", "hash1", "sessionHash", "botDue", "\"choices\""]) assert.equal(serialized.includes(secret), false);
  assert.deepEqual(projectRoom(room, "p0", epoch).myChoice, room.choices.p0);
});
test("locking a plan is idempotent but does not allow editing", () => {
  const room = roomWith(3);
  const action = { type: "choose" as const, matchId: room.matchId, round: 1, roofId: "garden" as const, role: "sneak" as const };
  applyAction(room, "p0", action, ctx(100));
  applyAction(room, "p0", action, ctx(200));
  assert.equal(Object.keys(room.choices).length, 1);
  assertGameError(() => applyAction(room, "p0", { ...action, role: "scoop" }, ctx(300)), "CHOICE_LOCKED");
});
test("wrong-round plans are rejected and cannot affect the current raid", () => {
  const room = roomWith(2);
  assertGameError(() => applyAction(room, "p0", { type: "choose", matchId: room.matchId, round: 2, roofId: "garden", role: "sneak" }, ctx()), "STALE_ROUND");
  assert.deepEqual(room.choices, {});
});
test("a delayed round-one choice from a previous match cannot lock a rematch plan", () => {
  const room = roomWith(2);
  const delayed = { type: "choose" as const, matchId: room.matchId, round: 1, roofId: "garden" as const, role: "sneak" as const };
  const originalMatchId = room.matchId;
  room.phase = "finished";
  room.round = 6;
  applyAction(room, "p0", { type: "rematch" }, ctx(200_000));
  applyAction(room, "p0", { type: "start" }, ctx(200_000));
  assert.notEqual(room.matchId, originalMatchId);
  assert.equal(room.round, 1);
  assertGameError(() => applyAction(room, "p0", delayed, ctx(200_100)), "STALE_MATCH");
  assert.deepEqual(room.choices, {});
  applyAction(room, "p0", { ...delayed, matchId: room.matchId }, ctx(200_100));
  assert.deepEqual(room.choices.p0, { roofId: "garden", role: "sneak" });
});
test("every rematch gets a distinct match id even with an unchanged injected clock", () => {
  const room = roomWith(2);
  const ids = new Set([room.matchId]);
  for (let i = 0; i < 4; i++) {
    room.phase = "finished";
    applyAction(room, "p0", { type: "rematch" }, ctx());
    ids.add(room.matchId);
  }
  assert.equal(ids.size, 5);
  assert.equal(projectRoom(room, "p0", epoch).matchId, room.matchId);
});
test("invalid role or roof is rejected even when engine used without HTTP validation", () => {
  const room = roomWith(2);
  assertGameError(() => applyAction(room, "p0", { type: "choose", matchId: room.matchId, round: 1, roofId: "garden", role: "wizard" as Role }, ctx()), "INVALID_ACTION");
});
test("last submitted plan resolves exactly once", () => {
  const room = roomWith(2);
  applyAction(room, "p0", { type: "choose", matchId: room.matchId, round: 1, roofId: "garden", role: "sneak" }, ctx(100));
  applyAction(room, "p1", { type: "choose", matchId: room.matchId, round: 1, roofId: "garden", role: "sneak" }, ctx(200));
  assert.equal(room.phase, "reveal");
  const scores = room.players.map((p) => p.score);
  tickRoom(room, ctx(300));
  applyAction(room, "p1", { type: "choose", matchId: room.matchId, round: 1, roofId: "garden", role: "sneak" }, ctx(400));
  assert.equal(room.history.length, 1);
  assert.deepEqual(room.players.map((p) => p.score), scores);
});
test("timeout picks a disclosed conservative plan for absent players", () => {
  const room = roomWith(3);
  room.choices.p0 = { roofId: "noodle", role: "scoop" };
  tickRoom(room, ctx(PLANNING_MS));
  assert.equal(room.phase, "reveal");
  assert.deepEqual(room.autoPicked, ["p1", "p2"]);
  assert.equal(room.choices.p1.role, "sneak");
  assert.ok(["arcade", "garden"].includes(room.choices.p1.roofId));
  const payout = room.result!.roofs.flatMap((r) => r.players).find((p) => p.id === "p1")!;
  assert.equal((payout as typeof payout & { autoPicked: boolean }).autoPicked, true);
});
test("all six rounds complete with no human actions and no duplicate awards", () => {
  const room = roomWith(2);
  let time = 0;
  for (let round = 1; round <= 6; round++) {
    time += PLANNING_MS;
    tickRoom(room, ctx(time));
    assert.equal(room.phase, "reveal");
    assert.equal(room.round, round);
    time += REVEAL_MS;
    tickRoom(room, ctx(time));
  }
  assert.equal(room.phase, "finished");
  assert.equal(room.deadline, null);
  assert.equal(room.history.length, 6);
  for (const p of room.players) {
    const expected = room.history.flatMap((r) => r.roofs).flatMap((r) => r.players).filter((r) => r.id === p.id).reduce((sum, r) => sum + r.earned, 0);
    assert.equal(p.score, expected);
  }
  const snapshot = JSON.stringify(room);
  tickRoom(room, ctx(time + 1000));
  assert.equal(JSON.stringify(room), snapshot);
});
test("ties remain ties, without hidden tiebreak points", () => {
  const room = roomWith(2);
  tickRoom(room, ctx(PLANNING_MS, () => 0.99));
  assert.equal(room.players[0].score, room.players[1].score);
});
test("host can advance after grace and non-host cannot advance", () => {
  const room = roomWith(2);
  tickRoom(room, ctx(PLANNING_MS));
  assertGameError(() => applyAction(room, "p1", { type: "advance" }, ctx(PLANNING_MS + 4000)), "HOST_ONLY");
  assertGameError(() => applyAction(room, "p0", { type: "advance" }, ctx(PLANNING_MS + 2999)), "REVEAL_GRACE");
  applyAction(room, "p0", { type: "advance" }, ctx(PLANNING_MS + 3000));
  assert.equal(room.phase, "planning");
  assert.equal(room.round, 2);
});
test("joining caps room at ten and rejects duplicate normalized names", () => {
  const room = createRoom("ABC234", { id: "p0", sessionHash: "hash0", name: "Mochi", avatar: 0 }, false, ctx());
  assertGameError(() => joinRoom(room, { id: "p1", sessionHash: "hash1", name: "Ｍｏｃｈｉ", avatar: 0 }, ctx()), "NAME_TAKEN");
  for (let i = 1; i < MAX_PLAYERS; i++) joinRoom(room, { id: `p${i}`, sessionHash: `hash${i}`, name: `Guest ${i}`, avatar: 0 }, ctx());
  assertGameError(() => joinRoom(room, { id: "overflow", sessionHash: "overflow", name: "Overflow", avatar: 0 }, ctx()), "ROOM_FULL");
});
test("returning session rejoins idempotently mid-game, new session cannot", () => {
  const room = roomWith(2);
  const result = joinRoom(room, { id: "new-id", sessionHash: "hash0", name: "Different", avatar: 5 }, ctx(200));
  assert.equal(result.id, "p0");
  assert.equal(room.players.length, 2);
  assertGameError(() => joinRoom(room, { id: "p2", sessionHash: "hash2", name: "Late Guest", avatar: 0 }, ctx()), "ALREADY_STARTED");
});
test("membership checks reject forged, bot and removed identities", () => {
  const room = roomWith(2);
  assertGameError(() => requirePlayer(room, "unknown"), "NOT_IN_ROOM");
  assertGameError(() => requirePlayer(room, ""), "NOT_IN_ROOM");
  room.players[1].left = true;
  assertGameError(() => requirePlayer(room, "hash1"), "NOT_IN_ROOM");
});
test("host migrates to a recently connected human after 55 seconds offline", () => {
  const room = roomWith(3);
  room.players[1].lastSeen = epoch + HOST_OFFLINE_MS + 1;
  tickRoom(room, ctx(HOST_OFFLINE_MS + 1));
  assert.equal(room.hostId, "p1");
});
test("leaving transfers host immediately and removes a pending choice", () => {
  const room = roomWith(3);
  room.choices.p0 = { roofId: "noodle", role: "sneak" };
  applyAction(room, "p0", { type: "leave" }, ctx(1000));
  assert.equal(room.hostId, "p1");
  assert.equal(room.players[0].left, true);
  assert.equal(room.choices.p0, undefined);
});
test("practice creates three labeled bots that choose after a staggered delay", () => {
  const room = createRoom("ABC234", { id: "p0", sessionHash: "hash0", name: "Human", avatar: 0 }, true, ctx());
  assert.equal(room.phase, "planning");
  assert.equal(room.players.filter((p) => p.bot).length, 3);
  assert.ok(room.players.filter((p) => p.bot).every((p) => p.name.includes("Bot")));
  tickRoom(room, ctx(2000));
  assert.equal(Object.keys(room.choices).length, 0);
  tickRoom(room, ctx(12_000));
  assert.equal(Object.keys(room.choices).length, 3);
  assert.equal(room.choices.p0, undefined);
});
test("bot strategy is independent of hidden human choices", () => {
  const a = createRoom("ABC234", { id: "p0", sessionHash: "hash0", name: "Human", avatar: 0 }, true, ctx());
  const b = structuredClone(a);
  a.choices.p0 = { roofId: "bakery", role: "scoop" };
  b.choices.p0 = { roofId: "arcade", role: "lookout" };
  tickRoom(a, ctx(12_000));
  tickRoom(b, ctx(12_000));
  for (const p of a.players.filter((p) => p.bot)) assert.deepEqual(a.choices[p.id], b.choices[p.id]);
});
test("rematch resets score and history without changing human identities", () => {
  const room = roomWith(2);
  room.phase = "finished"; room.round = 6;
  room.players[0].score = 100;
  room.history = [scoreRound(room)];
  applyAction(room, "p0", { type: "rematch" }, ctx(200_000));
  assert.equal(room.phase, "lobby");
  assert.equal(room.round, 0);
  assert.equal(room.players[0].id, "p0");
  assert.equal(room.players[0].score, 0);
  assert.deepEqual(room.history, []);
});
test("no one role dominates: sharing rewards scoop, quiet rewards sneak, cover saves a crew", () => {
  const room = roomWith(3);
  const shared = choices(room, ["scoop", "sneak"], "garden");
  assert.ok(shared.players[0].earned > shared.players[1].earned);
  assert.equal(choices(room, ["scoop", "scoop"], "noodle").busted, true);
  assert.equal(choices(room, ["sneak", "scoop"], "noodle").busted, false);
  assert.equal(choices(room, ["scoop", "scoop", "lookout"], "bakery").busted, false);
});
