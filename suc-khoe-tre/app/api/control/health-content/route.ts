import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import { healthControlAction, healthControlDetail } from "../../../content-control-health.server";
import { deviceErrorResponse } from "../../../device-auth.server";

export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return controlPreflight(request);
}

function canReview(role: string) {
  return ["reviewer", "publisher", "owner"].includes(role);
}

export async function GET(request: Request) {
  try {
    const { role } = await requireControlService(request);
    const respond = (data: unknown, status = 200) => controlResponse(data, status, request);
    if (!canReview(role)) return respond({ error: "Không có quyền xem quản trị nội dung Sức khỏe trẻ." }, 403);
    const versionId = new URL(request.url).searchParams.get("versionId") ?? undefined;
    if (versionId && !/^[0-9a-f-]{36}$/i.test(versionId)) return respond({ error: "Phiên bản nội dung không hợp lệ." }, 400);
    const detail = await healthControlDetail(versionId);
    return respond({ application: "child-health", ...detail });
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}

export async function POST(request: Request) {
  try {
    const { actor, role } = await requireControlService(request);
    const payload = (await request.json()) as Record<string, unknown>;
    const respond = (data: unknown, status = 200) => controlResponse(data, status, request);
    const versionId = typeof payload.versionId === "string" ? payload.versionId : "";
    if (!/^[0-9a-f-]{36}$/i.test(versionId)) return respond({ error: "Phiên bản nội dung không hợp lệ." }, 400);

    const result = await healthControlAction(actor, role, payload);
    if (result.status >= 400) return respond(result.data, result.status);
    const detail = await healthControlDetail(result.data.versionId as string | undefined);
    return respond({ application: "child-health", ...result.data, ...detail }, result.status);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}
