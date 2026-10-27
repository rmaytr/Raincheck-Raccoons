import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(),
  version: integer("version").notNull().default(0),
  state: text("state").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("rooms_expiry_idx").on(table.expiresAt)]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("rate_limits_expiry_idx").on(table.expiresAt)]);
