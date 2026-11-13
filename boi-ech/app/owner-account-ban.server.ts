import {createHash} from "node:crypto";
import type {D1Database,D1PreparedStatement} from "@cloudflare/workers-types";
import {AccountError} from "./account-core.server";
const ID=/^acc_[a-f0-9]{64}$/;
const key=/^[a-f0-9]{64}$/;
const digest=(s:string)=>createHash("sha256").update(s).digest("hex");
type Owner={role:string;actor:string};
function requireOwner(a:Owner) {
 if(a.role!=="owner"||!a.actor||a.actor==="system")throw new AccountError("OWNER_REQUIRED",403);
}
export async function blockBoiAccount(db:D1Database,owner:Owner,input:Record<string,unknown>) {
 requireOwner(owner);
 const id=input.accountId,rev=input.expectedRevision;
 const reason=input.reason;
 if(typeof id!=="string"||!ID.test(id)||input.confirmation!==id||
    !Number.isSafeInteger(rev)||Number(rev)<0||typeof reason!=="string"||
    reason.trim().length<10||reason.length>300)throw new AccountError("ACCOUNT_BLOCK_INPUT",400);
 const row=await db.prepare(`SELECT a.account_id,a.login,a.revision,d.status,
  a.storage_device_id,d.person_role
  FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
  WHERE a.account_id=?`).bind(id).first<{
   account_id:string;login:string|null;revision:number;status:string;
   storage_device_id:string;person_role:string
  }>();
 if(!row)throw new AccountError("ACCOUNT_NOT_FOUND",404);
 if(row.revision!==rev||row.status==="blocked")throw new AccountError("ACCOUNT_CAS_CONFLICT",409);
 // The full set of existing device credentials is banned by P-256 public key
 // hash. The normalized login name is stored only as a SHA-256 digest.
 const devices=await db.prepare("SELECT device_id FROM account_devices WHERE account_id=?")
  .bind(id).all<{device_id:string}>();
 if(!Array.isArray(devices.results))throw new AccountError("ACCOUNT_READBACK_FAILED",503);
 const ids=[...new Set(devices.results.map(x=>x.device_id).filter(x=>key.test(x)))];
 const stmt:D1PreparedStatement[]=[
  db.prepare("UPDATE accounts SET revision=revision+1 WHERE account_id=? AND revision=?")
   .bind(id,rev),
  db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
   SELECT ?,'owner.account.permanent-block',?,CASE WHEN changes()=1 THEN ? ELSE NULL END`)
   .bind(owner.actor,digest(id),reason.trim()),
 ];
 if(row.login){
  stmt.push(db.prepare(`INSERT INTO account_reentry_bans(kind,ban_hash,blocked_by,reason)
   VALUES('login',?,?,?) ON CONFLICT(kind,ban_hash) DO UPDATE SET
   blocked_by=excluded.blocked_by,reason=excluded.reason,revoked_at=NULL`)
   .bind(digest(row.login.trim().toLowerCase()),owner.actor,reason.trim()));
 }
 for(const deviceId of ids)stmt.push(db.prepare(`INSERT INTO account_reentry_bans
  (kind,ban_hash,blocked_by,reason) VALUES('device-key',?,?,?)
  ON CONFLICT(kind,ban_hash) DO UPDATE SET blocked_by=excluded.blocked_by,
    reason=excluded.reason,revoked_at=NULL`).bind(deviceId,owner.actor,reason.trim()));
 stmt.push(db.prepare("UPDATE account_devices SET revoked=1 WHERE account_id=?").bind(id));
 stmt.push(db.prepare("UPDATE account_sessions SET revoked=1 WHERE account_id=?").bind(id));
 stmt.push(db.prepare("UPDATE account_sync_grants SET enabled=0 WHERE account_id=?").bind(id));
 stmt.push(db.prepare("UPDATE account_manager_permissions SET enabled=0 WHERE account_id=?").bind(id));
 stmt.push(db.prepare(`UPDATE account_entitlements SET state='suspended',revision=revision+1,
  changed_by=?,updated_at=CURRENT_TIMESTAMP WHERE account_id=? AND state='active'`).bind(owner.actor,id));
 stmt.push(db.prepare(`UPDATE account_onboarding SET stage='suspended',revision=revision+1,
  updated_at=CURRENT_TIMESTAMP WHERE account_id=? AND stage='active'`).bind(id));
 stmt.push(db.prepare(`UPDATE device_access SET status='blocked',management_enabled=0,
  updated_at=CURRENT_TIMESTAMP WHERE device_id=? AND status IN ('pending','approved')`)
  .bind(row.storage_device_id));
 try{await db.batch(stmt);}
 catch(error){
  if(error instanceof Error&&/NOT NULL|constraint|CHECK/i.test(error.message))
   throw new AccountError("ACCOUNT_CAS_CONFLICT",409);
  throw error;
 }
 const [after,session]=await Promise.all([
  db.prepare(`SELECT a.revision,d.status FROM accounts a JOIN device_access d
   ON d.device_id=a.storage_device_id WHERE a.account_id=?`)
   .bind(id).first<{revision:number;status:string}>(),
  db.prepare(`SELECT COUNT(*) AS n FROM account_sessions
   WHERE account_id=? AND revoked=0`).bind(id).first<{n:number}>()
 ]);
 if(!after||after.revision!==rev+1||after.status!=="blocked"||Number(session?.n)!==0)
  throw new AccountError("ACCOUNT_READBACK_FAILED",503);
 return {ok:true,verified:true,contract:"boi-owner-account-ban.v1",
  accountId:id,status:"blocked",revision:after.revision,
  deviceKeysBanned:ids.length,loginBanned:Boolean(row.login),
  persistent:true,auditPreserved:true};
}
export async function banBoiDeviceKey(db:D1Database,owner:Owner,input:Record<string,unknown>){
 requireOwner(owner);
 const device=input.deviceId,reason=input.reason;
 if(typeof device!=="string"||!key.test(device)||input.confirmation!==device||
   typeof reason!=="string"||reason.trim().length<10||reason.length>300)
   throw new AccountError("ACCOUNT_BLOCK_INPUT",400);
 const row=await db.prepare("SELECT account_id FROM account_devices WHERE device_id=?")
  .bind(device).first<{account_id:string}>();
 if(!row)throw new AccountError("DEVICE_BINDING_NOT_FOUND",404);
 const results=await db.batch([
  db.prepare(`INSERT INTO account_reentry_bans(kind,ban_hash,blocked_by,reason)
    VALUES('device-key',?,?,?) ON CONFLICT(kind,ban_hash) DO UPDATE SET
    blocked_by=excluded.blocked_by,reason=excluded.reason,revoked_at=NULL`)
    .bind(device,owner.actor,reason.trim()),
  db.prepare("UPDATE account_devices SET revoked=1 WHERE account_id=? AND device_id=?")
    .bind(row.account_id,device),
  db.prepare("UPDATE account_sessions SET revoked=1 WHERE account_id=? AND device_id=?")
    .bind(row.account_id,device),
  db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
    VALUES(?,'owner.device.permanent-block',?,?)`)
    .bind(owner.actor,device,reason.trim())
 ]);
 const banned=await db.prepare(`SELECT 1 AS active FROM account_reentry_bans
  WHERE kind='device-key' AND ban_hash=? AND revoked_at IS NULL`)
  .bind(device).first();
 if(!banned||!Array.isArray(results))throw new AccountError("ACCOUNT_READBACK_FAILED",503);
 return {ok:true,verified:true,contract:"boi-owner-device-ban.v1",deviceId:device,
  persistent:true,auditPreserved:true};
}
