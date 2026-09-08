import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import { DeviceAccessError, deviceErrorResponse, getSiteAccessPolicy, updateSiteAccessPolicy } from "../../../device-auth.server";

export const dynamic = "force-dynamic";
export function OPTIONS(request: Request) { return controlPreflight(request); }

export async function GET(request: Request) {
  try {
    await requireControlService(request);
    return controlResponse({ application: "child-health", policy: await getSiteAccessPolicy() }, 200, request);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireControlService(request);
    if (identity.role !== "owner") throw new DeviceAccessError("Chỉ chủ hệ thống được thay đổi chính sách Sức khỏe Y tế.", 403, "OWNER_REQUIRED");
    const payload = (await request.json()) as Record<string, unknown>;
    const policy = await updateSiteAccessPolicy(identity.actor, payload);
    return controlResponse({ application: "child-health", policy }, 200, request);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}
