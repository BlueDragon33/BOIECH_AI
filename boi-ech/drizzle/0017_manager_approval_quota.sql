-- Blueprint OS 1.3.0. Additive, no grants or backfill; no existing user is assigned automatically.
-- Shared quota for the manager tier, NOT multiplied by manager count.
CREATE TABLE IF NOT EXISTS manager_approval_limits (
  scope TEXT PRIMARY KEY NOT NULL CHECK(scope='manager-tier'),
  learner_limit INTEGER NOT NULL DEFAULT 50 CHECK(learner_limit BETWEEN 0 AND 5000),
  teacher_limit INTEGER NOT NULL DEFAULT 5 CHECK(teacher_limit BETWEEN 0 AND 500),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO manager_approval_limits(scope,learner_limit,teacher_limit,updated_by)
VALUES('manager-tier',50,5,'system:default')
ON CONFLICT(scope) DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS manager_device_assignments (
  target_device_id TEXT PRIMARY KEY NOT NULL REFERENCES device_access(device_id) ON DELETE CASCADE,
  manager_device_id TEXT NOT NULL REFERENCES device_access(device_id) ON DELETE RESTRICT,
  person_role TEXT NOT NULL CHECK(person_role IN ('learner','teacher')),
  approved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS manager_assignment_owner_role_idx
  ON manager_device_assignments(manager_device_id, person_role);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS manager_assignment_guard
BEFORE INSERT ON manager_device_assignments BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM device_access m
      WHERE m.device_id=NEW.manager_device_id
      AND m.person_role='manager' AND m.management_enabled=1 AND m.status='approved'
      AND m.registration_submitted_at IS NOT NULL
      AND (m.access_expires_at IS NULL OR datetime(m.access_expires_at)>CURRENT_TIMESTAMP)
  ) THEN RAISE(ABORT,'MANAGER_APPROVAL_FORBIDDEN') END;
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
  SELECT CASE WHEN (
    SELECT COUNT(*) FROM manager_device_assignments a
      WHERE a.person_role=NEW.person_role
  ) >= COALESCE((
    SELECT CASE WHEN NEW.person_role='learner' THEN learner_limit ELSE teacher_limit END
    FROM manager_approval_limits WHERE scope='manager-tier'
  ), CASE WHEN NEW.person_role='learner' THEN 50 ELSE 5 END)
  THEN RAISE(ABORT,'MANAGER_APPROVAL_QUOTA_REACHED') END;
END;
--> statement-breakpoint
-- New two-tier review is opt-in at release, not an implicit blanket approval.
-- Do not change existing approved/paid/blocked accounts or delete prior policy history.
UPDATE access_automation_settings SET auto_confirm_new_devices=0,
  updated_by='system:manager-tier-transition',updated_at=CURRENT_TIMESTAMP
  WHERE id='global' AND auto_confirm_new_devices<>0;
