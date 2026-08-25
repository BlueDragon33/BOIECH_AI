import { controlPreflight, requireControlService, withControlCors } from "../../../control-auth.server";
import { DeviceAccessError, deviceErrorResponse, getCourseDatabase } from "../../../device-auth.server";

export const dynamic = "force-dynamic";

type ProofObject = { body: ReadableStream; httpMetadata?: { contentType?: string } };
type PaymentBucket = { get(key: string): Promise<ProofObject | null> };

export function OPTIONS(request: Request) {
  return controlPreflight(request);
}

export async function GET(request: Request) {
  try {
    const { role } = await requireControlService(request);
    if (!['publisher', 'owner'].includes(role)) {
      throw new DeviceAccessError("Không có quyền xem ảnh chuyển khoản.", 403, "PAYMENT_PROOF_FORBIDDEN");
    }
    const deviceId = new URL(request.url).searchParams.get("deviceId") ?? "";
    if (!/^[a-f0-9]{64}$/.test(deviceId)) {
      throw new DeviceAccessError("Mã thiết bị không hợp lệ.", 400, "INVALID_DEVICE");
    }
    const database = await getCourseDatabase();
    const row = await database.prepare(
      "SELECT payment_proof_key, payment_proof_content_type FROM device_access WHERE device_id = ?",
    ).bind(deviceId).first<{ payment_proof_key: string | null; payment_proof_content_type: string | null }>();
    if (!row?.payment_proof_key) {
      throw new DeviceAccessError("Thiết bị chưa gửi ảnh chuyển khoản.", 404, "PAYMENT_PROOF_NOT_FOUND");
    }
    const workers = await import("cloudflare:workers");
    const bucket = (workers.env as unknown as { BUCKET?: PaymentBucket }).BUCKET;
    if (!bucket) throw new DeviceAccessError("Kho ảnh chuyển khoản chưa sẵn sàng.", 503, "PAYMENT_STORAGE_UNAVAILABLE");
    const object = await bucket.get(row.payment_proof_key);
    if (!object) throw new DeviceAccessError("Không tìm thấy ảnh chuyển khoản.", 404, "PAYMENT_PROOF_NOT_FOUND");
    return withControlCors(request, new Response(object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType || row.payment_proof_content_type || "application/octet-stream",
        "cache-control": "no-store, private",
        "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
        "x-content-type-options": "nosniff",
      },
    }));
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}
