import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import { DeviceAccessError, deviceErrorResponse, listHealthControlAudit } from "../../../device-auth.server";

export const dynamic = "force-dynamic";
export function OPTIONS(request: Request) { return controlPreflight(request); }

export async function GET(request: Request) {
  try {
    const identity = await requireControlService(request);
    if (!["reviewer", "publisher", "owner"].includes(identity.role)) throw new DeviceAccessError("Không có quyền xem nhật ký quản trị Sức khỏe Y tế.", 403, "REVIEWER_REQUIRED");
    return controlResponse({ application: "child-health", audit: await listHealthControlAudit() }, 200, request);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}
