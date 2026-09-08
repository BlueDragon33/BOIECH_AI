import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import { DeviceAccessError, deviceErrorResponse, listSiteAccessSessions, revokeSiteAccessSession, revokeSiteSessionsForDevice } from "../../../device-auth.server";

export const dynamic = "force-dynamic";
export function OPTIONS(request: Request) { return controlPreflight(request); }

function canManage(role: string) { return ["publisher", "owner"].includes(role); }

export async function GET(request: Request) {
  try {
    await requireControlService(request);
    return controlResponse({ application: "child-health", sessions: await listSiteAccessSessions() }, 200, request);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireControlService(request);
    if (!canManage(identity.role)) throw new DeviceAccessError("Không có quyền thu hồi phiên truy cập Sức khỏe Y tế.", 403, "PUBLISHER_REQUIRED");
    const payload = (await request.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    const reason = typeof payload.reason === "string" ? payload.reason.trim().slice(0, 240) : "Thu hồi từ Trung tâm Quản trị";
    if (action === "revoke-session") {
      await revokeSiteAccessSession(payload.sessionId, identity.actor, reason);
    } else if (action === "revoke-device-sessions") {
      const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : "";
      if (!/^[a-f0-9]{64}$/.test(deviceId)) throw new DeviceAccessError("Mã thiết bị không hợp lệ.", 400, "INVALID_DEVICE");
      await revokeSiteSessionsForDevice(deviceId, identity.actor, reason);
    } else {
      throw new DeviceAccessError("Thao tác phiên truy cập không hợp lệ.", 400, "INVALID_SESSION_ACTION");
    }
    return controlResponse({ application: "child-health", sessions: await listSiteAccessSessions() }, 200, request);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}
