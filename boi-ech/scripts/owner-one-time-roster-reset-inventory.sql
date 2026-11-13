-- Owner-only readback for ONE-TIME roster reset. This script NEVER mutates D1.
-- User's exclusions: "Thiên Sơn" and "Đông Nghi". Those are names, NOT unique
-- account identifiers. Operator must identify their exact canonical account_id
-- and device_id in live boi-ech-db, confirm each one is unique, then protect
-- those identities and their linked devices before any destructive operation.
-- This inventory covers ALL learners/teachers irrespective of legacy stage or
-- signup age, because the newer Owner instruction supersedes the prior 5-day
-- historical-only population for a one-time clean slate.
SELECT d.device_id AS storage_device_id,d.display_code,d.person_role AS role,
       d.learner_name AS display_name,d.learner_family_name AS family_and_middle,
       d.learner_given_name AS given_name,
       a.account_id,a.login,a.created_at AS account_created_at,
       d.created_at AS device_created_at,d.status AS device_status,
       o.stage AS onboarding_stage,
       (SELECT COUNT(*) FROM account_devices b
         WHERE b.account_id=a.account_id) AS linked_devices,
       (SELECT COUNT(*) FROM course_certificates c
         WHERE c.device_id=d.device_id) AS certificates,
       (SELECT COUNT(*) FROM payment_reviews p
         WHERE p.device_id=d.device_id) AS payments,
       (SELECT COUNT(*) FROM training_sessions t
         WHERE t.teacher_id=d.device_id) AS training_sessions,
       (SELECT COUNT(*) FROM manager_device_assignments m
         WHERE m.target_device_id=d.device_id) AS manager_assignments,
       (SELECT COUNT(*) FROM account_sync_records s
         WHERE s.account_id=a.account_id) AS sync_records
FROM device_access d
LEFT JOIN accounts a ON a.storage_device_id=d.device_id
LEFT JOIN account_onboarding o ON o.account_id=a.account_id
WHERE d.person_role IN ('learner','teacher')
ORDER BY d.learner_name,d.device_id;
