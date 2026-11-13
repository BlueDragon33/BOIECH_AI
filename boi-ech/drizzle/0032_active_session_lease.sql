-- Explicit 7-day hard cap for rolling *active* sessions.
-- Never derive persistent authentication from a public device identifier or localStorage.
-- Historic sessions were created with an eight-hour absolute lifetime; preserve
-- their original issue time so a deployment cannot silently restart their cap.
ALTER TABLE account_sessions
  ADD COLUMN issued_at_ms INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE account_sessions
  SET issued_at_ms = MAX(0, expires_at - 28800000)
  WHERE issued_at_ms = 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS account_sessions_validity_idx
  ON account_sessions(account_id, revoked, expires_at, idle_expires_at);
