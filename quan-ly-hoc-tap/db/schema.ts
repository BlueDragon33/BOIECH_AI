import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const controlMembers = sqliteTable("control_members", {
  email: text("email").primaryKey(),
  displayName: text("display_name"),
  role: text("role").notNull().default("reviewer"),
  status: text("status").notNull().default("active"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const controlDevices = sqliteTable("control_devices", {
  deviceId: text("device_id").primaryKey(),
  displayCode: text("display_code").notNull().unique(),
  publicKeyJwk: text("public_key_jwk").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"),
  label: text("label"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  approvedAt: text("approved_at"),
  blockedAt: text("blocked_at"),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("control_devices_email_idx").on(table.email),
]);

export const controlChallenges = sqliteTable("control_challenges", {
  nonce: text("nonce").primaryKey(),
  deviceId: text("device_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const controlAuditLog = sqliteTable("control_audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
