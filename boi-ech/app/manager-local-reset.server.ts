import type { D1Database } from "@cloudflare/workers-types";
import { AccountError } from "./account-core.server";

const ACCOUNT=/^acc_[a-f0-9]{64}$/;
function deny(code:string,status=403):never{throw new AccountError(code,status);}
/**
 * Owner-only deletion of a NEVER-ACTIVATED local test manager.
 * Transport enforces localhost/LOCAL_CONTROL_PLANE. D1 batch is atomic.
 * account_audit is append-only and survives identity removal.
 */
export async function cancelLocalPendingManager(
 db:D1Database,owner:{role:string;actor:string},
 accountId:unknown,expectedRevision:unknown,confirmation:unknown
){
 if(owner.role!=="owner"||!owner.actor||owner.actor==="system")deny("OWNER_REQUIRED");
 if(typeof accountId!=="string"||!ACCOUNT.test(accountId)||confirmation!==accountId
   ||!Number.isSafeInteger(expectedRevision)||(expectedRevision as number)<1)deny("ACCOUNT_INPUT",400);
 const row=await db.prepare(`SELECT a.storage_device_id AS deviceId,a.revision AS accountRevision,
  o.revision AS onboardingRevision,o.stage,d.status,d.person_role AS role,
  (SELECT COUNT(*) FROM account_entitlements WHERE account_id=a.account_id) AS entitlements,
  (SELECT COUNT(*) FROM account_manager_permissions WHERE account_id=a.account_id) AS permissions,
  (SELECT COUNT(*) FROM account_manager_profiles WHERE account_id=a.account_id) AS profile,
  (SELECT COUNT(*) FROM account_sync_grants WHERE account_id=a.account_id) AS syncGrants,
  (SELECT COUNT(*) FROM account_sync_records WHERE account_id=a.account_id) AS syncRecords,
  (SELECT COUNT(*) FROM account_sync_events WHERE account_id=a.account_id) AS syncEvents,
  (SELECT COUNT(*) FROM manager_device_assignments
    WHERE target_device_id=a.storage_device_id OR manager_device_id=a.storage_device_id) AS assignments,
  (SELECT COUNT(*) FROM account_devices WHERE account_id=a.account_id) AS devices
  FROM accounts a JOIN account_onboarding o ON o.account_id=a.account_id
  JOIN device_access d ON d.device_id=a.storage_device_id WHERE a.account_id=?`)
  .bind(accountId).first<{deviceId:string;accountRevision:number;onboardingRevision:number;stage:string;
    status:string;role:string;entitlements:number;permissions:number;profile:number;
    syncGrants:number;syncRecords:number;syncEvents:number;assignments:number;devices:number}>();
 if(!row||row.role!=="manager"||row.status!=="pending"
   ||!["requested","profile_required"].includes(row.stage)
   ||row.onboardingRevision!==expectedRevision||row.accountRevision!==0
   ||row.entitlements!==0||row.permissions!==0||row.profile!==0
   ||row.syncGrants!==0||row.syncRecords!==0||row.syncEvents!==0
   ||row.assignments!==0||row.devices!==1)deny("ACCOUNT_RESET_NOT_ELIGIBLE",409);
 const id=accountId,device=row.deviceId;
 const statements=[
  db.prepare(`UPDATE account_onboarding SET revision=revision+1,updated_at=CURRENT_TIMESTAMP
   WHERE account_id=? AND revision=? AND stage=? AND EXISTS(
    SELECT 1 FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
    WHERE a.account_id=? AND d.person_role='manager' AND d.status='pending' AND a.revision=0)
   AND NOT EXISTS(SELECT 1 FROM account_entitlements WHERE account_id=?)
   AND NOT EXISTS(SELECT 1 FROM account_manager_permissions WHERE account_id=?)
   AND NOT EXISTS(SELECT 1 FROM account_manager_profiles WHERE account_id=?)
   AND NOT EXISTS(SELECT 1 FROM account_sync_grants WHERE account_id=?)
   AND NOT EXISTS(SELECT 1 FROM account_sync_records WHERE account_id=?)
   AND NOT EXISTS(SELECT 1 FROM account_sync_events WHERE account_id=?)
   AND (SELECT COUNT(*) FROM account_devices WHERE account_id=?)=1
   AND NOT EXISTS(SELECT 1 FROM manager_device_assignments
     WHERE target_device_id=? OR manager_device_id=?)`)
    .bind(id,expectedRevision,row.stage,id,id,id,id,id,id,id,id,device,device),
  db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
   SELECT ?,'owner.manager-intake.cancelled',?,
    CASE WHEN changes()=1 THEN 'local test intake reset by exact id and CAS' ELSE NULL END`)
    .bind(owner.actor,id),
  // Revoked invitation must never become reusable when a local test account is cancelled.
  db.prepare(`UPDATE account_manager_invitations SET consumed_by=NULL,consumed_at_ms=NULL,
    revoked_at_ms=?,revision=revision+1 WHERE consumed_by=?`).bind(Date.now(),id),
  db.prepare("DELETE FROM account_sessions WHERE account_id=?").bind(id),
  db.prepare("DELETE FROM account_contacts WHERE account_id=?").bind(id),
  db.prepare("DELETE FROM account_devices WHERE account_id=?").bind(id),
  db.prepare("DELETE FROM account_credentials WHERE account_id=?").bind(id),
  db.prepare("DELETE FROM account_onboarding WHERE account_id=?").bind(id),
  db.prepare("DELETE FROM accounts WHERE account_id=?").bind(id),
  db.prepare("DELETE FROM device_profiles WHERE device_id=?").bind(device),
  db.prepare("DELETE FROM device_access WHERE device_id=?").bind(device),
  db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
   SELECT ?,'owner.manager-intake.delete-verified',?,
    CASE WHEN changes()=1 THEN 'pending manager removed in atomic local transaction' ELSE NULL END`)
    .bind(owner.actor,id),
 ];
 try{await db.batch(statements);}catch{deny("ACCOUNT_RESET_CONFLICT",409);}
 const remaining=await db.prepare("SELECT account_id FROM accounts WHERE account_id=?")
  .bind(id).first<{account_id:string}>();
 const audit=await db.prepare(`SELECT id FROM account_audit WHERE target=?
  AND action='owner.manager-intake.delete-verified' ORDER BY id DESC LIMIT 1`)
  .bind(id).first<{id:number}>();
 if(remaining||!audit)deny("ACCOUNT_READBACK_FAILED",503);
 return {verified:true,deletedAccountId:id,auditId:audit.id,scope:"local-test-only"};
}
