-- Blueprint OS 1.3: Owner-authorized, profile-complete auto activation.
-- Owner explicitly selected these initial policies; preserve current entitlements,
-- only change defaults for future self-activations. Later Owner edits override.
UPDATE account_duration_policies SET default_days=3,revision=revision+1,
 updated_at=CURRENT_TIMESTAMP WHERE role='manager' AND default_days<>3;
--> statement-breakpoint
UPDATE account_duration_policies SET default_days=8,revision=revision+1,
 updated_at=CURRENT_TIMESTAMP WHERE role IN ('teacher','learner') AND default_days<>8;
--> statement-breakpoint
UPDATE account_admission_limits SET account_limit=20,revision=revision+1,
 updated_at=CURRENT_TIMESTAMP WHERE person_role='manager' AND account_limit<>20;
--> statement-breakpoint
UPDATE account_admission_limits SET account_limit=30,revision=revision+1,
 updated_at=CURRENT_TIMESTAMP WHERE person_role='teacher' AND account_limit<>30;
--> statement-breakpoint
UPDATE account_admission_limits SET account_limit=200,revision=revision+1,
 updated_at=CURRENT_TIMESTAMP WHERE person_role='learner' AND account_limit<>200;
--> statement-breakpoint
-- The old trigger was dropped by 0024 to separate active seats. Reintroduce
-- an *all-registered account* limit at INSERT, exactly as the Owner requests.
-- D1 serializes this BEFORE INSERT check, so two simultaneous signups cannot
-- both take the last slot. No legacy NULL-login records are deleted.
CREATE TRIGGER IF NOT EXISTS account_registration_limit_v3 BEFORE INSERT ON accounts
 WHEN NEW.login IS NOT NULL
BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM device_access d JOIN account_admission_limits p ON p.person_role=d.person_role
  WHERE d.device_id=NEW.storage_device_id)
 THEN RAISE(ABORT,'ACCOUNT_ROLE_OR_POLICY_MISSING') END;
 SELECT CASE WHEN(
  SELECT COUNT(*) FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
  WHERE a.login IS NOT NULL AND d.person_role=(
   SELECT person_role FROM device_access WHERE device_id=NEW.storage_device_id)
 ) >= (SELECT p.account_limit FROM account_admission_limits p JOIN device_access d
  ON d.person_role=p.person_role WHERE d.device_id=NEW.storage_device_id)
 THEN RAISE(ABORT,'ACCOUNT_CAPACITY_REACHED') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS account_registration_role_change_v3
 BEFORE UPDATE OF person_role ON device_access
 WHEN NEW.person_role IS NOT OLD.person_role
 AND EXISTS(SELECT 1 FROM accounts a WHERE a.storage_device_id=NEW.device_id AND a.login IS NOT NULL)
BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM account_admission_limits WHERE person_role=NEW.person_role)
 THEN RAISE(ABORT,'ACCOUNT_ROLE_OR_POLICY_MISSING') END;
 SELECT CASE WHEN(
  SELECT COUNT(*) FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
  WHERE a.login IS NOT NULL AND d.person_role=NEW.person_role AND d.device_id<>NEW.device_id
 ) >= (SELECT account_limit FROM account_admission_limits WHERE person_role=NEW.person_role)
 THEN RAISE(ABORT,'ACCOUNT_CAPACITY_REACHED') END;
END;
--> statement-breakpoint
-- The user's own verified profile becomes the activation event. All other
-- onboarding transitions and protected legacy_hold behavior stay unchanged.
DROP TRIGGER IF EXISTS account_onboarding_stage_transition;
--> statement-breakpoint
CREATE TRIGGER account_onboarding_stage_transition BEFORE UPDATE OF stage ON account_onboarding
WHEN NOT (
 (OLD.stage='requested' AND NEW.stage IN ('profile_required','active'))
 OR (OLD.stage='profile_required' AND NEW.stage='profile_review')
 OR (OLD.stage='changes_requested' AND NEW.stage='profile_review')
 OR (OLD.stage='profile_review' AND NEW.stage IN ('active','changes_requested'))
 OR (OLD.stage='active' AND NEW.stage='suspended')
 OR (OLD.stage='suspended' AND NEW.stage='active')
 OR (OLD.stage='legacy_hold' AND NEW.stage='profile_review')
)
BEGIN SELECT RAISE(ABORT,'ONBOARDING_INVALID_TRANSITION'); END;
