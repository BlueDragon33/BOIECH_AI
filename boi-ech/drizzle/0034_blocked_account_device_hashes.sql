-- Permanent Owner deny-list for exact normalized login and P-256 public keys.
-- Stores only SHA-256 digests, not login strings, keys or recovery secrets.
-- A genuinely new identity and new key cannot be linked without external identity verification.
CREATE TABLE IF NOT EXISTS account_reentry_bans (
 kind TEXT NOT NULL CHECK(kind IN ('login','device-key')),
 ban_hash TEXT NOT NULL CHECK(length(ban_hash)=64),
 blocked_by TEXT NOT NULL,
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 revoked_at TEXT,
 PRIMARY KEY(kind,ban_hash)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS account_reentry_bans_active_idx
 ON account_reentry_bans(kind,revoked_at);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS account_device_ban_insert BEFORE INSERT ON account_devices
WHEN EXISTS(SELECT 1 FROM account_reentry_bans
 WHERE kind='device-key' AND ban_hash=NEW.device_id AND revoked_at IS NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_DEVICE_BANNED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS account_device_ban_unrevoke BEFORE UPDATE OF revoked ON account_devices
WHEN NEW.revoked=0 AND EXISTS(SELECT 1 FROM account_reentry_bans
 WHERE kind='device-key' AND ban_hash=NEW.device_id AND revoked_at IS NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_DEVICE_BANNED'); END;
