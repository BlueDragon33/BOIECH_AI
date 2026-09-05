import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import { deviceErrorResponse } from "../../../device-auth.server";
import {
  canContentReview,
  courseControlAction,
  courseControlDetail,
  courseVersionExists,
} from "../../../content-control-course.server";
import {
  healthControlAction,
  healthControlDetail,
  healthVersionExists,
} from "../../../content-control-health.server";

export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return controlPreflight(request);
}

function mergedVersions(course: Awaited<ReturnType<typeof courseControlDetail>>["versions"], health: Awaited<ReturnType<typeof healthControlDetail>>["versions"]) {
  return [...course, ...health].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at ?? left.created_at);
    const rightTime = Date.parse(right.updated_at ?? right.created_at);
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  }).slice(0, 100);
}

async function allVersions() {
  const [course, health] = await Promise.all([courseControlDetail(), healthControlDetail()]);
  return mergedVersions(course.versions, health.versions);
}

export async function GET(request: Request) {
  try {
    const { role } = await requireControlService(request);
    const respond = (data: unknown, status = 200) => controlResponse(data, status, request);
    if (!canContentReview(role)) return respond({ error: "Không có quyền xem yêu cầu chỉnh sửa." }, 403);
    const versionId = new URL(request.url).searchParams.get("versionId") ?? undefined;
    if (!versionId) return respond({ versions: await allVersions() });
    if (!/^[0-9a-f-]{36}$/i.test(versionId)) return respond({ error: "Phiên bản nội dung không hợp lệ." }, 400);

    if (await healthVersionExists(versionId)) {
      const detail = await healthControlDetail(versionId);
      return respond({ ...detail, versions: await allVersions(), application: "child-health" });
    }
    if (await courseVersionExists(versionId)) {
      const detail = await courseControlDetail(versionId);
      return respond({ ...detail, versions: await allVersions(), application: "boi-ech" });
    }
    return respond({ error: "Không tìm thấy phiên bản nội dung." }, 404);
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

    const result = await healthVersionExists(versionId)
      ? await healthControlAction(actor, role, payload)
      : await courseControlAction(actor, role, payload);
    if (result.status >= 400) return respond(result.data, result.status);
    return respond({ ...result.data, versions: await allVersions() }, result.status);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}
