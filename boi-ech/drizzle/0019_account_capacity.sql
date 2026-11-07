-- Account-first V2, Issue #108: additive admission and device caps.
-- This migration does not activate Account-first or alter legacy people, training, or certificate data.
CREATE TABLE IF NOT EXISTS account_admission_limits (
 person_role TEXT PRIMARY KEY NOT NULL CHECK(person_role IN ('manager','teacher','learner')),
 account_limit INTEGER NOT NULL CHECK(account_limit BETWEEN 1 AND 5000),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT OR IGNORE INTO account_admission_limits(person_role,account_limit) VALUES ('manager',5),('teacher',10),('learner',200);
--> statement-breakpoint
-- Account insert is serialized by D1/SQLite. Every account, including a legacy claim,
-- occupies one seat in the role to prevent unlimited pending-registration storage.
CREATE TRIGGER IF NOT EXISTS account_admission_insert BEFORE INSERT ON accounts
BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM device_access d JOIN account_admission_limits p ON p.person_role=d.person_role
   WHERE d.device_id=NEW.storage_device_id
 ) THEN RAISE(ABORT,'ACCOUNT_ROLE_OR_POLICY_MISSING') END;
 SELECT CASE WHEN (
  SELECT COUNT(*) FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
  WHERE d.person_role=(SELECT person_role FROM device_access WHERE device_id=NEW.storage_device_id)
 ) >= (
  SELECT p.account_limit FROM account_admission_limits p JOIN device_access d ON d.person_role=p.person_role
   WHERE d.device_id=NEW.storage_device_id
 ) THEN RAISE(ABORT,'ACCOUNT_CAPACITY_REACHED') END;
END;
--> statement-breakpoint
-- Do not let a role reassignment bypass the global admission guard.
CREATE TRIGGER IF NOT EXISTS account_admission_role_change BEFORE UPDATE OF person_role ON device_access
WHEN NEW.person_role IS NOT OLD.person_role AND EXISTS (
 SELECT 1 FROM accounts WHERE storage_device_id=NEW.device_id
)
BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM account_admission_limits WHERE person_role=NEW.person_role
 ) THEN RAISE(ABORT,'ACCOUNT_ROLE_OR_POLICY_MISSING') END;
 SELECT CASE WHEN (
  SELECT COUNT(*) FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
  WHERE d.person_role=NEW.person_role AND d.device_id<>NEW.device_id
 ) >= (
  SELECT account_limit FROM account_admission_limits WHERE person_role=NEW.person_role
 ) THEN RAISE(ABORT,'ACCOUNT_CAPACITY_REACHED') END;
END;
--> statement-breakpoint
-- A login with an existing device key must continue to work at 3/3.
-- The NOT EXISTS guard is essential: BEFORE INSERT runs before ON CONFLICT DO NOTHING.
CREATE TRIGGER IF NOT EXISTS account_device_cap_insert BEFORE INSERT ON account_devices
WHEN NEW.revoked=0 AND NOT EXISTS (
 SELECT 1 FROM account_devices d WHERE d.account_id=NEW.account_id AND d.device_id=NEW.device_id
)
BEGIN
 SELECT CASE WHEN (
  SELECT COUNT(*) FROM account_devices WHERE account_id=NEW.account_id AND revoked=0
 ) >= 3 THEN RAISE(ABORT,'ACCOUNT_DEVICE_LIMIT_REACHED') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS account_device_cap_reactivate BEFORE UPDATE OF revoked ON account_devices
WHEN OLD.revoked=1 AND NEW.revoked=0
BEGIN
 SELECT CASE WHEN (
  SELECT COUNT(*) FROM account_devices WHERE account_id=NEW.account_id AND revoked=0
 ) >= 3 THEN RAISE(ABORT,'ACCOUNT_DEVICE_LIMIT_REACHED') END;
END;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS account_devices_active_by_account ON account_devices(account_id,revoked);
