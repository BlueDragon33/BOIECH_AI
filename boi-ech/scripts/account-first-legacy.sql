-- Explicit Owner-authorized Account-first activation. Same deterministic mapping as AccountService.backfill.
-- Original device/profile/payment rows are never updated. V2 remains legacy_hold until reconciliation.
INSERT INTO accounts(account_id,storage_device_id)
 SELECT 'acc_'||device_id,device_id FROM device_access
 WHERE registration_submitted_at IS NOT NULL AND person_role IN ('learner','manager','teacher')
 AND trim(COALESCE(person_code,''))<>'' AND trim(COALESCE(phone,''))<>''
 ON CONFLICT(storage_device_id) DO NOTHING;
INSERT INTO account_devices(account_id,device_id,public_key_jwk)
 SELECT a.account_id,d.device_id,d.public_key_jwk FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
 WHERE a.account_id='acc_'||d.device_id ON CONFLICT(account_id,device_id) DO NOTHING;
INSERT INTO account_manager_permissions(account_id,scope,enabled,granted_by)
 SELECT a.account_id,'manager.approve.registration',1,'migration:existing-operational-grant'
 FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
 WHERE d.person_role='manager' AND d.management_enabled=1 ON CONFLICT(account_id,scope) DO NOTHING;
INSERT INTO account_manager_permissions(account_id,scope,enabled,granted_by)
 SELECT a.account_id,'manager.manage.assigned',1,'migration:existing-operational-grant'
 FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
 WHERE d.person_role='manager' AND d.management_enabled=1 ON CONFLICT(account_id,scope) DO NOTHING;
