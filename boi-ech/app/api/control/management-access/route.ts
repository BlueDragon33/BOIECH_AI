import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import { DeviceAccessError, deviceErrorResponse, getCourseDatabase, getPublicDeviceState } from "../../../device-auth.server";
export const dynamic = "force-dynamic";
export function OPTIONS(request: Request) { return controlPreflight(request); }
export async function POST(request: Request) {
  try {
    const { actor, role } = await requireControlService(request);
    if (role !== "owner") return controlResponse({ error: "Chỉ Owner được cấp hoặc thu hồi quyền điều phối." }, 403, request);
    const payload = await request.json() as Record<string, unknown>;
    if (typeof payload.deviceId !== "string" || typeof payload.expectedPersonCode !== "string" || typeof payload.enabled !== "boolean") throw new DeviceAccessError("Yêu cầu cấp quyền chưa đầy đủ.",400,"INVALID_MANAGEMENT_GRANT");
    // Owner may adjust per-manager lifetime approval limits; defaults 50/5.
    // No learner or teacher receives authority from this endpoint.
    const learnerLimit = payload.learnerLimit === undefined ? 50 : payload.learnerLimit;
    const teacherLimit = payload.teacherLimit === undefined ? 5 : payload.teacherLimit;
    if (!Number.isInteger(learnerLimit) || Number(learnerLimit)<0 || Number(learnerLimit)>5000
      || !Number.isInteger(teacherLimit) || Number(teacherLimit)<0 || Number(teacherLimit)>500)
      throw new DeviceAccessError("Hạn mức phải là số nguyên: học viên 0–5000, giảng viên 0–500.",400,"MANAGER_LIMIT_INVALID");
    const db = await getCourseDatabase();
    const target = await db.prepare(`SELECT device_id FROM device_access WHERE device_id=?
      AND person_role='manager' AND person_code=? AND registration_submitted_at IS NOT NULL`)
      .bind(payload.deviceId,payload.expectedPersonCode).first<{device_id:string}>();
    if (!target) throw new DeviceAccessError("Không tìm thấy hồ sơ cán bộ quản lý hợp lệ.",409,"MANAGEMENT_GRANT_CONFLICT");
    const result = await db.batch([
      db.prepare(`UPDATE device_access SET management_enabled=?,updated_at=CURRENT_TIMESTAMP
        WHERE device_id=? AND person_role='manager' AND person_code=? AND registration_submitted_at IS NOT NULL
          AND (?=0 OR (status='approved' AND (access_expires_at IS NULL OR datetime(access_expires_at)>CURRENT_TIMESTAMP)))`)
        .bind(payload.enabled?1:0,payload.deviceId,payload.expectedPersonCode,payload.enabled?1:0),
      db.prepare(`INSERT INTO manager_approval_limits(manager_device_id,learner_limit,teacher_limit,updated_by)
        SELECT device_id,?,?,? FROM device_access WHERE device_id=? AND person_role='manager'
        ON CONFLICT(manager_device_id) DO UPDATE SET learner_limit=excluded.learner_limit,
          teacher_limit=excluded.teacher_limit,updated_by=excluded.updated_by,
          updated_at=CURRENT_TIMESTAMP`)
        .bind(learnerLimit,teacherLimit,actor,payload.deviceId),
      db.prepare("INSERT INTO course_audit_log(actor,action,target,detail_json) VALUES (?,'training_manager_permission',?,?)")
        .bind(actor,payload.deviceId,JSON.stringify({enabled:payload.enabled,learnerLimit,teacherLimit})),
    ]);
    if (Number(result[0].meta.changes)!==1) throw new DeviceAccessError("Hồ sơ/quyền truy cập đã thay đổi. Đồng bộ và kiểm tra lại.",409,"MANAGEMENT_GRANT_CONFLICT");
    const device=await getPublicDeviceState(payload.deviceId);
    const stored = await db.prepare(`SELECT learner_limit,teacher_limit FROM manager_approval_limits
      WHERE manager_device_id=?`).bind(payload.deviceId)
      .first<{learner_limit:number;teacher_limit:number}>();
    if (device?.managementEnabled !== payload.enabled ||
      stored?.learner_limit !== learnerLimit || stored?.teacher_limit !== teacherLimit)
      throw new DeviceAccessError("Đã ghi nhưng readback quyền/hạn mức không khớp.",503,"MANAGEMENT_GRANT_READBACK_FAILED");
    return controlResponse({ device, managementEnabled:device.managementEnabled,
      learnerLimit:stored.learner_limit,teacherLimit:stored.teacher_limit },200,request);
  } catch(error) { return withControlCors(request,deviceErrorResponse(error)); }
}
