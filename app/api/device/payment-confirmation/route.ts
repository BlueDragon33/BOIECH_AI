import {
  DeviceAccessError,
  deviceErrorResponse,
  getCourseDatabase,
  verifyDeviceIdentityRequest,
} from "../../../device-auth.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      deviceId?: string;
      challenge?: string;
      signature?: string;
    };

    const hostname = new URL(request.url).hostname;
    const previewRequest =
      hostname === "terminal.local" || hostname === "localhost";

    const device = await verifyDeviceIdentityRequest(payload, previewRequest);

    if (!device.registrationComplete) {
      throw new DeviceAccessError(
        "Hãy hoàn thành thông tin người học trước khi thanh toán.",
        409,
        "REGISTRATION_REQUIRED",
        device,
      );
    }

    if (!["awaiting_payment", "proof_submitted"].includes(device.paymentStatus)) {
      throw new DeviceAccessError(
        "Thiết bị chưa được yêu cầu thanh toán.",
        409,
        "PAYMENT_NOT_REQUESTED",
        device,
      );
    }

    const database = await getCourseDatabase();
    const submittedAt = new Date().toISOString();
    const reviewId = crypto.randomUUID();

    // Dùng mã thiết bị làm nội dung chuyển khoản và mã đối chiếu.
    const paymentReference = device.deviceCode;

    await database.batch([
      database.prepare(
        `UPDATE device_access
            SET payment_status = 'proof_submitted',
                payment_proof_key = ?,
                payment_proof_name = ?,
                payment_proof_content_type = 'text/plain',
                payment_proof_size = NULL,
                payment_submitted_at = ?,
                payment_verified_at = NULL,
                payment_rejected_at = NULL,
                payment_review_note = NULL,
                updated_at = CURRENT_TIMESTAMP
          WHERE device_id = ?`,
      ).bind(
        paymentReference,
        `Nội dung chuyển khoản: ${paymentReference}`,
        submittedAt,
        device.deviceId,
      ),

      database.prepare(
        `UPDATE payment_reviews
            SET status = 'replaced',
                reviewed_at = CURRENT_TIMESTAMP,
                review_note = 'Người học đã gửi xác nhận thanh toán mới.'
          WHERE device_id = ?
            AND status = 'submitted'`,
      ).bind(device.deviceId),

      database.prepare(
        `INSERT INTO payment_reviews
          (id, device_id, status, proof_key, proof_name, submitted_at)
         VALUES (?, ?, 'submitted', ?, ?, ?)`,
      ).bind(
        reviewId,
        device.deviceId,
        paymentReference,
        `Nội dung chuyển khoản: ${paymentReference}`,
        submittedAt,
      ),

      database.prepare(
        `INSERT INTO course_audit_log
          (actor, action, target, detail_json)
         VALUES (?, 'payment_confirmation_submitted', ?, ?)`,
      ).bind(
        device.deviceCode,
        device.deviceId,
        JSON.stringify({ reviewId, paymentReference }),
      ),
    ]);

    return Response.json(
      {
        ok: true,
        paymentStatus: "proof_submitted",
        paymentSubmittedAt: submittedAt,
        paymentReference,
      },
      {
        headers: {
          "cache-control": "no-store, private",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch (error) {
    return deviceErrorResponse(error);
  }
}
