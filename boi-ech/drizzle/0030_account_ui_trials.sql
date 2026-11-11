-- V9 isolated one-time UI trial lease. Canonical identities/profiles remain untouched.
-- Only start/expiry metadata persists; ALL activity is browser-memory-only.
-- One row per account is retained as an issuance ledger (never extended or reset).
CREATE TABLE IF NOT EXISTS account_ui_trials (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('manager','teacher','learner')),
  issued_device_id TEXT NOT NULL,
  started_at_ms INTEGER NOT NULL CHECK(started_at_ms>0),
  expires_at_ms INTEGER NOT NULL CHECK(expires_at_ms=started_at_ms+28800000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS account_ui_trials_expiry_idx ON account_ui_trials(expires_at_ms);
