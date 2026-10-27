import { GameError, type RoomState } from "./engine";

type RoomRow = { code: string; version: number; state: string; expires_at: number };

export async function readRoom(db: D1Database, code: string, now: number): Promise<RoomState> {
  const row = await db.prepare("SELECT code, version, state, expires_at FROM rooms WHERE code = ?").bind(code).first<RoomRow>();
  if (!row) throw new GameError("We couldn't find that room. Check the code or create a new one.", 404, "ROOM_MISSING");
  if (row.expires_at <= now) throw new GameError("This room has expired. Create a new room for another night.", 410, "ROOM_EXPIRED");
  const room = JSON.parse(row.state) as RoomState;
  room.version = row.version;
  return room;
}

export async function insertRoom(db: D1Database, room: RoomState): Promise<boolean> {
  const result = await db.prepare("INSERT OR IGNORE INTO rooms (code, version, state, expires_at) VALUES (?, ?, ?, ?)")
    .bind(room.code, room.version, JSON.stringify(room), room.expiresAt).run();
  return result.meta.changes === 1;
}

/** Re-run the entire operation against the winning revision on every CAS conflict. */
export async function updateRoom<T>(
  db: D1Database, code: string, now: number, operation: (room: RoomState) => T,
): Promise<{ room: RoomState; value: T }> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const room = await readRoom(db, code, now);
    const oldVersion = room.version;
    const before = JSON.stringify(room);
    const value = operation(room);
    if (before === JSON.stringify(room)) return { room, value };
    room.version = oldVersion + 1;
    const result = await db.prepare("UPDATE rooms SET version = ?, state = ? WHERE code = ? AND version = ? AND expires_at > ?")
      .bind(room.version, JSON.stringify(room), code, oldVersion, now).run();
    if (result.meta.changes === 1) return { room, value };
    // Avoid synchronized retry waves when a whole lobby locks a plan at once.
    await new Promise((resolve) => setTimeout(resolve, 5 + Math.floor(Math.random() * (15 + attempt * 10))));
  }
  throw new GameError("The crew is moving quickly. Please try that again.", 409, "ROOM_BUSY");
}

export async function rateLimit(db: D1Database, key: string, limit: number, windowMs: number, now: number) {
  const result = await db.prepare(`
    INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN rate_limits.expires_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
      expires_at = CASE WHEN rate_limits.expires_at <= ? THEN ? ELSE rate_limits.expires_at END
    RETURNING count
  `).bind(key, now + windowMs, now, now, now + windowMs).first<{ count: number }>();
  if (!result || result.count > limit) throw new GameError("A few too many requests. Wait a moment and try again.", 429, "RATE_LIMITED");
}

export async function cleanupExpired(db: D1Database, now: number) {
  await db.batch([
    db.prepare("DELETE FROM rooms WHERE expires_at <= ?").bind(now),
    db.prepare("DELETE FROM rate_limits WHERE expires_at <= ?").bind(now),
  ]);
}
