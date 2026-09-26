// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable, text, integer, index} from 'drizzle-orm/sqlite-core';
export const sessions = sqliteTable('team_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  username: text('username').notNull(),
  credentialVersion: text('credential_version').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('idx_team_sessions_expiry').on(table.expiresAt)]);
export const loginLimits = sqliteTable('team_login_limits', {
  username: text('username').primaryKey(),
  attempts: integer('attempts').notNull(),
  windowStart: integer('window_start').notNull(),
});
