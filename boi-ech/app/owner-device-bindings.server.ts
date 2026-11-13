import {createHash} from "node:crypto";
import {AccountError} from "./account-core.server";

type DB = Awaited<ReturnType<typeof import("./device-auth.server").getCourseDatabase>>;
type Actor = {actor:string;role:string};
type Row = {
 account_id:string;device_id:string;approved:number;revoked:number;created_at:string;
 account_created_at:string;login:string|null;learner_name:string|null;person_role:string|null;
 account_status:string;account_revision:number;onboarding_stage:string|null;
};
const HEX=/^[a-f0-9]{64}$/;
const bindingHash=(accountId:string,deviceId:string)=>
 createHash("sha256").update(JSON.stringify([accountId,deviceId])).digest("hex");
const fail=(code:string,status=409):never=>{throw new AccountError(code,status);};
function owner(actor:Actor){
 if(actor.role!=="owner" || !actor.actor || !actor.actor.includes("@"))fail("OWNER_REQUIRED",403);
}
function validId(value:unknown):string {
 if(typeof value!=="string"||!HEX.test(value))fail("DEVICE_BINDING_INPUT",400);
 return value;
}
async function locate(db:DB,id:string){
 // HMAC control-ticket authentication and Owner role are checked by the route.
 // Hash stays the public lookup key; no primary device key leaves the Worker.
 const all=await db.prepare(`SELECT b.account_id,b.device_id,b.approved,b.revoked,b.created_at,
    a.created_at AS account_created_at,a.login,d.learner_name,d.person_role,
    d.status AS account_status,a.revision AS account_revision,o.stage AS onboarding_stage
   FROM account_devices b JOIN accounts a ON a.account_id=b.account_id
   JOIN device_access d ON d.device_id=a.storage_device_id
   LEFT JOIN account_onboarding o ON o.account_id=a.account_id
   ORDER BY b.account_id,b.device_id`).all<Row>();
 if(!all.success||!Array.isArray(all.results))fail("DEVICE_BINDING_READ_UNAVAILABLE",503);
 return all.results.find(row=>bindingHash(row.account_id,row.device_id)===id)??null;
}
async function details(db:DB,id:string){
 const row=await locate(db,id);
 if(!row)fail("DEVICE_BINDING_NOT_FOUND",404);
 const now=Date.now();
 const [trusted,sessions,grants,events,active]=await Promise.all([
  db.prepare(`SELECT COUNT(*) AS n FROM account_devices WHERE account_id=? AND device_id<>? AND revoked=0 AND approved=1`)
    .bind(row.account_id,row.device_id).first<{n:number}>(),
  db.prepare("SELECT COUNT(*) AS n FROM account_sessions WHERE account_id=? AND device_id=?")
    .bind(row.account_id,row.device_id).first<{n:number}>(),
  db.prepare("SELECT COUNT(*) AS n FROM account_sync_grants WHERE account_id=? AND device_id=?")
    .bind(row.account_id,row.device_id).first<{n:number}>(),
  db.prepare("SELECT COUNT(*) AS n FROM account_sync_events WHERE account_id=? AND device_id=?")
    .bind(row.account_id,row.device_id).first<{n:number}>(),
  db.prepare("SELECT COUNT(*) AS n FROM account_sessions WHERE account_id=? AND device_id=? AND revoked=0 AND expires_at>? AND idle_expires_at>?")
    .bind(row.account_id,row.device_id,now,now).first<{n:number}>()
 ]);
 const status=row.revoked===1?"blocked":row.approved===1?"approved":"pending";
 return {contract:"boi-owner-device-binding.v1",verified:true,bindingId:id,status,
   createdAt:row.created_at,
   account:{accountId:row.account_id,name:row.learner_name||null,
    login:row.login||null,role:row.person_role||null,
    status:row.account_status,onboardingStage:row.onboarding_stage,
    createdAt:row.account_created_at,revision:row.account_revision},
   dependencies:{sessions:sessions?.n??0,activeSessions:active?.n??0,
    syncGrants:grants?.n??0,syncEvents:events?.n??0,otherTrustedDevices:trusted?.n??0},
   purgeAllowed:row.revoked===1,
   // D1 audit and canonical account records remain outside a device-binding purge.
   preservesAccount:true,preservesLearning:true,preservesAudit:true};
}
function verifiedInput(input:Record<string,unknown>,id:string) {
 if(input.confirmation!==id || typeof input.reason!=="string" ||
    input.reason.trim().length<10 || input.reason.length>300 ||
    typeof input.expectedCreatedAt!=="string" || !Number.isFinite(Date.parse(input.expectedCreatedAt)) ||
    !["pending","approved","blocked"].includes(String(input.expectedStatus)))
  fail("DEVICE_BINDING_INPUT",400);
 return {reason:input.reason.trim(),createdAt:input.expectedCreatedAt,
  status:input.expectedStatus as string};
}
export async function ownerDeviceBinding(db:DB,actor:Actor,input:Record<string,unknown>){
 owner(actor);
 const id=validId(input.bindingId);
 if(input.action==="inspect") return details(db,id);
 if(input.action!=="revoke" && input.action!=="purge")fail("DEVICE_BINDING_INPUT",400);
 const guard=verifiedInput(input,id);
 const row=await locate(db,id);
 if(!row)fail("DEVICE_BINDING_NOT_FOUND",404);
 const status=row.revoked===1?"blocked":row.approved===1?"approved":"pending";
 if(row.created_at!==guard.createdAt||status!==guard.status)fail("DEVICE_BINDING_CAS_CONFLICT",409);
 if(input.action==="revoke"){
  if(row.revoked===1)fail("DEVICE_BINDING_CAS_CONFLICT",409);
  const results=await db.batch([
   db.prepare("UPDATE account_devices SET revoked=1 WHERE account_id=? AND device_id=? AND created_at=? AND revoked=0 AND approved=?")
     .bind(row.account_id,row.device_id,guard.createdAt,row.approved),
   db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
     SELECT ?,'owner.device-binding.revoke',?,? WHERE changes()=1`)
     .bind(actor.actor,id,guard.reason),
   db.prepare("UPDATE account_sessions SET revoked=1 WHERE account_id=? AND device_id=?")
     .bind(row.account_id,row.device_id),
   db.prepare("UPDATE account_sync_grants SET enabled=0 WHERE account_id=? AND device_id=? AND enabled<>0")
     .bind(row.account_id,row.device_id),
  ]);
  if(Number(results[0].meta.changes)!==1||Number(results[1].meta.changes)!==1)
    fail("DEVICE_BINDING_CAS_CONFLICT",409);
  const after=await details(db,id);
  if(after.status!=="blocked"||after.dependencies.activeSessions!==0)fail("DEVICE_BINDING_READBACK_FAILED",503);
  return {...after,action:"revoke",ok:true};
 }
 if(row.revoked!==1)fail("DEVICE_BINDING_REVOKE_FIRST",409);
 // All sessions and per-device sync metadata must go before their FK parent.
 // Account-scoped progress, login, entitlement and immutable audit survive.
 const guardRow=`EXISTS(SELECT 1 FROM account_devices b WHERE b.account_id=?
  AND b.device_id=? AND b.revoked=1 AND b.created_at=?)`;
 const results=await db.batch([
  db.prepare(`DELETE FROM account_sync_events WHERE account_id=? AND device_id=? AND ${guardRow}`)
   .bind(row.account_id,row.device_id,row.account_id,row.device_id,guard.createdAt),
  db.prepare(`DELETE FROM account_sync_grants WHERE account_id=? AND device_id=? AND ${guardRow}`)
   .bind(row.account_id,row.device_id,row.account_id,row.device_id,guard.createdAt),
  db.prepare(`DELETE FROM account_sessions WHERE account_id=? AND device_id=? AND ${guardRow}`)
   .bind(row.account_id,row.device_id,row.account_id,row.device_id,guard.createdAt),
  db.prepare("DELETE FROM account_devices WHERE account_id=? AND device_id=? AND created_at=? AND revoked=1")
   .bind(row.account_id,row.device_id,guard.createdAt),
  db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
    SELECT ?,'owner.device-binding.purge',?,? WHERE changes()=1`)
   .bind(actor.actor,id,guard.reason),
 ]);
 if(Number(results[3].meta.changes)!==1||Number(results[4].meta.changes)!==1)
  fail("DEVICE_BINDING_CAS_CONFLICT",409);
 const found=await locate(db,id);
 if(found)fail("DEVICE_BINDING_READBACK_FAILED",503);
 return {ok:true,verified:true,contract:"boi-owner-device-binding.v1",
  action:"purge",bindingId:id,deleted:true,preservesAccount:true,preservesLearning:true,preservesAudit:true};
}
