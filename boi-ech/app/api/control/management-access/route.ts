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
    const db = await getCourseDatabase();
    const result = await db.batch([
      db.prepare(`UPDATE device_access SET management_enabled=?,updated_at=CURRENT_TIMESTAMP
        WHERE device_id=? AND person_role='manager' AND person_code=? AND registration_submitted_at IS NOT NULL
          AND (?=0 OR (status='approved' AND (access_expires_at IS NULL OR datetime(access_expires_at)>CURRENT_TIMESTAMP)))`)
        .bind(payload.enabled?1:0,payload.deviceId,payload.expectedPersonCode,payload.enabled?1:0),
      db.prepare("INSERT INTO course_audit_log(actor,action,target,detail_json) SELECT ?,'training_manager_permission',?,? WHERE changes()=1")
        .bind(actor,payload.deviceId,JSON.stringify({enabled:payload.enabled})),
    ]);
    if (Number(result[0].meta.changes)!==1) throw new DeviceAccessError("Hồ sơ/quyền truy cập đã thay đổi. Đồng bộ và kiểm tra lại.",409,"MANAGEMENT_GRANT_CONFLICT");
    const device=await getPublicDeviceState(payload.deviceId);
    return controlResponse({ device, managementEnabled: device?.managementEnabled===true },200,request);
  } catch(error) { return withControlCors(request,deviceErrorResponse(error)); }
}
