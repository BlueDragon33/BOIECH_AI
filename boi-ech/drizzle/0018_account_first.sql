-- Account-first P0: additive only. No request-time backfill, no deletion or alteration of legacy identities.
CREATE TABLE IF NOT EXISTS accounts (
 account_id TEXT PRIMARY KEY NOT NULL,
 storage_device_id TEXT NOT NULL UNIQUE REFERENCES device_access(device_id) ON DELETE RESTRICT,
 login TEXT UNIQUE COLLATE NOCASE,
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS account_credentials (
 account_id TEXT PRIMARY KEY REFERENCES accounts(account_id) ON DELETE RESTRICT,
 password_verifier TEXT NOT NULL,
 recovery_hash TEXT NOT NULL,
 generation INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS account_devices (
 account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
 device_id TEXT NOT NULL,
 public_key_jwk TEXT NOT NULL,
 revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(account_id,device_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS account_sessions (
 token_hash TEXT PRIMARY KEY NOT NULL,
 account_id TEXT NOT NULL,
 device_id TEXT NOT NULL,
 generation INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 idle_expires_at INTEGER NOT NULL,
 revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)),
 FOREIGN KEY(account_id,device_id) REFERENCES account_devices(account_id,device_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS account_sessions_account_idx ON account_sessions(account_id,device_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS account_manager_permissions (
 account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
 scope TEXT NOT NULL CHECK(scope IN ('manager.approve.registration','manager.manage.assigned','registrants.read.all')),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 expires_at INTEGER,
 granted_by TEXT NOT NULL,
 PRIMARY KEY(account_id,scope)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS account_auth_limits (
 bucket TEXT PRIMARY KEY NOT NULL,
 window_start INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS account_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor TEXT NOT NULL,
 action TEXT NOT NULL,
 target TEXT NOT NULL,
 purpose TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS account_audit_no_update BEFORE UPDATE ON account_audit BEGIN SELECT RAISE(ABORT,'AUDIT_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS account_audit_no_delete BEFORE DELETE ON account_audit BEGIN SELECT RAISE(ABORT,'AUDIT_IMMUTABLE'); END;
--> statement-breakpoint
-- Count one canonical assigned person once, regardless of their browser/session count.
-- Triggers serialize the final-slot decision inside the owning D1 transaction.
CREATE TRIGGER IF NOT EXISTS account_quota_guard BEFORE UPDATE OF status,access_expires_at ON device_access
WHEN NEW.status='approved'
 AND EXISTS(SELECT 1 FROM accounts WHERE storage_device_id=NEW.device_id)
 AND EXISTS(SELECT 1 FROM manager_device_assignments WHERE target_device_id=NEW.device_id)
 AND (NEW.access_expires_at IS NULL OR datetime(NEW.access_expires_at)>CURRENT_TIMESTAMP)
BEGIN
 SELECT CASE WHEN (
  SELECT COUNT(DISTINCT d.device_id) FROM manager_device_assignments m
  JOIN device_access d ON d.device_id=m.target_device_id
  WHERE d.person_role=NEW.person_role AND d.device_id<>NEW.device_id AND d.status='approved'
   AND (d.access_expires_at IS NULL OR datetime(d.access_expires_at)>CURRENT_TIMESTAMP)
 ) >= COALESCE((SELECT CASE WHEN NEW.person_role='learner' THEN learner_limit ELSE teacher_limit END
 FROM manager_approval_limits WHERE scope='manager-tier'),CASE WHEN NEW.person_role='learner' THEN 50 ELSE 5 END)
 THEN RAISE(ABORT,'ACCOUNT_QUOTA_REACHED') END;
END;
