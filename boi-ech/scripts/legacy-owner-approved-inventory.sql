-- BOIECH_AI Owner legacy-intake inventory. READ ONLY: no data mutations.
-- Strict selection: historical Owner approval event, older than five full days since original device creation, no V2 login, no manager assignment,
-- never a manager account. Auto-approved devices without Owner event are NOT guessed.
-- Run only after verifying current Cloudflare D1 boi-ech-db and PITR bookmark.
WITH owner_legacy AS (
 SELECT d.device_id,d.display_code,d.person_role,d.status,d.approved_at,
        a.account_id,a.login,o.stage,
        EXISTS(SELECT 1 FROM payment_reviews p WHERE p.device_id=d.device_id) AS has_payment,
        EXISTS(SELECT 1 FROM course_certificates c WHERE c.device_id=d.device_id) AS has_certificate,
        EXISTS(SELECT 1 FROM course_activity_events e WHERE e.device_id=d.device_id) AS has_progress,
        EXISTS(SELECT 1 FROM training_sessions t WHERE t.teacher_id=d.device_id) AS has_training,
        EXISTS(SELECT 1 FROM course_content_versions v
          WHERE v.created_by IN (d.device_id,a.account_id)) AS has_content,
        EXISTS(SELECT 1 FROM account_sync_records r WHERE r.account_id=a.account_id)
        OR EXISTS(SELECT 1 FROM account_sync_events e WHERE e.account_id=a.account_id) AS has_sync
 FROM device_access d
 LEFT JOIN accounts a ON a.storage_device_id=d.device_id
 LEFT JOIN account_onboarding o ON o.account_id=a.account_id
 WHERE d.person_role IN ('learner','teacher')
   -- Use source device creation, not mapped accounts.created_at (which may be backfilled later).
   -- Strictly older than five 24-hour periods on the D1 server clock.
   AND datetime(d.created_at) < datetime('now','-5 days')
   AND d.registration_submitted_at IS NOT NULL
   AND d.approved_at IS NOT NULL
   AND d.status IN ('approved','blocked')
   AND (a.account_id IS NULL OR a.login IS NULL)
   AND (o.account_id IS NULL OR o.stage='legacy_hold')
   AND NOT EXISTS(SELECT 1 FROM manager_device_assignments m
     WHERE m.target_device_id=d.device_id)
   AND EXISTS(SELECT 1 FROM course_audit_log h
     WHERE h.target=d.device_id
       AND h.action IN ('learning_device_free_approved','learning_device_payment_verified'))
)
SELECT person_role AS role,COUNT(*) AS owner_approved_legacy,
       SUM(CASE WHEN has_payment OR has_certificate OR has_training OR has_content
            OR has_sync THEN 1 ELSE 0 END) AS requires_retention_review,
       SUM(CASE WHEN has_payment=0 AND has_certificate=0 AND has_training=0
            AND has_content=0 AND has_sync=0 THEN 1 ELSE 0 END) AS basic_purge_candidates,
       SUM(CASE WHEN has_progress THEN 1 ELSE 0 END) AS with_progress
FROM owner_legacy GROUP BY person_role ORDER BY person_role;
