
import {createHash} from "node:crypto";
import type {D1PreparedStatement} from "@cloudflare/workers-types";
import {AccountError} from "./account-core.server";
import type {getCourseDatabase} from "./device-auth.server";
type DB=Awaited<ReturnType<typeof getCourseDatabase>>;
type Owner={actor:string;role:string};
type Row={
 device_id:string;name:string|null;role:string;created_at:string;updated_at:string|null;
 status:string;account_id:string|null;revision:number|null;legacy_key:string|null;
 payments:number;certificates:number;training:number;content:number;shared:number;
};
type Manifest={
 protected_thien_son:string;protected_dong_nghi:string;protected_quynh:string|null;cutoff_at:string;backup_bookmark_hash:string;
 state:string;revision:number;removed:number;
};
const ID="2026-11-13-learner-teacher-reset";
const WORDS={son:"nguyen dinh thien son",nghi:"nguyen vo dong nghi",quynh:"ngo tuyet quynh"};
const PREFIX={son:"acc_6b4dbc19e478ef4",nghi:"acc_68cfa13cfe2f66d",quynh:"acc_1f73c030843c73a"};
const CONFIRM="XOA TAT CA TRU NGO TUYET QUYNH, THIEN SON VA DONG NGHI";
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const fail=(code:string,status=409):never=>{throw new AccountError(code,status);};
const owner=(actor:Owner)=>{if(actor.role!=="owner"||typeof actor.actor!=="string"||
 !actor.actor.includes("@"))fail("OWNER_REQUIRED",403);};
const fold=(s:string|null)=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .replace(/[đĐ]/g,"d").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const samePerson=(value:string|null,words:string)=>(" "+fold(value)+" ").includes(" "+words+" ");
const select=`SELECT d.device_id,d.learner_name AS name,d.person_role AS role,
 d.created_at,d.updated_at,d.status,
 a.account_id,a.revision,d.migrated_from_user_key AS legacy_key,
 CASE WHEN d.payment_status='paid_verified' OR d.payment_proof_key IS NOT NULL
 OR EXISTS(SELECT 1 FROM payment_reviews p WHERE p.device_id=d.device_id)
 THEN 1 ELSE 0 END AS payments,
 CASE WHEN EXISTS(SELECT 1 FROM course_certificates c WHERE c.device_id=d.device_id)
 THEN 1 ELSE 0 END AS certificates,
 CASE WHEN EXISTS(SELECT 1 FROM training_sessions s WHERE s.teacher_id=d.device_id)
 OR EXISTS(SELECT 1 FROM training_commands c WHERE c.actor_id=d.device_id)
 THEN 1 ELSE 0 END AS training,
 CASE WHEN EXISTS(SELECT 1 FROM course_content_versions v
   WHERE v.created_by IN (d.device_id,a.account_id) OR v.editor_device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM content_editor_devices c WHERE c.device_id=d.device_id)
 THEN 1 ELSE 0 END AS content,
 CASE WHEN d.migrated_from_user_key IS NOT NULL AND EXISTS(
  SELECT 1 FROM device_access other WHERE other.device_id<>d.device_id
    AND other.migrated_from_user_key=d.migrated_from_user_key)
 THEN 1 ELSE 0 END AS shared
 FROM device_access d LEFT JOIN accounts a ON a.storage_device_id=d.device_id
 WHERE d.person_role IN ('learner','teacher')
 AND datetime(d.created_at)<=datetime(?)
 ORDER BY d.device_id LIMIT 501`;
const eligible=(r:Row)=>![r.payments,r.certificates,r.training,r.content,r.shared].some(Boolean);
const snapshot=(rows:Row[])=>hash(rows.map(r=>[
 r.device_id,r.name,r.role,r.created_at,r.updated_at,r.status,r.account_id,r.revision,r.legacy_key,
 r.payments,r.certificates,r.training,r.content,r.shared
]));
async function manifest(db:DB){
 return db.prepare("SELECT protected_thien_son,protected_dong_nghi,protected_quynh,cutoff_at,backup_bookmark_hash,state,revision,removed FROM account_one_time_roster_resets WHERE id=?")
  .bind(ID).first<Manifest>();
}
async function cutoff(db:DB){
 const time=await db.prepare("SELECT datetime('now') AS at").first<{at:string}>();
 const at=time?.at;
 if(typeof at==="string"&&/^20\d\d-\d\d-\d\d \d\d:\d\d:\d\d$/.test(at))return at;
 throw new AccountError("ROSTER_RESET_CLOCK_UNAVAILABLE",503);
}
async function rowsAt(db:DB,at:string){
 const result=await db.prepare(select).bind(at).all<Row>();
 if(!Array.isArray(result.results))fail("ROSTER_RESET_READ_UNAVAILABLE",503);
 if(result.results.length>500)fail("ROSTER_RESET_ROSTER_LIMIT",409);
 return result.results;
}
function protectedPair(rows:Row[]){
 const son=rows.filter(r=>fold(r.name)===WORDS.son);
 const nghi=rows.filter(r=>fold(r.name)===WORDS.nghi);
 const quynh=rows.filter(r=>fold(r.name)===WORDS.quynh);
 if(son.length!==1||nghi.length!==1||quynh.length!==1||
  new Set([son[0].device_id,nghi[0].device_id,quynh[0].device_id]).size!==3||
  !son[0].account_id?.startsWith(PREFIX.son)||
  !nghi[0].account_id?.startsWith(PREFIX.nghi)||
  !quynh[0].account_id?.startsWith(PREFIX.quynh)||
  son[0].role!=="learner"||nghi[0].role!=="teacher"||quynh[0].role!=="learner")
  fail("ROSTER_RESET_PROTECTED_AMBIGUOUS",409);
 return {son:son[0],nghi:nghi[0],quynh:quynh[0]};
}
function roster(rows:Row[],pair:ReturnType<typeof protectedPair>){
 const candidates=rows.filter(r=>r.device_id!==pair.son.device_id&&r.device_id!==pair.nghi.device_id&&r.device_id!==pair.quynh.device_id);
 return {candidates,ready:candidates.filter(eligible),held:candidates.filter(r=>!eligible(r))};
}
export async function previewOwnerOnceRosterReset(db:DB,actor:Owner){
 owner(actor);
 const started=await manifest(db);
 const at=started?.cutoff_at??await cutoff(db);
 const rows=await rowsAt(db,at);
 const pair=protectedPair(rows);
 if(started&&(started.protected_thien_son!==pair.son.device_id||
  started.protected_dong_nghi!==pair.nghi.device_id||started.protected_quynh!==pair.quynh.device_id))fail("ROSTER_RESET_PROTECTION_CHANGED",409);
 const {candidates,ready,held}=roster(rows,pair);
 return {contract:"boi-owner-once-roster-reset.v1",verified:true,applied:false,
  state:started?.state??"not_started",cutoff:at,snapshot:snapshot(rows),
  protectedPeople:[
   {name:pair.son.name,role:pair.son.role,deviceId:pair.son.device_id,accountId:pair.son.account_id},
   {name:pair.nghi.name,role:pair.nghi.role,deviceId:pair.nghi.device_id,accountId:pair.nghi.account_id},
   {name:pair.quynh.name,role:pair.quynh.role,deviceId:pair.quynh.device_id,accountId:pair.quynh.account_id}
  ],
  totalLearnersTeachers:rows.length,
  candidates:candidates.length,eligible:ready.length,retainedForReview:held.length,
  blockers:{payment:held.filter(r=>r.payments).length,
   certificates:held.filter(r=>r.certificates).length,
   training:held.filter(r=>r.training).length,
   authoredContent:held.filter(r=>r.content).length,
   sharedLegacy:held.filter(r=>r.shared).length},
  removedInSession:started?.removed??0,batchSize:Math.min(10,ready.length)
 };
}
const guard=`EXISTS(SELECT 1 FROM device_access d
 LEFT JOIN accounts a ON a.storage_device_id=d.device_id
 WHERE d.device_id=? AND d.person_role IN ('learner','teacher')
 AND d.device_id NOT IN (?,?,?) AND d.created_at=? AND d.updated_at IS ?
 AND d.status=? AND COALESCE(d.learner_name,'')=?
 AND COALESCE(a.account_id,'')=? AND COALESCE(a.revision,-1)=?
 AND datetime(d.created_at)<=datetime(?)
 AND NOT(d.payment_status='paid_verified' OR d.payment_proof_key IS NOT NULL
  OR EXISTS(SELECT 1 FROM payment_reviews p WHERE p.device_id=d.device_id)
  OR EXISTS(SELECT 1 FROM course_certificates c WHERE c.device_id=d.device_id)
  OR EXISTS(SELECT 1 FROM training_sessions t WHERE t.teacher_id=d.device_id)
  OR EXISTS(SELECT 1 FROM training_commands t WHERE t.actor_id=d.device_id)
  OR EXISTS(SELECT 1 FROM course_content_versions v
    WHERE v.created_by IN (d.device_id,a.account_id) OR v.editor_device_id=d.device_id)
  OR EXISTS(SELECT 1 FROM content_editor_devices c WHERE c.device_id=d.device_id)
  OR (d.migrated_from_user_key IS NOT NULL AND EXISTS(SELECT 1 FROM device_access other
    WHERE other.device_id<>d.device_id AND other.migrated_from_user_key=d.migrated_from_user_key)))
 AND EXISTS(SELECT 1 FROM account_one_time_roster_resets r
  WHERE r.id='2026-11-13-learner-teacher-reset' AND r.state='running'
   AND r.protected_thien_son=? AND r.protected_dong_nghi=? AND r.protected_quynh=?)
 AND EXISTS(SELECT 1 FROM device_access p WHERE p.device_id=? AND p.person_role IN ('learner','teacher'))
 AND EXISTS(SELECT 1 FROM device_access p WHERE p.device_id=? AND p.person_role IN ('learner','teacher'))
 AND EXISTS(SELECT 1 FROM device_access p WHERE p.device_id=? AND p.person_role IN ('learner','teacher'))
)`;
export async function executeOwnerOnceRosterReset(db:DB,actor:Owner,input:Record<string,unknown>){
 owner(actor);
 const reason=typeof input.reason==="string"?input.reason.trim():"";
 const backup=typeof input.backupBookmark==="string"?input.backupBookmark:"";
 const at=typeof input.cutoff==="string"?input.cutoff:"";
 if(input.confirmation!==CONFIRM||reason.length<10||reason.length>300
 ||typeof input.snapshot!=="string"||!/^[a-f0-9]{64}$/.test(input.snapshot)
 ||!/^20\d\d-\d\d-\d\d \d\d:\d\d:\d\d$/.test(at)
 ||!/^([a-f0-9]{8}-){3}[a-f0-9]{32}$/i.test(backup))
 fail("ROSTER_RESET_CONFIRMATION_REQUIRED",400);
 const existing=await manifest(db);
 if(existing&&existing.state!=="running")fail("ROSTER_RESET_ALREADY_FINALIZED",409);
 if(existing&&existing.cutoff_at!==at)fail("ROSTER_RESET_SCOPE_CHANGED",409);
 if(existing&&existing.backup_bookmark_hash!==hash(backup))
  fail("ROSTER_RESET_BACKUP_MISMATCH",409);
 const rows=await rowsAt(db,at),pair=protectedPair(rows);
 if(existing&&(existing.protected_thien_son!==pair.son.device_id||
 existing.protected_dong_nghi!==pair.nghi.device_id||
 existing.protected_quynh!==pair.quynh.device_id))fail("ROSTER_RESET_PROTECTION_CHANGED",409);
 if(input.protectSon!==pair.son.device_id||input.protectNghi!==pair.nghi.device_id||input.protectQuynh!==pair.quynh.device_id)
  fail("ROSTER_RESET_PROTECTION_CHANGED",409);
 if(snapshot(rows)!==input.snapshot)fail("ROSTER_RESET_SCOPE_CHANGED",409);
 const {ready,held}=roster(rows,pair),batch=ready.slice(0,10);
 const final=batch.length===ready.length;
 const state=final?(held.length?"retention_review":"completed"):"running";
 const updates:D1PreparedStatement[]=[];
 if(!existing)updates.push(db.prepare(`INSERT INTO account_one_time_roster_resets
 (id,protected_thien_son,protected_dong_nghi,protected_quynh,cutoff_at,backup_bookmark_hash,started_by)
 VALUES(?,?,?,?,?,?,?)`).bind(ID,pair.son.device_id,pair.nghi.device_id,pair.quynh.device_id,at,hash(backup),actor.actor));
 for(const row of batch){
  const id=row.device_id,a=row.account_id;
  const insert=db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
   VALUES(?,'owner.once.roster-reset',?,CASE WHEN ${guard} THEN ? ELSE NULL END)`)
   .bind(actor.actor,hash(["one-time",id]),
    id,pair.son.device_id,pair.nghi.device_id,pair.quynh.device_id,row.created_at,row.updated_at,row.status,
    row.name??"",a??"",row.revision??-1,at,
    pair.son.device_id,pair.nghi.device_id,pair.quynh.device_id,pair.son.device_id,pair.nghi.device_id,pair.quynh.device_id,
    `one-time-excluding-three;role=${row.role};backup=${hash(backup).slice(0,12)};${reason}`);
  updates.push(insert);
  const del=(table:string,where:string,...values:(string|null)[])=>
   updates.push(db.prepare(`DELETE FROM ${table} WHERE ${where}`).bind(...values));
  // Manifests and immutable audit remain. All deletions are one D1 transaction.
  del("account_sync_events","account_id=?",a);
  del("account_sync_records","account_id=?",a);
  del("account_sync_grants","account_id=?",a);
  del("account_sessions","account_id=?",a);
  del("account_devices","account_id=?",a);
  del("account_manager_permissions","account_id=?",a);
  del("account_entitlements","account_id=?",a);
  del("account_contacts","account_id=?",a);
  del("account_recovery_questions","account_id=?",a);
  del("account_profile_drafts","account_id=?",a);
  del("account_ui_trials","account_id=?",a);
  del("account_manager_profiles","account_id=?",a);
  del("account_onboarding","account_id=?",a);
  del("account_credentials","account_id=?",a);
  del("accounts","account_id=?",a);
  del("manager_device_assignments","target_device_id=?",id);
  del("ai_feedback","device_id=? OR interaction_id IN (SELECT id FROM ai_interactions WHERE subject_id IN (?,?))",id,id,a);
  del("ai_quiz_sessions","device_id=?",id);
  del("learner_self_assessments","device_id=?",id);
  del("ai_device_controls","device_id=?",id);
  del("ai_interactions","subject_id IN (?,?)",id,a);
  del("course_activity_events","device_id=?",id);
  del("device_challenges","device_id=?",id);
  del("device_profiles","device_id=?",id);
  del("course_profiles","user_key=?",row.legacy_key);
  del("device_access","device_id=?",id);
 }
 // Manifest is an append-only one-time authority; revision CAS prevents two
 // Owner sessions from running overlapping batches.
 updates.push(db.prepare(`UPDATE account_one_time_roster_resets SET
 state=?,removed=removed+?,revision=revision+1,
 finished_at=CASE WHEN ?='running' THEN NULL ELSE CURRENT_TIMESTAMP END
 WHERE id=? AND state='running' AND revision=?
 AND protected_thien_son=? AND protected_dong_nghi=? AND protected_quynh=?`)
 .bind(state,batch.length,state,ID,existing?.revision??1,pair.son.device_id,pair.nghi.device_id,pair.quynh.device_id));
 updates.push(db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
 VALUES(?,'owner.once.roster-batch',?,
  CASE WHEN changes()=1 THEN ? ELSE NULL END)`)
 .bind(actor.actor,hash([ID,at,existing?.revision??1]),
  `removed=${batch.length};retention=${held.length};status=${state}`));
 const results=await db.batch(updates).catch(()=>fail("ROSTER_RESET_WRITE_CONFLICT",409));
 if(Number(results[results.length-2]?.meta.changes)!==1)
  fail("ROSTER_RESET_READBACK_FAILED",503);
 const ids=batch.map(x=>x.device_id);
 if(ids.length){
  const leftover=await db.prepare(`SELECT COUNT(*) AS n FROM device_access WHERE device_id IN (${ids.map(()=>"?").join(",")})`)
   .bind(...ids).first<{n:number}>();
  if(Number(leftover?.n)!==0)fail("ROSTER_RESET_READBACK_FAILED",503);
 }
 const preserved=await db.prepare("SELECT COUNT(*) AS n FROM device_access WHERE device_id IN (?,?,?)")
  .bind(pair.son.device_id,pair.nghi.device_id,pair.quynh.device_id).first<{n:number}>();
 if(Number(preserved?.n)!==3)fail("ROSTER_RESET_PROTECTION_CHANGED",503);
 const latest=await previewOwnerOnceRosterReset(db,actor);
 return {contract:latest.contract,verified:true,applied:true,state:latest.state,
  deleted:batch.length,totalDeleted:latest.removedInSession,remaining:latest.eligible,
  retainedForReview:latest.retainedForReview,protectedCount:3,readback:true,
  snapshot:latest.snapshot,cutoff:latest.cutoff};
}
