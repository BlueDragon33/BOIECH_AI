import {createHash} from "node:crypto";
import {AccountError} from "./account-core.server";
import type {getCourseDatabase} from "./device-auth.server";
type DB=Awaited<ReturnType<typeof getCourseDatabase>>;
type Actor={actor:string;role:string};
type Mode="pending"|"inactive"|"both"|"manager";
type Row={
 account_id:string;login:string|null;account_created_at:string;revision:number;
 storage_device_id:string;person_role:string|null;person_name:string|null;
 payment_status:string|null;payment_proof_key:string|null;
 access_status:string;last_seen_at:string|null;stage:string|null;
 latest_login_ms:number|null;active_sessions:number;
 sync_records:number;sync_events:number;activity_events:number;payments:number;certificates:number;
 ai_quizzes:number;ai_feedback:number;ai_interactions:number;assessments:number;
 content_editor_devices:number;authored_editor_versions:number;legacy_profile_links:number;
 training_sessions:number;training_commands:number;manager_assignments:number;content_versions:number;
 total_seconds:number|null;completed_json:string|null;scores_json:string|null;attempts_json:string|null;
};
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const deny=(code:string,status=409):never=>{throw new AccountError(code,status);};
function guardOwner(actor:Actor){
 if(actor.role!=="owner"||typeof actor.actor!=="string"||!actor.actor.includes("@"))
  throw new AccountError("OWNER_REQUIRED",403);
}
function criteria(input:Record<string,unknown>){
 const days=Number(input.days);
 const mode=input.mode;
 if(!([3,5,7,8].includes(days)&&["pending","inactive","both"].includes(String(mode))
   &&!(days===0&&mode==="manager"))
  throw new AccountError("CLEANUP_INPUT",400);
 return {days,mode:mode as Mode};
}
function time(value:unknown){
 if(typeof value!=="string"||!value.trim())return 0;
 const d=Date.parse(value.includes("T")?value:value.replace(" ","T")+"Z");
 return Number.isFinite(d)?d:0;
}
const snapshot=(row:Row,options:{days:number;mode:Mode})=>sha([
 row.account_id,row.account_created_at,row.revision,row.last_seen_at,row.latest_login_ms,
 row.access_status,row.stage,options.days,options.mode
]);
const query=`SELECT a.account_id,a.login,a.created_at AS account_created_at,a.revision,
 a.storage_device_id,d.person_role,d.learner_name AS person_name,
 d.payment_status,d.payment_proof_key,
 d.status AS access_status,d.last_seen_at,o.stage,
 (SELECT MAX(COALESCE(NULLIF(s.issued_at_ms,0),s.expires_at-28800000))
  FROM account_sessions s WHERE s.account_id=a.account_id) AS latest_login_ms,
 (SELECT COUNT(*) FROM account_sessions s WHERE s.account_id=a.account_id
  AND s.revoked=0 AND s.expires_at>? AND s.idle_expires_at>?) AS active_sessions,
 (SELECT COUNT(*) FROM account_sync_records r WHERE r.account_id=a.account_id) AS sync_records,
 (SELECT COUNT(*) FROM account_sync_events e WHERE e.account_id=a.account_id) AS sync_events,
 (SELECT COUNT(*) FROM course_activity_events e WHERE e.device_id=a.storage_device_id) AS activity_events,
 (SELECT COUNT(*) FROM payment_reviews p WHERE p.device_id=a.storage_device_id) AS payments,
 (SELECT COUNT(*) FROM course_certificates c WHERE c.device_id=a.storage_device_id) AS certificates,
 (SELECT COUNT(*) FROM ai_quiz_sessions q WHERE q.device_id=a.storage_device_id) AS ai_quizzes,
 (SELECT COUNT(*) FROM ai_feedback f WHERE f.device_id=a.storage_device_id) AS ai_feedback,
 (SELECT COUNT(*) FROM ai_interactions i WHERE i.subject_id IN (a.account_id,a.storage_device_id)) AS ai_interactions,
 (SELECT COUNT(*) FROM learner_self_assessments l WHERE l.device_id=a.storage_device_id) AS assessments,
 (SELECT COUNT(*) FROM training_sessions t WHERE t.teacher_id=a.storage_device_id) AS training_sessions,
 (SELECT COUNT(*) FROM training_commands t WHERE t.actor_id=a.storage_device_id) AS training_commands,
 (SELECT COUNT(*) FROM manager_device_assignments m
  WHERE m.target_device_id=a.storage_device_id OR m.manager_device_id=a.storage_device_id) AS manager_assignments,
 (SELECT COUNT(*) FROM course_content_versions c
  WHERE c.created_by IN (a.account_id,a.storage_device_id)) AS content_versions,
 (SELECT COUNT(*) FROM course_content_versions c WHERE c.editor_device_id=a.storage_device_id) AS authored_editor_versions,
 (SELECT COUNT(*) FROM content_editor_devices c WHERE c.device_id=a.storage_device_id) AS content_editor_devices,
 (SELECT COUNT(*) FROM course_profiles p WHERE p.device_hash=a.storage_device_id) AS legacy_profile_links,
 p.total_active_seconds AS total_seconds,p.completed_json,p.scores_json,p.attempts_json
 FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
 LEFT JOIN account_onboarding o ON o.account_id=a.account_id
 LEFT JOIN device_profiles p ON p.device_id=a.storage_device_id
 WHERE a.account_id>? ORDER BY a.account_id LIMIT 101`;
const managerQuery=query.replace("WHERE a.account_id>? ORDER BY a.account_id LIMIT 101",
 "WHERE d.person_role='manager' AND a.account_id>? ORDER BY a.account_id LIMIT 101");
const dataBlockers=(r:Row):string[]=>{
 const result:string[]=[];
 if(Number(r.active_sessions)>0)result.push("Phiên đăng nhập còn hiệu lực");
 if(Number(r.sync_records)>0||Number(r.sync_events)>0)result.push("Có dữ liệu học tập/đồng bộ");
 if(Number(r.activity_events)>0||Number(r.total_seconds)>0||
  !["[]","",null].includes(r.completed_json)||!["{}","",null].includes(r.scores_json)||
  !["{}","",null].includes(r.attempts_json))result.push("Đã có tiến độ học");
 if(Number(r.payments)>0||r.payment_status==="paid_verified"||r.payment_proof_key)
  result.push("Có lịch sử thanh toán");
 if(Number(r.certificates)>0)result.push("Đã có chứng nhận");
 if(Number(r.ai_quizzes)>0||Number(r.ai_feedback)>0||Number(r.ai_interactions)>0||
  Number(r.assessments)>0)result.push("Có lịch sử AI/đánh giá");
 if(Number(r.training_sessions)>0||Number(r.training_commands)>0||
  Number(r.manager_assignments)>0)result.push("Có phân công/lịch đào tạo");
 if(Number(r.content_versions)>0||Number(r.authored_editor_versions)>0||Number(r.content_editor_devices)>0)
  result.push("Có nội dung giảng dạy đã tạo");
 if(Number(r.legacy_profile_links)>0)result.push("Có hồ sơ học tập cũ gắn thiết bị");
 return result;
};
function check(r:Row,options:{days:number;mode:Mode},now:number){
 const created=time(r.account_created_at);
 const lastSeen=time(r.last_seen_at);
 const lastLogin=Number(r.latest_login_ms)||0;
 const lastActivity=Math.max(created,lastSeen,lastLogin);
 const pending=r.access_status==="pending"&&
  ["requested","profile_required","profile_review","changes_requested"].includes(r.stage||"");
 const inactive=r.access_status==="approved"&&["active","suspended"].includes(r.stage||"");
 const manager=r.person_role==="manager"&&["pending","blocked"].includes(r.access_status)
   &&(r.access_status==="blocked"||
     ["requested","profile_required","profile_review","changes_requested"].includes(r.stage||""));
 const category=options.mode==="manager"?(manager?"manager":null)
   :pending?"pending":inactive?"inactive":null;
 const categoryAllowed=category&&(options.mode==="both"||category===options.mode);
 const tooRecent=options.mode==="manager"?false:
   lastActivity===0||(options.days===8 ? now-lastActivity<=7*86400000 : now-lastActivity<options.days*86400000);
 const blockers=dataBlockers(r);
 if(!categoryAllowed||tooRecent)return null;
 return {accountId:r.account_id,name:r.person_name||r.login||"Chưa khai báo",
  role:r.person_role,category,createdAt:r.account_created_at,
  lastSeenAt:r.last_seen_at,latestLoginAt:lastLogin?new Date(lastLogin).toISOString():null,
  inactiveDays:Math.floor((now-lastActivity)/86400000),stage:r.stage,
  eligible:blockers.length===0,blockers,snapshot:snapshot(r,options)};
}
export async function inspectCleanup(db:DB,actor:Actor,input:Record<string,unknown>,
 now=Date.now()){
 guardOwner(actor);
 const options=criteria(input);
 const cursor=typeof input.cursor==="string"?input.cursor:"";
 if(cursor&&!/^acc_[a-f0-9]{64}$/.test(cursor))throw new AccountError("CLEANUP_INPUT",400);
 const all=await db.prepare(options.mode==="manager"?managerQuery:query)
  .bind(now,now,cursor).all<Row>();
 if(!Array.isArray(all.results))throw new AccountError("CLEANUP_READ_UNAVAILABLE",503);
 const records=all.results.slice(0,100).map(r=>check(r,options,now))
  .filter((x):x is NonNullable<typeof x>=>x!==null);
 return {ok:true,verified:true,contract:options.mode==="manager"
   ?"boi-owner-manager-purge.v1":"boi-owner-account-cleanup.v1",
  days:options.days,mode:options.mode,records,
  hasMore:all.results.length>100,
  nextCursor:all.results.length>100?all.results[99].account_id:null,
  scanned:Math.min(100,all.results.length),eligible:records.filter(r=>r.eligible).length,
  protected:records.filter(r=>!r.eligible).length,
  warning:options.mode==="manager"
   ?"Chỉ Owner mới được xóa hồ sơ quản lý chưa kích hoạt hoặc đã khóa, không có dữ liệu và không còn phiên hoạt động. Một tài khoản mỗi lần; không xóa tự động. Lưu nhật ký kiểm toán phi cá nhân."
   :"Chỉ quét 100 tài khoản mỗi trang; không tự động xóa. Lịch sử kiểm toán được giữ lại."};
}
export async function purgeCleanupAccount(db:DB,actor:Actor,input:Record<string,unknown>,
 now=Date.now()){
 guardOwner(actor);
 const options=criteria(input),id=input.accountId,expected=input.snapshot;
 if(typeof id!=="string"||!/^acc_[a-f0-9]{64}$/.test(id)||
  typeof expected!=="string"||!/^[a-f0-9]{64}$/.test(expected)||
  input.confirmation!=="XOA TAI KHOAN"||
  typeof input.reason!=="string"||input.reason.trim().length<10||input.reason.length>300)
  throw new AccountError("CLEANUP_CONFIRMATION_REQUIRED",400);
 const r=await db.prepare(query.replace("WHERE a.account_id>? ORDER BY a.account_id LIMIT 101",
  "WHERE a.account_id=? ORDER BY a.account_id LIMIT 101"))
  .bind(now,now,id).first<Row>();
 if(!r)throw new AccountError("CLEANUP_NOT_FOUND",404);
 const result=check(r,options,now);
 if(!result||!result.eligible||expected!==result.snapshot)
  throw new AccountError("CLEANUP_ELIGIBILITY_CHANGED",409);
 // SQLite D1 batch is one transaction. Guard status, revision, lastSeen,
 // newest session and protected dependencies before deleting any personal data.
 // If anything changes the NOT NULL audit purpose aborts the entire batch.
 const managerGuard=options.mode==="manager"
   ?`AND d.person_role='manager' AND d.status IN ('pending','blocked')
      AND (d.status='blocked' OR o.stage IN ('requested','profile_required','profile_review','changes_requested'))`
   :"";
 const eligibleGuard=`EXISTS(SELECT 1 FROM accounts a JOIN device_access d
   ON d.device_id=a.storage_device_id JOIN account_onboarding o ON o.account_id=a.account_id
   WHERE a.account_id=? AND a.revision=? AND a.created_at=?
     AND d.last_seen_at IS ? AND d.status=? AND o.stage=? ${managerGuard}
     AND COALESCE((SELECT MAX(COALESCE(NULLIF(issued_at_ms,0),expires_at-28800000))
        FROM account_sessions WHERE account_id=a.account_id),0)=?
     AND NOT EXISTS(SELECT 1 FROM account_sessions WHERE account_id=a.account_id
        AND revoked=0 AND expires_at>? AND idle_expires_at>?)
     AND NOT EXISTS(SELECT 1 FROM account_sync_records WHERE account_id=a.account_id)
     AND NOT EXISTS(SELECT 1 FROM account_sync_events WHERE account_id=a.account_id)
     AND NOT EXISTS(SELECT 1 FROM course_activity_events WHERE device_id=a.storage_device_id)
     AND NOT EXISTS(SELECT 1 FROM payment_reviews WHERE device_id=a.storage_device_id)
     AND d.payment_status IS NOT 'paid_verified' AND d.payment_proof_key IS NULL
     AND NOT EXISTS(SELECT 1 FROM course_certificates WHERE device_id=a.storage_device_id)
     AND NOT EXISTS(SELECT 1 FROM ai_quiz_sessions WHERE device_id=a.storage_device_id)
     AND NOT EXISTS(SELECT 1 FROM ai_feedback WHERE device_id=a.storage_device_id)
     AND NOT EXISTS(SELECT 1 FROM ai_interactions
       WHERE subject_id=a.storage_device_id OR subject_id=a.account_id)
     AND NOT EXISTS(SELECT 1 FROM learner_self_assessments WHERE device_id=a.storage_device_id)
     AND NOT EXISTS(SELECT 1 FROM training_sessions WHERE teacher_id=a.storage_device_id)
     AND NOT EXISTS(SELECT 1 FROM training_commands WHERE actor_id=a.storage_device_id)
     AND NOT EXISTS(SELECT 1 FROM manager_device_assignments
       WHERE target_device_id=a.storage_device_id OR manager_device_id=a.storage_device_id)
     AND NOT EXISTS(SELECT 1 FROM course_content_versions
       WHERE created_by=a.storage_device_id OR created_by=a.account_id OR editor_device_id=a.storage_device_id)
     AND NOT EXISTS(SELECT 1 FROM content_editor_devices WHERE device_id=a.storage_device_id)
     AND NOT EXISTS(SELECT 1 FROM course_profiles WHERE device_hash=a.storage_device_id)
     AND NOT EXISTS(SELECT 1 FROM device_profiles WHERE device_id=a.storage_device_id
       AND (total_active_seconds>0 OR completed_json<>'[]' OR scores_json<>'{}' OR attempts_json<>'{}')))`;
 const storage=r.storage_device_id;
 const statement=[
 db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
  SELECT ?,'owner.account.cleanup-purge',?,CASE WHEN ${eligibleGuard} THEN ? ELSE NULL END`)
 .bind(actor.actor,sha(id),id,r.revision,r.account_created_at,r.last_seen_at,
  r.access_status,r.stage,Number(r.latest_login_ms)||0,now,now,
  `age=${options.days};mode=${options.mode};${input.reason.trim()}`),
 db.prepare("UPDATE account_manager_invitations SET consumed_by=NULL,consumed_at_ms=NULL,revoked_at_ms=?,revision=revision+1 WHERE consumed_by=?").bind(now,id),
 db.prepare("DELETE FROM account_sync_grants WHERE account_id=?").bind(id),
 db.prepare("DELETE FROM account_sessions WHERE account_id=?").bind(id),
 db.prepare("DELETE FROM account_devices WHERE account_id=?").bind(id),
 db.prepare("DELETE FROM account_manager_permissions WHERE account_id=?").bind(id),
 db.prepare("DELETE FROM account_entitlements WHERE account_id=?").bind(id),
 db.prepare("DELETE FROM account_contacts WHERE account_id=?").bind(id),
 db.prepare("DELETE FROM account_recovery_questions WHERE account_id=?").bind(id),
 db.prepare("DELETE FROM account_profile_drafts WHERE account_id=?").bind(id),
 db.prepare("DELETE FROM account_ui_trials WHERE account_id=?").bind(id),
 db.prepare("DELETE FROM account_manager_profiles WHERE account_id=?").bind(id),
 db.prepare("DELETE FROM account_onboarding WHERE account_id=?").bind(id),
 db.prepare("DELETE FROM account_credentials WHERE account_id=?").bind(id),
 db.prepare("DELETE FROM accounts WHERE account_id=? AND revision=?").bind(id,r.revision),
 db.prepare("DELETE FROM device_challenges WHERE device_id=?").bind(storage),
 db.prepare("DELETE FROM ai_device_controls WHERE device_id=?").bind(storage),
 db.prepare("DELETE FROM device_profiles WHERE device_id=?").bind(storage),
 db.prepare("DELETE FROM device_access WHERE device_id=?").bind(storage),
 ];
 const results=await db.batch(statement).catch(()=>{throw new AccountError("CLEANUP_ELIGIBILITY_CHANGED",409);});
 if(Number(results[0].meta.changes)!==1||Number(results[14].meta.changes)!==1||
   Number(results[18].meta.changes)!==1)deny("CLEANUP_READBACK_FAILED",503);
 const [account,device]=await Promise.all([
  db.prepare("SELECT account_id FROM accounts WHERE account_id=?").bind(id).first(),
  db.prepare("SELECT device_id FROM device_access WHERE device_id=?").bind(storage).first()
 ]);
 if(account||device)deny("CLEANUP_READBACK_FAILED",503);
 return {ok:true,verified:true,contract:options.mode==="manager"
   ?"boi-owner-manager-purge.v1":"boi-owner-account-cleanup.v1",
  action:"purge",deleted:true,accountHash:sha(id),auditPreserved:true};
}

/** Minimal independent post-mutation readback, avoids paging/filter false-negatives. */
export async function inspectCleanupAccount(db:DB,actor:Actor,input:Record<string,unknown>){
 guardOwner(actor);
 const id=input.accountId;
 if(typeof id!=="string"||!/^acc_[a-f0-9]{64}$/.test(id))
  throw new AccountError("CLEANUP_INPUT",400);
 const row=await db.prepare("SELECT account_id FROM accounts WHERE account_id=?")
  .bind(id).first<{account_id:string}>();
 return {contract:"boi-owner-account-cleanup.v1",verified:true,
  action:"inspect",exists:Boolean(row),accountHash:sha(id)};
}
