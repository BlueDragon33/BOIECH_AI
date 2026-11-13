-- Self-service account policy. Owner can change limits and default duration through
-- the existing audited CAS contracts. Never rewrite previously activated leases.
CREATE TABLE IF NOT EXISTS account_self_service_settings (
 id TEXT PRIMARY KEY CHECK(id='global'),
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT OR IGNORE INTO account_self_service_settings(id,enabled) VALUES('global',1);
--> statement-breakpoint
UPDATE account_duration_policies
 SET default_days=CASE role WHEN 'manager' THEN 3 ELSE 8 END,
     revision=revision+1,updated_at=CURRENT_TIMESTAMP
 WHERE (role='manager' AND default_days=30)
    OR (role IN ('teacher','learner') AND default_days=30);
--> statement-breakpoint
UPDATE account_admission_limits
 SET account_limit=CASE person_role WHEN 'manager' THEN 20 WHEN 'teacher' THEN 30 ELSE 200 END,
     revision=revision+1,updated_at=CURRENT_TIMESTAMP
 WHERE (person_role='manager' AND account_limit=5)
    OR (person_role='teacher' AND account_limit=10)
    OR (person_role='learner' AND account_limit=200);
--> statement-breakpoint
-- All registered canonical accounts count, not just already activated seats.
-- Existing users are never deleted if an Owner reduces a limit; only future
-- admission is blocked. SQLite D1 BEFORE INSERT is the authoritative gate.
CREATE TRIGGER IF NOT EXISTS account_registration_global_capacity
BEFORE INSERT ON accounts WHEN NEW.login IS NOT NULL
BEGIN
 SELECT CASE WHEN NOT EXISTS(
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
-- Role changes cannot evade registration quota either.
CREATE TRIGGER IF NOT EXISTS account_registration_role_capacity
BEFORE UPDATE OF person_role ON device_access
WHEN NEW.person_role IS NOT OLD.person_role
 AND EXISTS(SELECT 1 FROM accounts WHERE storage_device_id=NEW.device_id)
BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM account_admission_limits WHERE person_role=NEW.person_role
 ) THEN RAISE(ABORT,'ACCOUNT_ROLE_OR_POLICY_MISSING') END;
 SELECT CASE WHEN (
  SELECT COUNT(*) FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
   WHERE d.person_role=NEW.person_role AND d.device_id<>NEW.device_id
 ) >= (SELECT account_limit FROM account_admission_limits WHERE person_role=NEW.person_role)
 THEN RAISE(ABORT,'ACCOUNT_CAPACITY_REACHED') END;
END;
--> statement-breakpoint
-- Profile completion directly enters ACTIVE (legacy cohorts remain untouched).
DROP TRIGGER IF EXISTS account_onboarding_stage_transition;
--> statement-breakpoint
CREATE TRIGGER account_onboarding_stage_transition BEFORE UPDATE OF stage ON account_onboarding
WHEN NOT (
 (OLD.stage='requested' AND NEW.stage IN ('profile_required','active'))
 OR (OLD.stage='profile_required' AND NEW.stage IN ('profile_review','active'))
 OR (OLD.stage='changes_requested' AND NEW.stage IN ('profile_review','active'))
 OR (OLD.stage='profile_review' AND NEW.stage IN ('active','changes_requested'))
 OR (OLD.stage='active' AND NEW.stage='suspended')
 OR (OLD.stage='suspended' AND NEW.stage='active')
 OR (OLD.stage='legacy_hold' AND NEW.stage='profile_review')
)
BEGIN SELECT RAISE(ABORT,'ONBOARDING_INVALID_TRANSITION'); END;

--> statement-breakpoint
-- Sticky Owner blocklist: survives account deletion. No plaintext passwords,
-- security answers or device signing secrets are retained.
CREATE TABLE IF NOT EXISTS account_security_bans (
 kind TEXT NOT NULL CHECK(kind IN ('login','device')),
 value TEXT NOT NULL,
 actor TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(length(reason)>=10),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(kind,value)
);
--> statement-breakpoint
-- Race-proof ban enforcement in D1, not only in JavaScript.
CREATE TRIGGER IF NOT EXISTS account_registration_login_ban
BEFORE INSERT ON accounts WHEN NEW.login IS NOT NULL
 AND EXISTS(SELECT 1 FROM account_security_bans
  WHERE kind='login' AND value=lower(trim(NEW.login)))
BEGIN SELECT RAISE(ABORT,'ACCOUNT_SECURITY_BANNED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS account_known_device_ban
BEFORE INSERT ON account_devices
WHEN EXISTS(SELECT 1 FROM account_security_bans
 WHERE kind='device' AND value=NEW.device_id)
BEGIN SELECT RAISE(ABORT,'DEVICE_SECURITY_BANNED'); END;
