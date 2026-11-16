import {DeviceAccessError,deviceErrorResponse,getCourseDatabase,verifyDeviceRequest} from "../../device-auth.server";
import {requireManager,trainingBoard,trainingWindow} from "../../training-management.server";
import {profileAdmissionEnabled,validateSubmittedTrainingProfile,validateClassSafetyProfile,
 readManagerProfileAdmission} from "../../training-ai-profile-data.server";

export const dynamic="force-dynamic";
const respond=(data:unknown,status=200)=>Response.json(data,{
 status,headers:{"cache-control":"no-store, private","x-content-type-options":"nosniff"}
});
const sourceRef=(v:unknown)=>typeof v==="string"&&/^[A-Za-z0-9._:-]{8,120}$/.test(v);
function expiry(value:unknown){
 if(typeof value!=="string"||!Number.isFinite(Date.parse(value)))return null;
 const time=Date.parse(value),now=Date.now();
 if(time<=now||time>now+90*86400000)return null;
 return new Date(time).toISOString();
}
/**
 * Feature-off default protects new personal-profile data until a separately
 * admitted data-owner consent/retention policy is configured in Cloudflare.
 * It is not silently turned on by a migration or a successful CI run.
 */
export async function POST(request:Request){
 try{
  const raw=await request.text();
  if(raw.length>8192)return respond({error:"Giới hạn khai báo hồ sơ 8 KB."},413);
  const payload=JSON.parse(raw) as Record<string,unknown>;
  if(!payload||typeof payload!=="object"||Array.isArray(payload))
   return respond({error:"Hồ sơ phải là đối tượng dữ liệu."},400);
  const device=await verifyDeviceRequest(payload,false);
  if(!await profileAdmissionEnabled())
   return respond({error:"Nguồn hồ sơ bổ sung chưa được chủ dữ liệu cho phép kích hoạt.",
     code:"AI_PROFILE_ADMISSION_DISABLED"},409);
  const action=payload.action;
  const db=await getCourseDatabase();
  if(action==="own-list"||action==="submit"||action==="withdraw"){
   if(device.personRole!=="teacher"&&device.personRole!=="learner")
    throw new DeviceAccessError("Chỉ học viên hoặc giảng viên được khai báo hồ sơ của chính mình.",403,"PROFILE_ROLE_REQUIRED",device);
   const existing=await db.prepare(`SELECT revision,state,payload_json FROM training_ai_profile_submissions WHERE device_id=?`)
    .bind(device.deviceId).first<{revision:number;state:string;payload_json:string}>();
   if(action==="own-list")return respond({
    revision:existing?.revision??0,status:existing?.state??"missing",
    profile:existing?.state==="withdrawn"?null:existing?JSON.parse(existing.payload_json):null,
    message:"Hồ sơ bổ sung chỉ được sử dụng sau khi Cán bộ xác minh và đủ điều kiện quyền riêng tư."
   });
   const expected=payload.expectedRevision;
   if(typeof expected!=="number"||!Number.isSafeInteger(expected)||expected<0)
    return respond({error:"Thiếu phiên bản hồ sơ để kiểm tra cập nhật đồng thời."},400);
   const clean=action==="submit"
    ?validateSubmittedTrainingProfile(device.personRole,payload.profile):null;
   if(action==="submit"&&(payload.consent!==true||!clean?.ok||!clean.payload))
    return respond({error:clean?.message??"Cần đồng ý rõ ràng trước khi lưu hồ sơ bổ sung."},400);
   if(action==="withdraw"&&!existing)
    return respond({ok:true,status:"missing",revision:0});
   const write=expected===0&&action==="submit"
    ?db.prepare(`INSERT OR IGNORE INTO training_ai_profile_submissions
       (device_id,role,payload_json,revision,state,consent_at)
       VALUES (?,?,?,1,'pending',strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
      .bind(device.deviceId,device.personRole,JSON.stringify(clean!.payload))
    :db.prepare(`UPDATE training_ai_profile_submissions
       SET payload_json=?,state=?,revision=revision+1,
       consent_at=?,verified_revision=NULL,verified_by=NULL,verification_reference=NULL,
       verified_at=NULL,valid_until=NULL,updated_at=CURRENT_TIMESTAMP
       WHERE device_id=? AND role=? AND revision=?`)
      .bind(action==="withdraw"?"{}":JSON.stringify(clean?.payload??{}),
       action==="withdraw"?"withdrawn":"pending",
       action==="withdraw"?null:new Date().toISOString(),device.deviceId,device.personRole,expected);
   const result=await db.batch([write,db.prepare(`INSERT INTO course_audit_log(actor,action,target,detail_json)
     SELECT ?,?,?,? WHERE changes()=1`).bind(device.deviceCode,
      action==="withdraw"?"ai_profile_withdrawn":"ai_profile_submitted",device.deviceId,
      JSON.stringify({role:device.personRole,expectedRevision:expected}))]);
   if(result[0].meta.changes!==1)return respond({error:"Phiên bản hồ sơ đã đổi; đồng bộ trước khi thử lại.",code:"AI_PROFILE_CAS_CONFLICT"},409);
   return respond({ok:true,status:action==="withdraw"?"withdrawn":"pending",revision:expected+1});
  }
  if(action!=="manager-list"&&action!=="verify"&&action!=="attest-class")
   return respond({error:"Thao tác không hợp lệ."},400);
  requireManager(device);
  const {from,to}=trainingWindow(payload);
  // Canonical manager account capability gate and shared roster ownership.
  const board=await trainingBoard(from,to,device);
  if(action==="manager-list"){
   const profiles=await readManagerProfileAdmission(db,board);
   const ids=new Set(board.people.map(p=>p.id));
   const rawRows=await db.prepare(`SELECT device_id,role,payload_json,revision,state,submitted_at
      FROM training_ai_profile_submissions WHERE state='pending' ORDER BY updated_at DESC LIMIT 100`)
     .all<{device_id:string;role:string;payload_json:string;revision:number;state:string;submitted_at:string}>();
   return respond({pending:(rawRows.results??[]).filter(x=>ids.has(x.device_id))
    .map(x=>({deviceId:x.device_id,role:x.role,revision:x.revision,submittedAt:x.submitted_at,
      profile:JSON.parse(x.payload_json)})),
    verified:profiles,sourcePossiblyTruncated:(rawRows.results??[]).length>=100});
  }
  if(!sourceRef(payload.verificationReference)||!expiry(payload.validUntil))
   return respond({error:"Thiếu mã chứng từ nguồn và thời hạn kiểm chứng tối đa 90 ngày."},400);
  const expected=payload.expectedRevision;
  if(typeof expected!=="number"||!Number.isSafeInteger(expected)||expected<0)return respond({error:"Phiên bản không hợp lệ."},400);
  const verifiedAt=new Date().toISOString(),expires=expiry(payload.validUntil)!;
  if(action==="verify"){
   const target=payload.deviceId;
   if(typeof target!=="string"||!board.people.some(p=>p.id===target&&
     (p.role==="teacher"||p.role==="learner")&&p.registered&&p.status==="approved"&&!p.expired))
    return respond({error:"Hồ sơ người dùng không hợp lệ trong phạm vi quản lý."},403);
   const statement=db.prepare(`UPDATE training_ai_profile_submissions
    SET state='verified',verified_revision=revision,verified_by=?,
    verification_reference=?,verified_at=?,valid_until=?,updated_at=CURRENT_TIMESTAMP
    WHERE device_id=? AND revision=? AND state='pending' AND consent_at IS NOT NULL`)
    .bind(device.deviceId,payload.verificationReference,verifiedAt,expires,target,expected);
   const result=await db.batch([statement,db.prepare(`INSERT INTO course_audit_log(actor,action,target,detail_json)
      SELECT ?,'ai_profile_verified',?,? WHERE changes()=1`)
      .bind(device.deviceCode,target,JSON.stringify({verificationReference:payload.verificationReference,
       sourceRevision:expected,validUntil:expires}))]);
   if(result[0].meta.changes!==1)return respond({error:"Hồ sơ đã sửa, rút đồng ý hoặc không còn chờ xác minh.",code:"AI_PROFILE_VERIFY_CONFLICT"},409);
   return respond({ok:true,state:"verified",revision:expected});
  }
  const classId=payload.classId;
  if(typeof classId!=="string"||!board.resources.some(r=>r.id===classId&&r.kind==="class"&&r.status==="active"))
   return respond({error:"Lớp không hợp lệ."},403);
  const validated=validateClassSafetyProfile(payload.profile);
  if(!validated.ok||!validated.payload)return respond({error:validated.message},400);
  const data=JSON.stringify(validated.payload);
  const write=expected===0
   ?db.prepare(`INSERT OR IGNORE INTO training_ai_class_safety_attestations
       (class_id,payload_json,revision,verification_reference,verified_by,verified_at,valid_until)
       VALUES (?,?,1,?,?,?,?)`).bind(classId,data,payload.verificationReference,device.deviceId,verifiedAt,expires)
   :db.prepare(`UPDATE training_ai_class_safety_attestations
       SET payload_json=?,revision=revision+1,verification_reference=?,
       verified_by=?,verified_at=?,valid_until=?,updated_at=CURRENT_TIMESTAMP
       WHERE class_id=? AND revision=?`)
     .bind(data,payload.verificationReference,device.deviceId,verifiedAt,expires,classId,expected);
  const result=await db.batch([write,db.prepare(`INSERT INTO course_audit_log(actor,action,target,detail_json)
   SELECT ?,'ai_class_safety_attested',?,? WHERE changes()=1`)
   .bind(device.deviceCode,classId,JSON.stringify({verificationReference:payload.verificationReference,
    expectedRevision:expected,validUntil:expires}))]);
  if(result[0].meta.changes!==1)return respond({error:"Bản xác minh an toàn đã đổi phiên bản.",code:"AI_CLASS_SAFETY_CONFLICT"},409);
  return respond({ok:true,state:"verified",revision:expected+1});
 }catch(error){
  if(error instanceof SyntaxError)return respond({error:"JSON không hợp lệ."},400);
  if(error instanceof DeviceAccessError)return deviceErrorResponse(error);
  return respond({error:"Không thể xử lý hồ sơ bổ sung; không tự xác minh.",code:"AI_PROFILE_UNAVAILABLE"},503);
 }
}
