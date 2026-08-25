import { ControlAccessError, controlErrorResponse, verifyControlProof } from "../../control-device.server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(payload, undefined, previewRequest);
    if (!["reviewer", "publisher", "owner"].includes(actor.role)) {
      throw new ControlAccessError("Không có quyền xử lý yêu cầu chỉnh sửa.", 403, "CONTENT_REVIEW_ROLE_REQUIRED");
    }
    return json({
      error: "Trung tâm đã chuyển sang đường đồng bộ trực tiếp. Hãy tải lại trang để tiếp tục.",
      code: "CONTROL_CLIENT_REFRESH_REQUIRED",
    }, 409);
  } catch (error) {
    return controlErrorResponse(error);
  }
}
