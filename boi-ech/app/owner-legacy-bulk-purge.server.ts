
import {createHash} from "node:crypto";
import type {D1PreparedStatement} from "@cloudflare/workers-types";
import {AccountError} from "./account-core.server";
import type {getCourseDatabase} from "./device-auth.server";
type DB=Awaited<ReturnType<typeof getCourseDatabase>>;
type Owner={actor:string;role:string};
type Row={
 device_id:string;role:string;status:string;created_at:string;approved_at:string|null;
 account_id:string|null;account_revision:number|null;legacy_user_key:string|null;
 shared_legacy_profile_risk:number;
 payment_risk:number;certificate_risk:number;training_risk:number;content_risk:number;
};
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const reject=(code:string,status=409):never=>{throw new AccountError(code,status);};
const requireOwner=(actor:Owner)=>{
 if(actor.role!=="owner" || typeof actor.actor!=="string" || !actor.actor.includes("@"))
   reject("OWNER_REQUIRED",403);
};
// No new login, no manager assigned, strictly older than five complete D1 days,
// and an actual historical Owner-approval audit event (not just status=approved).
const provenance=`d.person_role IN ('learner','teacher')
 AND datetime(d.created_at)<datetime('now','-5 days')
 AND d.registration_submitted_at IS NOT NULL AND d.approved_at IS NOT NULL
 AND d.status IN ('approved','blocked','pending')
 AND (a.account_id IS NULL OR a.login IS NULL)
 AND (o.account_id IS NULL OR o.stage='legacy_hold')
 AND NOT EXISTS(SELECT 1 FROM manager_device_assignments m
   WHERE m.target_device_id=d.device_id OR m.manager_device_id=d.device_id)
 AND EXISTS(SELECT 1 FROM course_audit_log h
   WHERE h.target=d.device_id
   AND h.action IN ('learning_device_free_approved','learning_device_payment_verified'))`;
// Financial evidence, issued certificates, classes and shared authored material
// must not be irreversibly destroyed by a routine age-based cleanup.
const protectedSql=`(
 d.payment_status='paid_verified' OR d.payment_proof_key IS NOT NULL
 OR EXISTS(SELECT 1 FROM payment_reviews p WHERE p.device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM course_certificates c WHERE c.device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM training_sessions t WHERE t.teacher_id=d.device_id)
 OR EXISTS(SELECT 1 FROM course_content_versions v
  WHERE v.created_by IN (d.device_id,a.account_id) OR v.editor_device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM content_editor_devices e WHERE e.device_id=d.device_id)
 OR (d.migrated_from_user_key IS NOT NULL AND EXISTS(
  SELECT 1 FROM device_access other WHERE other.device_id<>d.device_id
  AND other.migrated_from_user_key=d.migrated_from_user_key))
)`;
const from=`FROM device_access d LEFT JOIN accounts a ON a.storage_device_id=d.device_id
 LEFT JOIN account_onboarding o ON o.account_id=a.account_id`;
const select=`SELECT d.device_id,d.person_role AS role,d.status,d.created_at,d.approved_at,
 a.account_id,a.revision AS account_revision,d.migrated_from_user_key AS legacy_user_key,
 CASE WHEN d.migrated_from_user_key IS NOT NULL AND EXISTS(
  SELECT 1 FROM device_access other WHERE other.device_id<>d.device_id
  AND other.migrated_from_user_key=d.migrated_from_user_key)
  THEN 1 ELSE 0 END AS shared_legacy_profile_risk,
 CASE WHEN d.payment_status='paid_verified' OR d.payment_proof_key IS NOT NULL
 OR EXISTS(SELECT 1 FROM payment_reviews p WHERE p.device_id=d.device_id) THEN 1 ELSE 0 END payment_risk,
 CASE WHEN EXISTS(SELECT 1 FROM course_certificates c WHERE c.device_id=d.device_id)
 THEN 1 ELSE 0 END certificate_risk,
 CASE WHEN EXISTS(SELECT 1 FROM training_sessions t WHERE t.teacher_id=d.device_id)
 THEN 1 ELSE 0 END training_risk,
 CASE WHEN EXISTS(SELECT 1 FROM course_content_versions v
 WHERE v.created_by IN (d.device_id,a.account_id) OR v.editor_device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM content_editor_devices e WHERE e.device_id=d.device_id)
 THEN 1 ELSE 0 END content_risk
 ${from} WHERE ${provenance}`;
const snapshot=(rows:Row[])=>hash(rows.map(r=>[
 r.device_id,r.role,r.status,r.created_at,r.approved_at,r.account_id,r.account_revision,
 r.legacy_user_key,r.shared_legacy_profile_risk,
 r.payment_risk,r.certificate_risk,r.training_risk,r.content_risk
]));
async function readRows(db:DB){
 const raw=await db.prepare(`${select} ORDER BY d.created_at,d.device_id LIMIT 501`).all<Row>();
 if(!Array.isArray(raw.results))reject("LEGACY_CLEANUP_READ_UNAVAILABLE",503);
 // Never imply exhaustive coverage if an unexpectedly large database is present.
 if(raw.results.length>500)reject("LEGACY_CLEANUP_PAGING_REQUIRED",409);
 return raw.results;
}
const safe=(row:Row)=>![row.payment_risk,row.certificate_risk,row.training_risk,row.content_risk,
 row.shared_legacy_profile_risk].some(Boolean);
export async function previewLegacyFiveDayPurge(db:DB,actor:Owner) {
 requireOwner(actor);
 const rows=await readRows(db);
 const eligible=rows.filter(safe);
 const protectedRows=rows.filter(r=>!safe(r));
 return {contract:"boi-owner-legacy-five-day-purge.v1",verified:true,applied:false,
  rule:"historical Owner-approved learner/teacher devices created more than 5 full days ago",
  cutoff:"datetime(device_access.created_at) < datetime('now','-5 days')",
  totalMatched:rows.length,eligible:eligible.length,
  protected:protectedRows.length,
  protectedByReason:{
   payment:protectedRows.filter(r=>r.payment_risk).length,
   certificate:protectedRows.filter(r=>r.certificate_risk).length,
   training:protectedRows.filter(r=>r.training_risk).length,
   authoredContent:protectedRows.filter(r=>r.content_risk).length,
   sharedLegacyProfiles:protectedRows.filter(r=>r.shared_legacy_profile_risk).length
  },
  // A snapshot is tied to the exact set, not user-supplied record identifiers.
  snapshot:snapshot(rows),
  batchSize:Math.min(10,eligible.length),remainingAfterFirstBatch:Math.max(0,eligible.length-10)};
}
const transactionGuard=`EXISTS(SELECT 1 ${from} WHERE d.device_id=? AND d.status=?
 AND d.created_at=? AND d.approved_at IS ?
 AND COALESCE(a.account_id,'')=? AND COALESCE(a.revision,-1)=?
 AND ${provenance} AND NOT ${protectedSql})`;
export async function executeLegacyFiveDayPurge(
 db:DB,actor:Owner,input:Record<string,unknown>
){
 requireOwner(actor);
 const reason=typeof input.reason==="string"?input.reason.trim():"";
 if(input.confirmation!=="XOA TAI KHOAN CU TREN 5 NGAY"
   ||typeof input.snapshot!=="string"||!/^[a-f0-9]{64}$/.test(input.snapshot)
   ||reason.length<10||reason.length>300)
   reject("LEGACY_CLEANUP_CONFIRMATION_REQUIRED",400);
 const rows=await readRows(db);
 if(snapshot(rows)!==input.snapshot)reject("LEGACY_CLEANUP_STATE_CHANGED",409);
 const batch=rows.filter(safe).slice(0,10);
 if(!batch.length)return {verified:true,applied:false,deleted:0,remaining:0,
  protected:rows.length,contract:"boi-owner-legacy-five-day-purge.v1"};
 const statements: D1PreparedStatement[]=[];
 for(const row of batch) {
  const id=row.device_id,account=row.account_id;
  const auditKey=hash(["legacy-five-day-purge",id]);
  // This is the first statement for each candidate. A failed guard writes
  // NULL into immutable account_audit.purpose and aborts the entire D1 batch.
  statements.push(db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
   VALUES(?,'owner.legacy-five-day-purge',?,
    CASE WHEN ${transactionGuard} THEN ? ELSE NULL END)`)
   .bind(actor.actor,auditKey,id,row.status,row.created_at,row.approved_at,
    account??"",row.account_revision??-1,
    `owner-authorized;age>5d;role=${row.role};${reason}`));
  const del=(table:string,where:string,...params:(string|null)[])=>
    statements.push(db.prepare(`DELETE FROM ${table} WHERE ${where}`).bind(...params));
  // Account/device sessions, learning data and self-generated progress.
  del("account_sync_events","account_id=?",account);
  del("account_sync_records","account_id=?",account);
  del("account_sync_grants","account_id=?",account);
  del("account_sessions","account_id=?",account);
  del("account_devices","account_id=?",account);
  del("account_manager_permissions","account_id=?",account);
  del("account_entitlements","account_id=?",account);
  del("account_contacts","account_id=?",account);
  del("account_recovery_questions","account_id=?",account);
  del("account_profile_drafts","account_id=?",account);
  del("account_ui_trials","account_id=?",account);
  del("account_manager_profiles","account_id=?",account);
  del("account_onboarding","account_id=?",account);
  del("account_credentials","account_id=?",account);
  del("accounts","account_id=?",account);
  del("ai_feedback","device_id=? OR interaction_id IN (SELECT id FROM ai_interactions WHERE subject_id IN (?,?))",id,id,account);
  del("ai_quiz_sessions","device_id=?",id);
  del("learner_self_assessments","device_id=?",id);
  del("ai_device_controls","device_id=?",id);
  del("ai_interactions","subject_id IN (?,?)",id,account);
  del("course_activity_events","device_id=?",id);
  del("device_challenges","device_id=?",id);
  del("device_profiles","device_id=?",id);
  // The legacy course profile may be removed only if no other device shares it.
  del("course_profiles","user_key=?",row.legacy_user_key);
  // No payments, certificates, schedules or shared content can reach here:
  // any existing protected link aborts the final device delete by FK/CAS.
  del("device_access","device_id=?",id);
 }
 const results=await db.batch(statements).catch(()=>reject("LEGACY_CLEANUP_STATE_CHANGED",409));
 // audit must have inserted one row per confirmed deletion;
 // D1.batch is transactional, and D1 readback is required.
 for(let i=0;i<batch.length;i++){
  if(Number(results[i*26]?.meta.changes)!==1)
   reject("LEGACY_CLEANUP_READBACK_FAILED",503);
 }
 const still=await db.prepare(`SELECT COUNT(*) AS n FROM device_access
   WHERE device_id IN (${batch.map(()=>"?").join(",")})`)
  .bind(...batch.map(x=>x.device_id)).first<{n:number}>();
 if(Number(still?.n)!==0)reject("LEGACY_CLEANUP_READBACK_FAILED",503);
 const next=await readRows(db);
 return {contract:"boi-owner-legacy-five-day-purge.v1",verified:true,applied:true,
  deleted:batch.length,remaining:next.filter(safe).length,
  protected:next.filter(r=>!safe(r)).length,
  nextSnapshot:snapshot(next),auditPreserved:true};
}
