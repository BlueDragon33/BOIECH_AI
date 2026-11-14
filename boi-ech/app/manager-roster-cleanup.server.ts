import {createHash} from "node:crypto";
import type {D1Database} from "@cloudflare/workers-types";
import {DeviceAccessError, type PublicDeviceState} from "./device-auth.server";
import {requireManager,trainingDatabase} from "./training-management.server";

const LIMIT=100;
const sha=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const deny=(code:string,message:string,status=409):never=>{throw new DeviceAccessError(message,status,code);};
type Row={
 device_id:string;person_role:string;learner_name:string|null;class_name:string|null;
 status:string;created_at:string;last_seen_at:string|null;approved_at:string|null;
 registration_submitted_at:string|null;migrated_from_user_key:string|null;
 linked_accounts:number;payment_status:string|null;payment_proof_key:string|null;
 payments:number;certificates:number;activities:number;ai_quizzes:number;ai_feedback:number;
 ai_interactions:number;assessments:number;training_sessions:number;training_commands:number;
 assignments:number;content_versions:number;editors:number;controls:number;legacy_profile_links:number;
 total_seconds:number|null;completed_json:string|null;scores_json:string|null;attempts_json:string|null;
};
type DB=D1Database;
type Criteria={days:7|14|30};
const daysValue=(input:Record<string,unknown>):Criteria=>{
 if(input.days!==7&&input.days!==14&&input.days!==30)deny("ROSTER_CLEANUP_INPUT","Chọn thời gian 7, 14 hoặc 30 ngày.",400);
 return {days:input.days as Criteria["days"]};
};
const when=(s:string|null):number=>{
 if(!s)return 0;
 const ms=Date.parse(s.includes("T")?s:s.replace(" ","T")+"Z");
 return Number.isFinite(ms)?ms:0;
};
const protectedData=`(
 d.payment_status='paid_verified' OR d.payment_proof_key IS NOT NULL
 OR EXISTS(SELECT 1 FROM accounts a WHERE a.storage_device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM payment_reviews v WHERE v.device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM course_certificates v WHERE v.device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM course_activity_events v WHERE v.device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM ai_quiz_sessions v WHERE v.device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM ai_feedback v WHERE v.device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM ai_interactions v WHERE v.subject_id=d.device_id)
 OR EXISTS(SELECT 1 FROM learner_self_assessments v WHERE v.device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM training_sessions v WHERE v.teacher_id=d.device_id)
 OR EXISTS(SELECT 1 FROM training_commands v WHERE v.actor_id=d.device_id)
 OR EXISTS(SELECT 1 FROM manager_device_assignments v WHERE v.target_device_id=d.device_id OR v.manager_device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM course_content_versions v WHERE v.created_by=d.device_id OR v.editor_device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM content_editor_devices v WHERE v.device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM ai_device_controls v WHERE v.device_id=d.device_id)
 OR EXISTS(SELECT 1 FROM course_profiles cp WHERE cp.device_hash=d.device_id)
 OR EXISTS(SELECT 1 FROM device_profiles p WHERE p.device_id=d.device_id
   AND (COALESCE(p.total_active_seconds,0)>0 OR COALESCE(p.completed_json,'[]')<>'[]'
     OR COALESCE(p.scores_json,'{}')<>'{}' OR COALESCE(p.attempts_json,'{}')<>'{}'))
)`;
const query=`SELECT d.device_id,d.person_role,d.learner_name,d.class_name,d.status,d.created_at,
 d.last_seen_at,d.approved_at,d.registration_submitted_at,d.migrated_from_user_key,
 d.payment_status,d.payment_proof_key,
 (SELECT COUNT(*) FROM accounts a WHERE a.storage_device_id=d.device_id) linked_accounts,
 (SELECT COUNT(*) FROM payment_reviews v WHERE v.device_id=d.device_id) payments,
 (SELECT COUNT(*) FROM course_certificates v WHERE v.device_id=d.device_id) certificates,
 (SELECT COUNT(*) FROM course_activity_events v WHERE v.device_id=d.device_id) activities,
 (SELECT COUNT(*) FROM ai_quiz_sessions v WHERE v.device_id=d.device_id) ai_quizzes,
 (SELECT COUNT(*) FROM ai_feedback v WHERE v.device_id=d.device_id) ai_feedback,
 (SELECT COUNT(*) FROM ai_interactions v WHERE v.subject_id=d.device_id) ai_interactions,
 (SELECT COUNT(*) FROM learner_self_assessments v WHERE v.device_id=d.device_id) assessments,
 (SELECT COUNT(*) FROM training_sessions v WHERE v.teacher_id=d.device_id) training_sessions,
 (SELECT COUNT(*) FROM training_commands v WHERE v.actor_id=d.device_id) training_commands,
 (SELECT COUNT(*) FROM manager_device_assignments v WHERE v.target_device_id=d.device_id OR v.manager_device_id=d.device_id) assignments,
 (SELECT COUNT(*) FROM course_content_versions v WHERE v.created_by=d.device_id OR v.editor_device_id=d.device_id) content_versions,
 (SELECT COUNT(*) FROM content_editor_devices v WHERE v.device_id=d.device_id) editors,
 (SELECT COUNT(*) FROM ai_device_controls v WHERE v.device_id=d.device_id) controls,
 (SELECT COUNT(*) FROM course_profiles cp WHERE cp.device_hash=d.device_id) legacy_profile_links,
 p.total_active_seconds AS total_seconds,p.completed_json,p.scores_json,p.attempts_json
 FROM device_access d LEFT JOIN device_profiles p ON p.device_id=d.device_id
 WHERE d.person_role IN ('learner','teacher') AND d.device_id>?
 ORDER BY d.device_id LIMIT 101`;
async function requireAccountManager(actor:PublicDeviceState) {
 requireManager(actor);
 // No legacy/anonymous device is ever authorized to destroy a roster record.
 if(!actor.accountId)deny("MANAGER_ACCOUNT_REQUIRED","Cần tài khoản cán bộ đã xác minh.",403);
 const runtime=await import("./account-runtime.server");
 const service=await runtime.accountService();
 const principal=await service.authorize(await runtime.accountCookieToken());
 if(principal.accountId!==actor.accountId)
  deny("MANAGER_ACCOUNT_MISMATCH","Phiên đăng nhập không khớp cán bộ.",403);
 await service.capability(principal,"manager.manage.assigned");
 return {accountId:principal.accountId,sessionHash:principal.sessionHash};
}
const reasons=(r:Row,days:number,now:number)=>{
 const why:string[]=[];
 if(Number(r.linked_accounts)>0)why.push("Đã liên kết tài khoản Account-first · Owner quản lý");
 if(r.status!=="pending"&&r.status!=="blocked")why.push("Hồ sơ đã được duyệt hoặc đang sử dụng");
 if(r.approved_at)why.push("Từng được duyệt; cần Owner đối chiếu");
 if(r.migrated_from_user_key)why.push("Gắn hồ sơ lịch sử, cần Owner kiểm toán");
 const last=Math.max(when(r.created_at),when(r.last_seen_at),when(r.registration_submitted_at),when(r.approved_at));
 if(!last||now-last<days*86400000)why.push("Chưa đủ "+days+" ngày không hoạt động");
 if(r.payment_status==="paid_verified"||r.payment_proof_key||r.payments)why.push("Có giao dịch/thanh toán");
 if(r.certificates)why.push("Có chứng nhận");
 if(r.activities||Number(r.total_seconds)>0||!["[]","",null].includes(r.completed_json)
   ||!["{}","",null].includes(r.scores_json)||!["{}","",null].includes(r.attempts_json))
  why.push("Có tiến độ học tập");
 if(r.ai_quizzes||r.ai_feedback||r.ai_interactions||r.assessments)why.push("Có dữ liệu AI/đánh giá");
 if(r.training_sessions||r.training_commands||r.assignments||r.content_versions||r.editors)
  why.push("Có lịch học, phân công hoặc nội dung");
 if(r.controls)why.push("Có cấu hình thiết bị cần giữ");
 if(Number(r.legacy_profile_links)>0)why.push("Có hồ sơ học tập cũ liên kết");
 return {why,last};
};
const fingerprint=(r:Row,days:number)=>sha([r.device_id,r.person_role,r.status,
 r.created_at,r.last_seen_at,r.approved_at,r.registration_submitted_at,
 r.migrated_from_user_key,r.linked_accounts,r.payment_status,r.payment_proof_key,days]);
function described(r:Row,options:Criteria,now:number){
 const {why,last}=reasons(r,options.days,now);
 return {deviceId:r.device_id,name:r.learner_name?.trim()||"Hồ sơ chưa hoàn thiện",
  role:r.person_role,status:r.status,category:r.linked_accounts?"account-first":"legacy",
  className:r.class_name||null,createdAt:r.created_at,lastSeenAt:r.last_seen_at,
  inactiveDays:last?Math.floor((now-last)/86400000):0,
  eligible:why.length===0,blockers:why,snapshot:fingerprint(r,options.days)};
}
export async function previewManagerRosterCleanup(actor:PublicDeviceState,input:Record<string,unknown>,now=Date.now()){
 await requireAccountManager(actor);
 const options=daysValue(input);
 const cursor=typeof input.cursor==="string"?input.cursor:"";
 if(cursor&&!/^[a-f0-9-]{16,80}$/i.test(cursor))deny("ROSTER_CLEANUP_INPUT","Mã trang không hợp lệ.",400);
 const db=await trainingDatabase();
 return inspectManagerRosterDb(db,input,now);
}
/** SQL-only harness; public HTTP entry always authenticates before invoking. */
export async function inspectManagerRosterDb(db:DB,input:Record<string,unknown>,now=Date.now()) {
 const options=daysValue(input);
 const cursor=typeof input.cursor==="string"?input.cursor:"";
 if(cursor&&!/^[a-f0-9-]{16,80}$/i.test(cursor))deny("ROSTER_CLEANUP_INPUT","Mã trang không hợp lệ.",400);
 const res=await db.prepare(query).bind(cursor).all<Row>();
 if(!Array.isArray(res.results))deny("ROSTER_CLEANUP_UNVERIFIED","Chưa xác minh được danh sách D1.",503);
 const rows=res.results.slice(0,LIMIT).map(r=>described(r,options,now));
 return {verified:true,contract:"boi-manager-roster-cleanup.v1",action:"preview",
  days:options.days,records:rows,scanned:rows.length,
  eligible:rows.filter(r=>r.eligible).length,protected:rows.filter(r=>!r.eligible).length,
  hasMore:res.results.length>LIMIT,nextCursor:res.results.length>LIMIT?res.results[LIMIT-1].device_id:null,
  warning:"Chỉ hồ sơ chưa từng duyệt, chưa gắn tài khoản, chưa có dữ liệu mới đủ điều kiện. Không xóa tự động."};
}
export async function purgeManagerRosterRecord(actor:PublicDeviceState,input:Record<string,unknown>,now=Date.now()){
 const principal=await requireAccountManager(actor);
 return purgeManagerRosterDb(await trainingDatabase(),principal,input,now);
}
/** Called from an authenticated wrapper only. SQL authorization is rechecked in batch. */
export async function purgeManagerRosterDb(db:DB,principal:{accountId:string;sessionHash:string},input:Record<string,unknown>,now=Date.now()) {
 const {accountId,sessionHash}=principal;
 const options=daysValue(input);
 const reason=typeof input.reason==="string"?input.reason.trim():"";
 if(typeof input.deviceId!=="string"||!/^[a-f0-9-]{16,80}$/i.test(input.deviceId)
  ||typeof input.snapshot!=="string"||!/^[a-f0-9]{64}$/.test(input.snapshot)
  ||input.confirmation!=="XOA HO SO CU"
  ||reason.length<10||reason.length>300)
  deny("ROSTER_CLEANUP_CONFIRMATION_REQUIRED","Cần xác nhận và lý do đủ rõ.",400);
 const row=await db.prepare(query.replace("AND d.device_id>?\n ORDER BY d.device_id LIMIT 101",
  "AND d.device_id=? ORDER BY d.device_id LIMIT 101"))
  .bind(input.deviceId).first<Row>();
 if(!row)throw new DeviceAccessError("Hồ sơ không còn tồn tại.",404,"ROSTER_CLEANUP_NOT_FOUND");
 const seen=described(row,options,now);
 if(!seen.eligible||seen.snapshot!==input.snapshot)
  deny("ROSTER_CLEANUP_CHANGED","Hồ sơ hoặc điều kiện an toàn đã thay đổi; hãy quét lại.");
 // The first statement must fail (NULL audit purpose) if any relevant account,
 // activity, ownership or policy changed. D1.batch is atomic; never delete first.
 const guard=`EXISTS(SELECT 1 FROM device_access d WHERE d.device_id=? AND
    d.person_role=? AND d.status=? AND d.created_at=? AND d.last_seen_at IS ?
    AND d.registration_submitted_at IS ? AND d.approved_at IS NULL
    AND d.migrated_from_user_key IS NULL AND d.status IN ('pending','blocked')
    AND datetime(d.created_at)<datetime('now','-${options.days} days')
    AND (d.last_seen_at IS NULL OR datetime(d.last_seen_at)<datetime('now','-${options.days} days'))
    AND (d.registration_submitted_at IS NULL OR datetime(d.registration_submitted_at)<datetime('now','-${options.days} days'))
    AND NOT ${protectedData}
    AND EXISTS(SELECT 1 FROM accounts ma JOIN device_access md ON md.device_id=ma.storage_device_id
      JOIN account_onboarding mo ON mo.account_id=ma.account_id
      JOIN account_entitlements me ON me.account_id=ma.account_id
      JOIN account_manager_permissions mp ON mp.account_id=ma.account_id
      JOIN account_sessions ms ON ms.account_id=ma.account_id
      JOIN account_devices mb ON mb.account_id=ms.account_id AND mb.device_id=ms.device_id
      JOIN account_credentials mc ON mc.account_id=ma.account_id AND mc.generation=ms.generation
      WHERE ma.account_id=? AND md.person_role='manager' AND md.management_enabled=1
        AND md.status='approved' AND mo.stage='active' AND me.state='active'
        AND datetime(me.expires_at)>CURRENT_TIMESTAMP
        AND mp.scope='manager.manage.assigned' AND mp.enabled=1
        AND (mp.expires_at IS NULL OR mp.expires_at>(julianday('now')-2440587.5)*86400000)
        AND ms.token_hash=? AND ms.revoked=0 AND mb.approved=1 AND mb.revoked=0
        AND ms.expires_at>(julianday('now')-2440587.5)*86400000
        AND ms.idle_expires_at>(julianday('now')-2440587.5)*86400000))`;
 const id=row.device_id;
 const statement=[
  db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
    SELECT ?,'manager.legacy-roster.purged',?,CASE WHEN ${guard} THEN ? ELSE NULL END`)
   .bind(accountId,sha(["manager-legacy-roster",id]),id,row.person_role,row.status,
    row.created_at,row.last_seen_at,row.registration_submitted_at,
    accountId,sessionHash,
    "Manager archived unused legacy roster record: "+reason),
  db.prepare("DELETE FROM device_challenges WHERE device_id=?").bind(id),
  db.prepare("DELETE FROM device_profiles WHERE device_id=?").bind(id),
  db.prepare("DELETE FROM device_access WHERE device_id=? AND person_role=? AND status=? AND created_at=?")
   .bind(id,row.person_role,row.status,row.created_at),
 ];
 const results=await db.batch(statement).catch(()=>
  deny("ROSTER_CLEANUP_CHANGED","D1 từ chối xóa; hồ sơ được giữ nguyên. Quét lại trạng thái."));
 if(Number(results[0]?.meta.changes)!==1||Number(results[3]?.meta.changes)!==1)
  deny("ROSTER_CLEANUP_READBACK_FAILED","Không xác minh được giao dịch D1.",503);
 const remaining=await db.prepare("SELECT 1 FROM device_access WHERE device_id=?").bind(id).first();
 if(remaining)deny("ROSTER_CLEANUP_READBACK_FAILED","D1 chưa xác nhận xóa hồ sơ.",503);
 return {verified:true,contract:"boi-manager-roster-cleanup.v1",action:"purge",
  deleted:true,deviceHash:sha(id),auditPreserved:true};
}
