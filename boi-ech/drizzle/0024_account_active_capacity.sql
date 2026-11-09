-- #108 L1/P0: separate pending intake from occupied active account seats.
-- Additive corrective migration to already-deployed 0019; NEVER edit 0019 or backfill legacy rows.
-- Preserve 0019 device quota triggers, account identities, and historical learning/certificates.
-- Atomic D1/SQLite trigger: activating a reviewed account reserves one capacity slot.
-- Suspended accounts retain their previously assigned slot to prevent overcommit on resume.
-- Pending and legacy_hold accounts are NOT counted; first approval does not consume a slot.
CREATE TRIGGER IF NOT EXISTS account_activation_capacity
BEFORE UPDATE OF stage ON account_onboarding
WHEN NEW.stage='active' AND OLD.stage NOT IN ('active','suspended')
BEGIN
 SELECT CASE WHEN NOT EXISTS (
   SELECT 1 FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
   JOIN account_admission_limits p ON p.person_role=d.person_role
   WHERE a.account_id=NEW.account_id
 ) THEN RAISE(ABORT,'ACCOUNT_ROLE_OR_POLICY_MISSING') END;
 SELECT CASE WHEN (
   SELECT COUNT(*) FROM account_onboarding o
    JOIN accounts a ON a.account_id=o.account_id
    JOIN device_access d ON d.device_id=a.storage_device_id
    WHERE o.stage IN ('active','suspended')
      AND d.person_role=(SELECT d2.person_role FROM accounts a2
        JOIN device_access d2 ON d2.device_id=a2.storage_device_id
        WHERE a2.account_id=NEW.account_id)
 ) >= (
   SELECT p.account_limit FROM account_admission_limits p JOIN accounts a
    JOIN device_access d ON d.person_role=p.person_role AND d.device_id=a.storage_device_id
    WHERE a.account_id=NEW.account_id
 ) THEN RAISE(ABORT,'ACCOUNT_CAPACITY_REACHED') END;
END;
--> statement-breakpoint
-- A direct role reassignment cannot move an occupied seat into a full role.
-- Pending requests may change role only via the existing authorized app paths;
-- any later activation still goes through account_activation_capacity.
CREATE TRIGGER IF NOT EXISTS account_active_role_change_capacity
BEFORE UPDATE OF person_role ON device_access
WHEN NEW.person_role IS NOT OLD.person_role
 AND EXISTS(
  SELECT 1 FROM accounts a JOIN account_onboarding o ON o.account_id=a.account_id
  WHERE a.storage_device_id=NEW.device_id AND o.stage IN ('active','suspended')
 )
BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM account_admission_limits WHERE person_role=NEW.person_role
 ) THEN RAISE(ABORT,'ACCOUNT_ROLE_OR_POLICY_MISSING') END;
 SELECT CASE WHEN (
  SELECT COUNT(*) FROM accounts a JOIN account_onboarding o ON o.account_id=a.account_id
   JOIN device_access d ON d.device_id=a.storage_device_id
   WHERE o.stage IN ('active','suspended') AND d.person_role=NEW.person_role
   AND d.device_id<>NEW.device_id
 ) >= (
   SELECT account_limit FROM account_admission_limits WHERE person_role=NEW.person_role
 ) THEN RAISE(ABORT,'ACCOUNT_CAPACITY_REACHED') END;
END;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS account_onboarding_active_capacity_idx
 ON account_onboarding(stage,account_id);
--> statement-breakpoint
-- Remove legacy pre-admission blockers LAST. If migration stops early, old guards
-- remain in force and fail closed instead of temporarily permitting over-admission.
DROP TRIGGER IF EXISTS account_admission_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS account_admission_role_change;
