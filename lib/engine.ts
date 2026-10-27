import type { Choice, PublicPlayer, Reaction, Role, Roof, RoofId, RoomAction, RoomView, RoundResult, Weather } from "./types";

export const TOTAL_ROUNDS = 6;
export const MAX_PLAYERS = 10;
export const PLANNING_MS = 30_000;
export const REVEAL_MS = 12_000;
export const HOST_OFFLINE_MS = 55_000;
export const ROOM_LIFETIME_MS = 12 * 60 * 60 * 1000;
export const ROOF_IDS: RoofId[] = ["noodle", "bakery", "arcade", "garden"];
export const ROLES: Role[] = ["sneak", "scoop", "lookout"];
export const REACTIONS = ["✨", "🦝", "☔", "🍜", "💛", "👏"] as const;

export class GameError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "INVALID_ACTION") {
    super(message);
    this.name = "GameError";
    this.status = status;
    this.code = code;
  }
}
export type EngineContext = { now: number; random: () => number };
export type PlayerState = {
  id: string; sessionHash: string; name: string; avatar: number;
  score: number; bot: boolean; lastSeen: number; left: boolean;
};
export type RoomState = {
  code: string; matchId: string; matchNumber: number; version: number; phase: RoomView["phase"]; round: number;
  hostId: string; players: PlayerState[]; deadline: number | null;
  phaseStartedAt: number; createdAt: number; expiresAt: number;
  roofs: Roof[]; weather: Weather; choices: Record<string, Choice>;
  autoPicked: string[]; botDue: Record<string, number>; botSerial: number;
  result: RoundResult | null; history: RoundResult[]; practice: boolean;
  reactions: Reaction[];
};
export type NewPlayer = Pick<PlayerState, "id" | "sessionHash" | "name" | "avatar">;

function pick<T>(items: readonly T[], ctx: EngineContext): T {
  return items[Math.min(items.length - 1, Math.max(0, Math.floor(ctx.random() * items.length)))];
}
export function activePlayers(room: RoomState) { return room.players.filter((p) => !p.left); }
function requireHost(room: RoomState, playerId: string) {
  if (room.hostId !== playerId) throw new GameError("Only the room host can do that.", 403, "HOST_ONLY");
}
export function requirePlayer(room: RoomState, sessionHash: string): PlayerState {
  const p = room.players.find((player) => player.sessionHash === sessionHash && !player.bot && !player.left);
  if (!p) throw new GameError("Join this room to play. Your previous seat may have been removed.", 403, "NOT_IN_ROOM");
  return p;
}
export function roofsForRound(round: number, count: number): Roof[] {
  // Stashes scale gently with attendance; capacity stays tight enough for congestion.
  const bonus = Math.max(0, count - 4) * 2;
  const shift = (round - 1) % 3;
  return [
    { id: "noodle", name: "Noodle House", subtitle: "Steamy midnight noodles", loot: 16 + bonus + shift * 2, capacity: 3, color: "#FF9B54" },
    { id: "bakery", name: "Moonrise Bakery", subtitle: "One last tray of buns", loot: 23 + bonus - shift, capacity: 2, color: "#F6D775" },
    { id: "arcade", name: "Lucky Cat Arcade", subtitle: "Crunchy prize-counter snacks", loot: 12 + bonus + shift, capacity: 4, color: "#BCA7F4" },
    { id: "garden", name: "Rooftop Garden", subtitle: "A peaceful little picnic", loot: 9 + bonus + (2 - shift), capacity: 5, color: "#8CD6B5" },
  ];
}
export function weatherForRound(round: number): Weather {
  const weather: Weather[] = [
    { id: "drizzle", title: "A little drizzle", description: "A gentle start. Every roof keeps its usual stash and noise limit.", roofId: null, lootPenalty: 0, capacityPenalty: 0 },
    { id: "bakery-bell", title: "A window left open", description: "Bakery noise limit is 1 lower. A lookout cancels the penalty and adds 2 cover.", roofId: "bakery", lootPenalty: 0, capacityPenalty: 1 },
    { id: "noodle-rain", title: "Soggy noodles", description: "Noodle House has 5 fewer snacks unless a lookout keeps the stash dry.", roofId: "noodle", lootPenalty: 5, capacityPenalty: 0 },
    { id: "arcade-static", title: "The arcade goes quiet", description: "Arcade noise limit is 2 lower. A lookout cancels the penalty and adds 2 cover.", roofId: "arcade", lootPenalty: 0, capacityPenalty: 2 },
    { id: "garden-gust", title: "Picnic in the wind", description: "Garden has 5 fewer snacks unless a lookout catches the flying napkins.", roofId: "garden", lootPenalty: 5, capacityPenalty: 0 },
    { id: "bakery-dawn", title: "The baker is waking", description: "Bakery noise limit is 1 lower. One final lookout can keep the crew covered.", roofId: "bakery", lootPenalty: 0, capacityPenalty: 1 },
  ];
  return { ...weather[Math.max(0, Math.min(5, round - 1))] };
}
export function createRoom(code: string, player: NewPlayer, practice: boolean, ctx: EngineContext): RoomState {
  const room: RoomState = {
    code, matchId: `${code}-${ctx.now}-1`, matchNumber: 1, version: 0, phase: "lobby", round: 0, hostId: player.id,
    players: [{ ...player, score: 0, bot: false, lastSeen: ctx.now, left: false }],
    deadline: null, phaseStartedAt: ctx.now, createdAt: ctx.now, expiresAt: ctx.now + ROOM_LIFETIME_MS,
    roofs: roofsForRound(1, 4), weather: weatherForRound(1), choices: {}, autoPicked: [],
    botDue: {}, botSerial: 0, result: null, history: [], practice, reactions: [],
  };
  if (practice) {
    for (let i = 0; i < 3; i++) addBot(room, ctx);
    startRound(room, 1, ctx);
  }
  return room;
}
function normalizedName(name: string) { return name.normalize("NFKC").toLocaleLowerCase("en-US"); }
export function joinRoom(room: RoomState, player: NewPlayer, ctx: EngineContext): PlayerState {
  const existing = room.players.find((p) => p.sessionHash === player.sessionHash && !p.bot && !p.left);
  if (existing) { existing.lastSeen = ctx.now; return existing; }
  if (room.phase !== "lobby") throw new GameError("This night has already started. Ask the host to rematch, or create a new room.", 409, "ALREADY_STARTED");
  if (activePlayers(room).length >= MAX_PLAYERS) throw new GameError("This rooftop crew is full (10 players).", 409, "ROOM_FULL");
  if (activePlayers(room).some((p) => normalizedName(p.name) === normalizedName(player.name))) {
    throw new GameError("Someone is already using that name. Try another nickname.", 409, "NAME_TAKEN");
  }
  // A previously removed session can rejoin an open lobby, with a new identity.
  room.players = room.players.filter((p) => !p.left);
  const added = { ...player, score: 0, bot: false, lastSeen: ctx.now, left: false };
  room.players.push(added);
  return added;
}
function addBot(room: RoomState, ctx: EngineContext) {
  if (activePlayers(room).length >= MAX_PLAYERS) throw new GameError("The crew already has 10 players.", 409, "ROOM_FULL");
  room.players = room.players.filter((p) => !p.left);
  const names = ["Puddle", "Mochi", "Crumbs", "Pebble", "Biscuit", "Dumpling", "Miso", "Waffles", "Nori", "Sprout"];
  const serial = room.botSerial++;
  let name = `${names[serial % names.length]} Bot`;
  if (activePlayers(room).some((p) => normalizedName(p.name) === normalizedName(name))) name += ` ${serial + 1}`;
  room.players.push({ id: `${room.code}-bot-${serial}`, sessionHash: "", name, avatar: serial % 8, score: 0, bot: true, lastSeen: ctx.now, left: false });
}
function startRound(room: RoomState, round: number, ctx: EngineContext) {
  room.phase = "planning";
  room.round = round;
  room.phaseStartedAt = ctx.now;
  room.deadline = ctx.now + PLANNING_MS;
  room.choices = {};
  room.autoPicked = [];
  room.result = null;
  room.reactions = [];
  room.roofs = roofsForRound(round, activePlayers(room).length);
  room.weather = weatherForRound(round);
  room.botDue = {};
  activePlayers(room).filter((p) => p.bot).forEach((p, i) => { room.botDue[p.id] = ctx.now + 2500 + i * 1700 + Math.floor(ctx.random() * 3500); });
}
export function scoreRound(room: RoomState): RoundResult {
  const weights: Record<Role, number> = { sneak: 2, scoop: 4, lookout: 2 };
  const noise: Record<Role, number> = { sneak: 1, scoop: 2, lookout: 0 };
  const roofs = room.roofs.map((roof) => {
    const crew = activePlayers(room).filter((p) => room.choices[p.id]?.roofId === roof.id);
    const cover = crew.some((p) => room.choices[p.id].role === "lookout");
    const affected = room.weather.roofId === roof.id && !cover;
    const capacity = Math.max(0, roof.capacity + (cover ? 2 : 0) - (affected ? room.weather.capacityPenalty : 0));
    const loot = Math.max(0, roof.loot - (affected ? room.weather.lootPenalty : 0));
    const totalNoise = crew.reduce((sum, p) => sum + noise[room.choices[p.id].role], 0);
    const totalWeight = crew.reduce((sum, p) => sum + weights[room.choices[p.id].role], 0);
    const collectors = crew.some((p) => room.choices[p.id].role !== "lookout");
    const busted = totalNoise > capacity;
    return {
      roofId: roof.id, noise: totalNoise, capacity, loot, busted, protected: cover,
      players: crew.map((p) => ({
        id: p.id, role: room.choices[p.id].role,
        earned: !busted && collectors ? Math.floor(loot * weights[room.choices[p.id].role] / totalWeight) : 0,
        autoPicked: room.autoPicked.includes(p.id),
      })),
      headline: !crew.length ? "Nobody stopped by" : busted ? "Too noisy! The stash stays put." : !collectors ? "All watching, nobody collecting!" : cover ? "Lookout cover. Snacks secured!" : "Quiet paws. Snacks secured!",
    };
  });
  return { round: room.round, roofs, weather: { ...room.weather } };
}
function resolveRound(room: RoomState, ctx: EngineContext) {
  const result = scoreRound(room);
  for (const roof of result.roofs) for (const payout of roof.players) {
    const player = room.players.find((p) => p.id === payout.id);
    if (player) player.score += payout.earned;
  }
  room.result = result;
  room.history.push(result);
  room.phase = "reveal";
  room.phaseStartedAt = ctx.now;
  room.deadline = ctx.now + REVEAL_MS;
}
function nextPhase(room: RoomState, ctx: EngineContext) {
  if (room.round === TOTAL_ROUNDS) {
    room.phase = "finished";
    room.phaseStartedAt = ctx.now;
    room.deadline = null;
  } else startRound(room, room.round + 1, ctx);
}
function migrateHost(room: RoomState, ctx: EngineContext) {
  const host = room.players.find((p) => p.id === room.hostId && !p.left);
  if (host && !host.bot && ctx.now - host.lastSeen <= HOST_OFFLINE_MS) return;
  const next = activePlayers(room).find((p) => !p.bot && ctx.now - p.lastSeen <= HOST_OFFLINE_MS);
  if (next) room.hostId = next.id;
}
export function tickRoom(room: RoomState, ctx: EngineContext): void {
  migrateHost(room, ctx);
  room.reactions = room.reactions.filter((r) => ctx.now - r.at < 5000);
  if (room.phase === "planning") {
    for (const bot of activePlayers(room).filter((p) => p.bot)) {
      if (!room.choices[bot.id] && ctx.now >= (room.botDue[bot.id] ?? Infinity)) {
        // Bots never inspect any player's hidden choice. This intentionally modest mix is beatable.
        room.choices[bot.id] = { roofId: pick(ROOF_IDS, ctx), role: pick(["sneak", "sneak", "scoop", "lookout"] as Role[], ctx) };
      }
    }
    if (room.deadline !== null && ctx.now >= room.deadline) {
      for (const p of activePlayers(room)) if (!room.choices[p.id]) {
        room.choices[p.id] = { roofId: pick(["arcade", "garden"] as RoofId[], ctx), role: "sneak" };
        room.autoPicked.push(p.id);
      }
    }
    const active = activePlayers(room);
    if (active.length && active.every((p) => room.choices[p.id])) resolveRound(room, ctx);
  } else if (room.phase === "reveal" && room.deadline !== null && ctx.now >= room.deadline) nextPhase(room, ctx);
}
export function applyAction(room: RoomState, playerId: string, action: RoomAction, ctx: EngineContext): void {
  const player = room.players.find((p) => p.id === playerId && !p.left && !p.bot);
  if (!player) throw new GameError("Your seat is no longer in this room.", 403, "NOT_IN_ROOM");
  // The transport ticks before applying actions. Validate phase/round again here.
  if (action.type === "choose") {
    if (room.matchId !== action.matchId) throw new GameError("That plan belongs to an earlier night. Refresh and choose for this match.", 409, "STALE_MATCH");
    if (room.round !== action.round) throw new GameError("That plan belongs to an earlier raid. Refresh and choose for this raid.", 409, "STALE_ROUND");
    const previous = room.choices[playerId];
    if (previous) {
      if (previous.role === action.role && previous.roofId === action.roofId) return;
      throw new GameError("Your plan is locked for this raid.", 409, "CHOICE_LOCKED");
    }
    if (room.phase !== "planning" || (room.deadline !== null && ctx.now >= room.deadline)) throw new GameError("Planning has ended for this raid.", 409, "PHASE_CHANGED");
    if (!ROOF_IDS.includes(action.roofId) || !ROLES.includes(action.role)) throw new GameError("Choose one of the available roofs and roles.");
    room.choices[playerId] = { roofId: action.roofId, role: action.role };
    tickRoom(room, ctx);
    return;
  }
  if (action.type === "react") {
    if (!(REACTIONS as readonly string[]).includes(action.emoji)) throw new GameError("Choose an available reaction.");
    if (room.reactions.some((r) => r.playerId === playerId && ctx.now - r.at < 1000)) throw new GameError("Give that reaction a moment to land.", 429, "SLOW_DOWN");
    room.reactions.push({ id: `${playerId}-${ctx.now}`, playerId, emoji: action.emoji, at: ctx.now });
    room.reactions = room.reactions.slice(-30);
    return;
  }
  if (action.type === "leave") {
    player.left = true;
    delete room.choices[playerId];
    migrateHost(room, ctx);
    tickRoom(room, ctx);
    return;
  }
  requireHost(room, playerId);
  if (action.type === "start") {
    if (room.phase !== "lobby") throw new GameError("The night has already started.", 409, "PHASE_CHANGED");
    if (activePlayers(room).length < 2) throw new GameError("Invite one friend or add a bot to start.", 409, "NEED_PLAYERS");
    startRound(room, 1, ctx);
  } else if (action.type === "add-bot") {
    if (room.phase !== "lobby") throw new GameError("Add bots before the night starts.", 409, "PHASE_CHANGED");
    addBot(room, ctx);
  } else if (action.type === "remove-player") {
    if (room.phase !== "lobby") throw new GameError("The crew can only change in the lobby.", 409, "PHASE_CHANGED");
    if (action.targetId === playerId) throw new GameError("Use Leave room to leave your own seat.");
    const target = room.players.find((p) => p.id === action.targetId && !p.left);
    if (!target) throw new GameError("That player has already left.", 404, "PLAYER_MISSING");
    target.left = true;
  } else if (action.type === "advance") {
    if (room.phase !== "reveal") throw new GameError("The next raid starts after the reveal.", 409, "PHASE_CHANGED");
    if (ctx.now - room.phaseStartedAt < 3000) throw new GameError("Let everyone see the reveal for a few seconds.", 409, "REVEAL_GRACE");
    nextPhase(room, ctx);
  } else if (action.type === "rematch") {
    if (room.phase !== "finished") throw new GameError("Finish this night before starting a rematch.", 409, "PHASE_CHANGED");
    room.matchNumber += 1;
    room.matchId = `${room.code}-${room.createdAt}-${room.matchNumber}`;
    room.players = activePlayers(room);
    room.players.forEach((p) => { p.score = 0; });
    room.phase = "lobby"; room.round = 0; room.deadline = null;
    room.phaseStartedAt = ctx.now; room.choices = {}; room.result = null;
    room.history = []; room.autoPicked = []; room.reactions = [];
    room.roofs = roofsForRound(1, room.players.length); room.weather = weatherForRound(1);
    if (room.practice) startRound(room, 1, ctx);
  }
}
export function projectRoom(room: RoomState, meId: string, now: number): RoomView {
  const players: PublicPlayer[] = room.players.map((p) => ({
    id: p.id, name: p.name, avatar: p.avatar, score: p.score, bot: p.bot,
    connected: !p.left && (p.bot || now - p.lastSeen <= 20_000), left: p.left,
  }));
  // Explicit allowlist projection: never spread RoomState or PlayerState into a response.
  return {
    code: room.code, matchId: room.matchId, version: room.version, phase: room.phase, round: room.round,
    totalRounds: TOTAL_ROUNDS, hostId: room.hostId, meId, players,
    deadline: room.deadline, serverTime: now, phaseStartedAt: room.phaseStartedAt,
    roofs: room.roofs, weather: room.weather, submittedIds: Object.keys(room.choices),
    myChoice: room.choices[meId] ?? null, result: room.result, history: room.history,
    practice: room.practice, reactions: room.reactions,
  };
}
