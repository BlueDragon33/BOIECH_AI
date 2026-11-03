import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import { accessExpiryAfterDays, DeviceAccessError, deviceErrorResponse, getAccessAutomationSettings, getCourseDatabase, getPublicDeviceState } from "../../../device-auth.server";
export const dynamic="force-dynamic";
export function OPTIONS(request:Request){return controlPreflight(request);}
const DEFAULT_LEARNER_LIMIT=50,DEFAULT_TEACHER_LIMIT=5;
function bounds(value:unknown,maximum:number,name:string){
  if(!Number.isInteger(value)||Number(value)<0||Number(value)>maximum)
    throw new DeviceAccessError(name+" phải là số nguyên từ 0 đến "+maximum+".",400,"MANAGER_LIMIT_INVALID");
  return Number(value);
}
export async function POST(request:Request){
  try{
    const {actor,role}=await requireControlService(request);
    if(role!=="owner")return controlResponse({error:"Chỉ Owner được cấp quyền cán bộ quản lý hoặc sửa hạn mức cấp độ."},403,request);
    const payload=await request.json() as Record<string,unknown>;
    const db=await getCourseDatabase();
    if(payload.action==="get-tier-limits"){
      const limits=await db.prepare("SELECT learner_limit,teacher_limit FROM manager_approval_limits WHERE scope='manager-tier'")
        .first<{learner_limit:number;teacher_limit:number}>();
      if(!limits)throw new DeviceAccessError("D1 chưa có hạn mức đã lưu, không dùng giá trị mặc định để xác nhận.",503,"MANAGER_TIER_D1_MISSING");
      return controlResponse({learnerLimit:limits.learner_limit,
        teacherLimit:limits.teacher_limit,scope:"manager-tier"},200,request);
    }
    if(payload.action==="get-manager-grant"){
      if(typeof payload.deviceId!=="string"||!/^[a-f0-9]{64}$/.test(payload.deviceId)
        ||typeof payload.expectedPersonCode!=="string")
        throw new DeviceAccessError("Thông tin cán bộ không hợp lệ.",400,"INVALID_MANAGEMENT_GRANT");
      const row=await db.prepare(`SELECT management_enabled,status,access_expires_at FROM device_access
        WHERE device_id=? AND person_role='manager' AND person_code=? AND registration_submitted_at IS NOT NULL`)
        .bind(payload.deviceId,payload.expectedPersonCode)
        .first<{management_enabled:number;status:string;access_expires_at:string|null}>();
      if(!row)throw new DeviceAccessError("Không tìm thấy cán bộ quản lý.",404,"MANAGER_NOT_FOUND");
      if(row.management_enabled!==0&&row.management_enabled!==1)
        throw new DeviceAccessError("D1 trả trạng thái quyền cán bộ không hợp lệ.",503,"MANAGER_GRANT_D1_INVALID");
      const active=row.status==="approved"&&(!row.access_expires_at||Date.parse(row.access_expires_at)>Date.now());
      return controlResponse({managementConfigured:row.management_enabled===1,
        managementEnabled:row.management_enabled===1&&active,
        accountApproved:active,deviceId:payload.deviceId},200,request);
    }
    if(payload.action==="set-tier-limits"){
      const learnerLimit=bounds(payload.learnerLimit,5000,"Hạn mức học viên");
      const teacherLimit=bounds(payload.teacherLimit,500,"Hạn mức giảng viên");
      const expectedLearnerLimit=bounds(payload.expectedLearnerLimit,5000,"Hạn mức học viên trước đó");
      const expectedTeacherLimit=bounds(payload.expectedTeacherLimit,500,"Hạn mức giảng viên trước đó");
      const [saved,audited]=await db.batch([
        db.prepare(`UPDATE manager_approval_limits SET learner_limit=?,teacher_limit=?,
          updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE scope='manager-tier'
          AND learner_limit=? AND teacher_limit=?`)
          .bind(learnerLimit,teacherLimit,actor,expectedLearnerLimit,expectedTeacherLimit),
        db.prepare(`INSERT INTO course_audit_log(actor,action,target,detail_json)
          SELECT ?,'manager_tier_limits_updated','manager-tier',? WHERE changes()=1`)
          .bind(actor,JSON.stringify({learnerLimit,teacherLimit,
            expectedLearnerLimit,expectedTeacherLimit}))
      ]);
      if(Number(saved.meta.changes)!==1||Number(audited.meta.changes)!==1)
        throw new DeviceAccessError("Hạn mức đã thay đổi; đồng bộ lại trước khi ghi.",409,"MANAGER_TIER_CAS_CONFLICT");
      const result=await db.prepare("SELECT learner_limit,teacher_limit FROM manager_approval_limits WHERE scope='manager-tier'")
        .first<{learner_limit:number;teacher_limit:number}>();
      if(result?.learner_limit!==learnerLimit||result?.teacher_limit!==teacherLimit)
        throw new DeviceAccessError("Hạn mức lưu chưa khớp GET D1 độc lập.",503,"MANAGER_TIER_LIMIT_READBACK_FAILED");
      return controlResponse({learnerLimit,teacherLimit,scope:"manager-tier"},200,request);
    }
    if(payload.action==="approve-manager"){
      if(typeof payload.deviceId!=="string"||!/^[a-f0-9]{64}$/.test(payload.deviceId)
        ||typeof payload.expectedPersonCode!=="string"||!payload.expectedPersonCode.trim()
        ||payload.expectedStatus!=="pending")
        throw new DeviceAccessError("Thiếu hồ sơ cán bộ hoặc trạng thái pending để duyệt.",400,"MANAGER_APPROVE_INVALID");
      const automation=await getAccessAutomationSettings();
      // One owning-D1 transaction: CAS approval + grant + audit. A concurrent
      // Owner or manager cannot silently approve an already changed profile.
      const [approved,audited]=await db.batch([
        db.prepare(`UPDATE device_access SET status='approved',access_group='free',payment_status='free_approved',
          management_enabled=1,approved_at=CURRENT_TIMESTAMP,blocked_at=NULL,
          access_expires_at=CASE
            WHEN access_expires_at IS NULL OR datetime(access_expires_at)<=CURRENT_TIMESTAMP
              THEN ? ELSE access_expires_at END,
          updated_at=CURRENT_TIMESTAMP
          WHERE device_id=? AND person_role='manager' AND person_code=? AND status='pending'
            AND payment_status='unassigned' AND registration_submitted_at IS NOT NULL
            AND learner_name IS NOT NULL AND trim(learner_name)!=''
            AND class_name IS NOT NULL AND trim(class_name)!=''
            AND phone IS NOT NULL AND trim(phone)!=''`)
          .bind(accessExpiryAfterDays(automation.defaultAccessDays),payload.deviceId,payload.expectedPersonCode),
        db.prepare(`INSERT INTO course_audit_log(actor,action,target,detail_json)
          SELECT ?,'training_manager_approved',?,? WHERE changes()=1`)
          .bind(actor,payload.deviceId,JSON.stringify({source:"app-manager-owner",managerTier:true}))
      ]);
      if(Number(approved.meta.changes)!==1 || Number(audited.meta.changes)!==1)
        throw new DeviceAccessError("Hồ sơ đã đổi hoặc thiếu thông tin, cần đọc lại D1.",409,"MANAGER_APPROVE_CONFLICT");
      const current=await getPublicDeviceState(payload.deviceId);
      if(current?.status!=="approved"||!current.managementEnabled)
        throw new DeviceAccessError("D1 chưa xác minh được tài khoản cán bộ đã duyệt.",503,"MANAGER_APPROVE_READBACK_FAILED");
      return controlResponse({deviceId:payload.deviceId,accountApproved:true,managementEnabled:true},200,request);
    }
    if(payload.action!==undefined && payload.action!=="grant-manager")
      throw new DeviceAccessError("Thao tác cấp độ quản lý không hợp lệ.",400,"MANAGER_ACTION_INVALID");
    if(typeof payload.deviceId!=="string"||!/^[a-f0-9]{64}$/.test(payload.deviceId)
      ||typeof payload.expectedPersonCode!=="string"||typeof payload.enabled!=="boolean"
      ||typeof payload.expectedManagementEnabled!=="boolean")
      throw new DeviceAccessError("Thiếu thông tin cán bộ quản lý hoặc xác minh vai trò.",400,"INVALID_MANAGEMENT_GRANT");
    const selected=await db.prepare(`SELECT device_id,management_enabled FROM device_access
      WHERE device_id=? AND person_role='manager' AND person_code=? AND registration_submitted_at IS NOT NULL`)
      .bind(payload.deviceId,payload.expectedPersonCode).first<{device_id:string;management_enabled:number}>();
    if(!selected||(selected.management_enabled===1)!==payload.expectedManagementEnabled)
      throw new DeviceAccessError("Quyền cán bộ đã thay đổi. Đồng bộ lại D1.",409,"MANAGEMENT_GRANT_CONFLICT");
    // Mutate permission and append audit within the same owning-D1 batch.
    const [update,audit]=await db.batch([
      db.prepare(`UPDATE device_access SET management_enabled=?,updated_at=CURRENT_TIMESTAMP
       WHERE device_id=? AND person_role='manager' AND person_code=? AND registration_submitted_at IS NOT NULL
        AND management_enabled=?
        AND (?=0 OR (status='approved' AND (access_expires_at IS NULL OR datetime(access_expires_at)>CURRENT_TIMESTAMP)))`)
      .bind(payload.enabled?1:0,payload.deviceId,payload.expectedPersonCode,
        payload.expectedManagementEnabled?1:0,payload.enabled?1:0),
      db.prepare(`INSERT INTO course_audit_log(actor,action,target,detail_json)
        SELECT ?,'training_manager_permission',?,? WHERE changes()=1`)
      .bind(actor,payload.deviceId,JSON.stringify({enabled:payload.enabled,
        expectedManagementEnabled:payload.expectedManagementEnabled}))
    ]);
    if(Number(update.meta.changes)!==1||Number(audit.meta.changes)!==1)
      throw new DeviceAccessError("Trạng thái cán bộ đã thay đổi. Đồng bộ và thử lại.",409,"MANAGEMENT_GRANT_CONFLICT");
    // Fresh D1 SELECT must verify the persisted bit; effective access alone
    // is false both before and after revoking an expired/blocked manager.
    const persisted=await db.prepare(`SELECT management_enabled FROM device_access
      WHERE device_id=? AND person_role='manager' AND person_code=? AND registration_submitted_at IS NOT NULL`)
      .bind(payload.deviceId,payload.expectedPersonCode)
      .first<{management_enabled:number}>();
    if(!persisted||(persisted.management_enabled!==0&&persisted.management_enabled!==1)
      ||(persisted.management_enabled===1)!==payload.enabled)
      throw new DeviceAccessError("Quyền cán bộ đã lưu chưa khớp D1 độc lập.",503,"MANAGEMENT_GRANT_READBACK_FAILED");
    const device=await getPublicDeviceState(payload.deviceId);
    if(device?.managementEnabled!==payload.enabled)
      throw new DeviceAccessError("Quyền quản lý có hiệu lực chưa khớp D1.",503,"MANAGEMENT_GRANT_READBACK_FAILED");
    return controlResponse({device,managementConfigured:persisted.management_enabled===1,
      managementEnabled:device.managementEnabled},200,request);
  }catch(error){return withControlCors(request,deviceErrorResponse(error));}
}
