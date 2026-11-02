import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import { DeviceAccessError, deviceErrorResponse, getCourseDatabase, getPublicDeviceState } from "../../../device-auth.server";
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
      return controlResponse({learnerLimit:limits?.learner_limit??DEFAULT_LEARNER_LIMIT,
        teacherLimit:limits?.teacher_limit??DEFAULT_TEACHER_LIMIT,scope:"manager-tier"},200,request);
    }
    if(payload.action==="set-tier-limits"){
      const learnerLimit=bounds(payload.learnerLimit,5000,"Hạn mức học viên");
      const teacherLimit=bounds(payload.teacherLimit,500,"Hạn mức giảng viên");
      await db.batch([
        db.prepare(`INSERT INTO manager_approval_limits(scope,learner_limit,teacher_limit,updated_by)
          VALUES('manager-tier',?,?,?)
          ON CONFLICT(scope) DO UPDATE SET learner_limit=excluded.learner_limit,
            teacher_limit=excluded.teacher_limit,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`)
          .bind(learnerLimit,teacherLimit,actor),
        db.prepare("INSERT INTO course_audit_log(actor,action,target,detail_json) VALUES (?,'manager_tier_limits_updated','manager-tier',?)")
          .bind(actor,JSON.stringify({learnerLimit,teacherLimit}))
      ]);
      const result=await db.prepare("SELECT learner_limit,teacher_limit FROM manager_approval_limits WHERE scope='manager-tier'")
        .first<{learner_limit:number;teacher_limit:number}>();
      if(result?.learner_limit!==learnerLimit||result?.teacher_limit!==teacherLimit)
        throw new DeviceAccessError("Hạn mức lưu chưa khớp GET D1 độc lập.",503,"MANAGER_TIER_LIMIT_READBACK_FAILED");
      return controlResponse({learnerLimit,teacherLimit,scope:"manager-tier"},200,request);
    }
    if(payload.action!==undefined && payload.action!=="grant-manager")
      throw new DeviceAccessError("Thao tác cấp độ quản lý không hợp lệ.",400,"MANAGER_ACTION_INVALID");
    if(typeof payload.deviceId!=="string"||!/^[a-f0-9]{64}$/.test(payload.deviceId)
      ||typeof payload.expectedPersonCode!=="string"||typeof payload.enabled!=="boolean")
      throw new DeviceAccessError("Thiếu thông tin cán bộ quản lý hoặc xác minh vai trò.",400,"INVALID_MANAGEMENT_GRANT");
    const selected=await db.prepare(`SELECT device_id FROM device_access
      WHERE device_id=? AND person_role='manager' AND person_code=? AND registration_submitted_at IS NOT NULL`)
      .bind(payload.deviceId,payload.expectedPersonCode).first<{device_id:string}>();
    if(!selected)throw new DeviceAccessError("Không tìm thấy hồ sơ cán bộ hợp lệ.",409,"MANAGEMENT_GRANT_CONFLICT");
    const update=await db.prepare(`UPDATE device_access SET management_enabled=?,updated_at=CURRENT_TIMESTAMP
       WHERE device_id=? AND person_role='manager' AND person_code=? AND registration_submitted_at IS NOT NULL
        AND (?=0 OR (status='approved' AND (access_expires_at IS NULL OR datetime(access_expires_at)>CURRENT_TIMESTAMP)))`)
      .bind(payload.enabled?1:0,payload.deviceId,payload.expectedPersonCode,payload.enabled?1:0).run();
    if(Number(update.meta.changes)!==1)
      throw new DeviceAccessError("Trạng thái cán bộ đã thay đổi. Đồng bộ và thử lại.",409,"MANAGEMENT_GRANT_CONFLICT");
    await db.prepare("INSERT INTO course_audit_log(actor,action,target,detail_json) VALUES (?,'training_manager_permission',?,?)")
      .bind(actor,payload.deviceId,JSON.stringify({enabled:payload.enabled})).run();
    const device=await getPublicDeviceState(payload.deviceId);
    if(device?.managementEnabled!==payload.enabled)
      throw new DeviceAccessError("Quyền quản lý chưa khớp GET D1.",503,"MANAGEMENT_GRANT_READBACK_FAILED");
    return controlResponse({device,managementEnabled:device.managementEnabled},200,request);
  }catch(error){return withControlCors(request,deviceErrorResponse(error));}
}
