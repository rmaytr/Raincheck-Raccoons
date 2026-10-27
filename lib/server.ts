import { env } from "cloudflare:workers";
import { z } from "zod";
import {
  applyAction, createRoom, GameError, joinRoom, projectRoom, requirePlayer, tickRoom,
  type EngineContext, type NewPlayer,
} from "./engine";
import { cleanupExpired, insertRoom, rateLimit, readRoom, updateRoom } from "./store";
import type { RoomAction } from "./types";

const COOKIE = "raincheck_session";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const nickname = z.string().trim().min(1).max(18)
  .refine((value) => !/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(value), "Use a nickname without invisible characters.");
const playerInput = z.object({ name: nickname, avatar: z.number().int().min(0).max(7) }).strict();
const createInput = playerInput.extend({ practice: z.boolean().optional().default(false) }).strict();
const actionInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("choose"), roofId: z.enum(["noodle", "bakery", "arcade", "garden"]), role: z.enum(["sneak", "scoop", "lookout"]), round: z.number().int().min(1).max(6), matchId: z.string().min(1).max(80) }).strict(),
  z.object({ type: z.literal("start") }).strict(),
  z.object({ type: z.literal("advance") }).strict(),
  z.object({ type: z.literal("rematch") }).strict(),
  z.object({ type: z.literal("add-bot") }).strict(),
  z.object({ type: z.literal("leave") }).strict(),
  z.object({ type: z.literal("remove-player"), targetId: z.string().min(1).max(80) }).strict(),
  z.object({ type: z.literal("react"), emoji: z.enum(["✨", "🦝", "☔", "🍜", "💛", "👏"]) }).strict(),
]);

function db() {
  const binding = (env as unknown as { DB?: D1Database }).DB;
  if (!binding) throw new GameError("The rooftop service is warming up. Please try again soon.", 503, "SERVICE_UNAVAILABLE");
  return binding;
}
function randomToken(bytes = 32) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (value) => value.toString(16).padStart(2, "0")).join("");
}
function randomCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join("");
}
async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (part) => part.toString(16).padStart(2, "0")).join("");
}
function sessionToken(req: Request): string | null {
  const match = req.headers.get("cookie")?.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${COOKIE}=`));
  const token = match?.slice(COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
function sessionCookie(req: Request, token: string) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`;
}
function validCode(value: string) {
  const code = value.toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new GameError("Room codes have 6 letters or numbers. Check your invite.", 400, "INVALID_CODE");
  return code;
}
function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if ((origin && origin !== new URL(req.url).origin) || req.headers.get("sec-fetch-site") === "cross-site") {
    throw new GameError("Open this game directly before sending a request.", 403, "ORIGIN_REJECTED");
  }
}
async function readJson(req: Request): Promise<unknown> {
  assertSameOrigin(req);
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new GameError("Send the action as JSON.", 415, "INVALID_CONTENT_TYPE");
  }
  if (Number(req.headers.get("content-length") || 0) > 4096) throw new GameError("That request is too large.", 413, "BODY_TOO_LARGE");
  if (!req.body) throw new GameError("This request needs a small JSON body.");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 4096) { await reader.cancel(); throw new GameError("That request is too large.", 413, "BODY_TOO_LARGE"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new GameError("That request couldn't be read. Please try again.", 400, "INVALID_JSON"); }
}
function respond(body: unknown, status = 200, cookie?: string) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, private",
    "Vary": "Cookie",
    "X-Content-Type-Options": "nosniff",
  });
  if (cookie) headers.set("Set-Cookie", cookie);
  if (status === 429) headers.set("Retry-After", "60");
  return new Response(JSON.stringify(body), { status, headers });
}
async function guarded(operation: () => Promise<Response>) {
  try { return await operation(); }
  catch (error) {
    if (error instanceof z.ZodError) {
      return respond({ error: "Check your nickname, avatar, and action, then try again.", code: "INVALID_INPUT" }, 400);
    }
    if (error instanceof GameError) return respond({ error: error.message, code: error.code }, error.status);
    // Do not log room state, payloads, IP addresses, or session identities.
    console.error("Raincheck backend request failed:", error instanceof Error ? error.name : "UnknownError");
    return respond({ error: "The rooftop connection stumbled. Please try again.", code: "SERVER_ERROR" }, 500);
  }
}
function context(): EngineContext { return { now: Date.now(), random: Math.random }; }
async function ipKey(req: Request) {
  // The edge supplies CF-Connecting-IP; local development intentionally shares one bucket.
  return digest(`raincheck-rate:${req.headers.get("cf-connecting-ip") || "local"}`);
}
function opportunisticCleanup(binding: D1Database, now: number) {
  // Returning this promise keeps work attached to the request lifecycle.
  return Math.random() < 0.015 ? cleanupExpired(binding, now) : Promise.resolve();
}
export function handleCreate(req: Request) {
  return guarded(async () => {
    const input = createInput.parse(await readJson(req));
    const binding = db();
    const ctx = context();
    await rateLimit(binding, `create:${await ipKey(req)}`, 12, 10 * 60_000, ctx.now);
    const token = sessionToken(req) || randomToken();
    const player: NewPlayer = { id: randomToken(12), sessionHash: await digest(token), name: input.name, avatar: input.avatar };
    for (let attempt = 0; attempt < 8; attempt++) {
      const room = createRoom(randomCode(), player, input.practice, ctx);
      if (await insertRoom(binding, room)) {
        await opportunisticCleanup(binding, ctx.now);
        return respond(projectRoom(room, player.id, ctx.now), 201, sessionCookie(req, token));
      }
    }
    throw new GameError("The city is busy. Please create the room again.", 503, "ROOM_BUSY");
  });
}
export function handleJoin(req: Request, rawCode: string) {
  return guarded(async () => {
    const code = validCode(rawCode);
    const input = playerInput.parse(await readJson(req));
    const binding = db();
    const ctx = context();
    await rateLimit(binding, `join:${await ipKey(req)}`, 40, 10 * 60_000, ctx.now);
    const token = sessionToken(req) || randomToken();
    const player: NewPlayer = { id: randomToken(12), sessionHash: await digest(token), name: input.name, avatar: input.avatar };
    const { room, value } = await updateRoom(binding, code, ctx.now, (room) => {
      const added = joinRoom(room, player, ctx);
      tickRoom(room, ctx);
      return added.id;
    });
    return respond(projectRoom(room, value, ctx.now), 200, sessionCookie(req, token));
  });
}
export function handleGet(req: Request, rawCode: string) {
  return guarded(async () => {
    const code = validCode(rawCode);
    const token = sessionToken(req);
    if (!token) throw new GameError("Enter your nickname to join this room.", 401, "JOIN_REQUIRED");
    const hash = await digest(token);
    const binding = db();
    const ctx = context();
    // Authenticate before allocating a persistent quota key. Arbitrary cookies
    // must not create unbounded rate-limit rows. Recheck inside CAS below.
    requirePlayer(await readRoom(binding, code, ctx.now), hash);
    await rateLimit(binding, `read:${hash}:${code}`, 150, 60_000, ctx.now);
    const { room, value } = await updateRoom(binding, code, ctx.now, (room) => {
      const p = requirePlayer(room, hash);
      if (ctx.now - p.lastSeen > 6000) p.lastSeen = ctx.now;
      tickRoom(room, ctx);
      return p.id;
    });
    return respond(projectRoom(room, value, ctx.now));
  });
}
export function handleAction(req: Request, rawCode: string) {
  return guarded(async () => {
    const code = validCode(rawCode);
    const action: RoomAction = actionInput.parse(await readJson(req));
    const token = sessionToken(req);
    if (!token) throw new GameError("Join the room before choosing a plan.", 401, "JOIN_REQUIRED");
    const hash = await digest(token);
    const binding = db();
    const ctx = context();
    requirePlayer(await readRoom(binding, code, ctx.now), hash);
    await rateLimit(binding, `action:${hash}:${code}`, 90, 60_000, ctx.now);
    const { room, value } = await updateRoom(binding, code, ctx.now, (room) => {
      const p = requirePlayer(room, hash);
      p.lastSeen = ctx.now;
      tickRoom(room, ctx);
      applyAction(room, p.id, action, ctx);
      return p.id;
    });
    return respond(projectRoom(room, value, ctx.now));
  });
}
