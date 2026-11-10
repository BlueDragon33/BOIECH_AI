-- L1/P0: V2 manager approval must use active ACCOUNT entitlement, not an expired
-- legacy device access deadline. Earlier deployed 0017 trigger remains immutable;
-- replace it additively in 0025, preserving the V1 guard and all quota checks.
-- No D1 binding, account data, permission, limit or environment configuration is changed.
-- Install the complete new guard BEFORE removing the old trigger. A partial
-- interrupted migration remains fail-closed because at least one guard exists.
CREATE TRIGGER IF NOT EXISTS manager_assignment_v2_entitlement_guard
BEFORE INSERT ON manager_device_assignments BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM device_access m
    WHERE m.device_id=NEW.manager_device_id
      AND m.person_role='manager' AND m.management_enabled=1
      AND m.status='approved' AND m.registration_submitted_at IS NOT NULL
      AND (
        -- A manager with ANY V2 entitlement stays on the V2 branch even
        -- when the target returns to changes_requested; never fall back to
        -- a still-valid legacy device expiry to bypass second review.
        CASE WHEN EXISTS(
          SELECT 1 FROM accounts ma JOIN account_entitlements e
            ON e.account_id=ma.account_id
          WHERE ma.storage_device_id=m.device_id
        ) OR EXISTS(
          SELECT 1 FROM accounts t JOIN account_onboarding ot
            ON ot.account_id=t.account_id
          WHERE t.storage_device_id=NEW.target_device_id
            AND ot.first_review_by IS NOT NULL
        ) THEN EXISTS(
          SELECT 1 FROM accounts ma
            JOIN account_onboarding om ON om.account_id=ma.account_id
            JOIN account_entitlements e ON e.account_id=ma.account_id
            JOIN account_manager_permissions p ON p.account_id=ma.account_id
            JOIN accounts t ON t.storage_device_id=NEW.target_device_id
            JOIN account_onboarding ot ON ot.account_id=t.account_id
          WHERE ma.storage_device_id=m.device_id
            AND om.stage='active' AND e.state='active'
            AND datetime(e.expires_at)>CURRENT_TIMESTAMP
            AND p.scope='manager.approve.registration' AND p.enabled=1
            AND (p.expires_at IS NULL OR p.expires_at>(unixepoch()*1000))
            AND ot.stage='profile_review'
            AND ot.first_review_by=ma.account_id
        ) ELSE (m.access_expires_at IS NULL
          OR datetime(m.access_expires_at)>CURRENT_TIMESTAMP)
        END
      )
  ) THEN RAISE(ABORT,'MANAGER_APPROVAL_FORBIDDEN') END;
  -- Keep full legacy target field validation; no incomplete requests may enter.
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM device_access d WHERE d.device_id=NEW.target_device_id
      AND d.person_role=NEW.person_role
      AND d.person_role IN ('learner','teacher')
      AND d.status='pending' AND d.payment_status='unassigned'
      AND d.learner_name IS NOT NULL AND trim(d.learner_name)!=''
      AND d.person_code IS NOT NULL AND trim(d.person_code)!=''
      AND d.phone IS NOT NULL AND trim(d.phone)!=''
      AND d.class_name IS NOT NULL AND trim(d.class_name)!=''
      AND d.registration_submitted_at IS NOT NULL
  ) THEN RAISE(ABORT,'MANAGER_TARGET_NOT_ELIGIBLE') END;
  -- Retain the existing shared manager-tier cap. V2's independent 5/10/200
  -- reservation is ALSO enforced at stage='active' by the untouched 0024 trigger.
  SELECT CASE WHEN (
    SELECT COUNT(*) FROM manager_device_assignments a
      JOIN device_access d ON d.device_id=a.target_device_id
      WHERE a.person_role=NEW.person_role AND d.status='approved'
        AND (d.access_expires_at IS NULL OR datetime(d.access_expires_at)>CURRENT_TIMESTAMP)
  ) >= COALESCE((
    SELECT CASE WHEN NEW.person_role='learner' THEN learner_limit ELSE teacher_limit END
    FROM manager_approval_limits WHERE scope='manager-tier'
  ), CASE WHEN NEW.person_role='learner' THEN 50 ELSE 5 END)
  THEN RAISE(ABORT,'MANAGER_APPROVAL_QUOTA_REACHED') END;
END;
--> statement-breakpoint
-- Drop obsolete legacy device-expiry guard LAST, after the full substitute exists.
-- A rerun is safe. No change to legacy 0017 migration history.
DROP TRIGGER IF EXISTS manager_assignment_guard;
