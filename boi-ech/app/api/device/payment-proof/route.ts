import { DeviceAccessError, deviceErrorResponse, getCourseDatabase, verifyDeviceIdentityRequest } from "../../../device-auth.server";

export const dynamic = "force-dynamic";

type StoredObject = { key: string };
type PaymentBucket = {
  put(key: string, value: ArrayBuffer, options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string> }): Promise<StoredObject>;
  delete(key: string): Promise<void>;
};

async function paymentBucket() {
  const workers = await import("cloudflare:workers");
  const bucket = (workers.env as unknown as { BUCKET?: PaymentBucket }).BUCKET;
  if (!bucket) throw new DeviceAccessError("Kho ảnh chuyển khoản chưa sẵn sàng.", 503, "PAYMENT_STORAGE_UNAVAILABLE");
  return bucket;
}

function formValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function hasValidImageSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  if (contentType === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function POST(request: Request) {
  let uploadedKey = "";
  try {
    const form = await request.formData();
    const hostname = new URL(request.url).hostname;
    const previewRequest = hostname === "terminal.local" || hostname === "localhost";
    const payload = {
      deviceId: formValue(form, "deviceId"),
      challenge: formValue(form, "challenge"),
      signature: formValue(form, "signature"),
    };
    const device = await verifyDeviceIdentityRequest(payload, previewRequest);
    if (!device.registrationComplete) {
      throw new DeviceAccessError("Hãy gửi đủ hồ sơ đăng ký trước khi gửi ảnh chuyển khoản.", 409, "REGISTRATION_REQUIRED", device);
    }
    if (!['awaiting_payment', 'proof_submitted'].includes(device.paymentStatus)) {
      throw new DeviceAccessError("Thiết bị chưa được Trung tâm yêu cầu thanh toán.", 409, "PAYMENT_NOT_REQUESTED", device);
    }

    const file = form.get("proof");
    if (!(file instanceof File) || file.size === 0) {
      throw new DeviceAccessError("Hãy chọn ảnh chuyển khoản.", 400, "PAYMENT_PROOF_REQUIRED", device);
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new DeviceAccessError("Ảnh chuyển khoản không được vượt quá 5 MB.", 413, "PAYMENT_PROOF_TOO_LARGE", device);
    }
    const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const extension = extensions[file.type];
    if (!extension) {
      throw new DeviceAccessError("Chỉ nhận ảnh JPG, PNG hoặc WebP.", 415, "PAYMENT_PROOF_INVALID_TYPE", device);
    }
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidImageSignature(file.type, fileBytes)) {
      throw new DeviceAccessError("Tệp tải lên không phải ảnh hợp lệ.", 415, "PAYMENT_PROOF_INVALID_FILE", device);
    }

    const database = await getCourseDatabase();
    const current = await database.prepare("SELECT payment_proof_key FROM device_access WHERE device_id = ?")
      .bind(device.deviceId).first<{ payment_proof_key: string | null }>();
    uploadedKey = `payment-proofs/${device.deviceId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const bucket = await paymentBucket();
    await bucket.put(uploadedKey, fileBytes.buffer, {
      httpMetadata: { contentType: file.type },
      customMetadata: { deviceCode: device.deviceCode, originalName: file.name.slice(0, 160) },
    });
    const submittedAt = new Date().toISOString();
    const reviewId = crypto.randomUUID();
    await database.batch([
      database.prepare(
        `UPDATE device_access SET payment_status = 'proof_submitted', payment_proof_key = ?,
          payment_proof_name = ?, payment_proof_content_type = ?, payment_proof_size = ?,
          payment_submitted_at = ?, payment_verified_at = NULL, payment_rejected_at = NULL,
          payment_review_note = NULL, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?`,
      ).bind(uploadedKey, file.name.slice(0, 160), file.type, file.size, submittedAt, device.deviceId),
      database.prepare(
        `UPDATE payment_reviews SET status = 'replaced', reviewed_at = CURRENT_TIMESTAMP,
                review_note = 'Người học đã gửi ảnh thay thế.'
          WHERE device_id = ? AND status = 'submitted'`,
      ).bind(device.deviceId),
      database.prepare(
        `INSERT INTO payment_reviews
          (id, device_id, status, proof_key, proof_name, submitted_at)
         VALUES (?, ?, 'submitted', ?, ?, ?)`,
      ).bind(reviewId, device.deviceId, uploadedKey, file.name.slice(0, 160), submittedAt),
      database.prepare(
        "INSERT INTO course_audit_log (actor, action, target, detail_json) VALUES (?, 'payment_proof_submitted', ?, ?)",
      ).bind(device.deviceCode, device.deviceId, JSON.stringify({ reviewId, fileName: file.name.slice(0, 160), size: file.size })),
    ]);
    if (current?.payment_proof_key && current.payment_proof_key !== uploadedKey) {
      await bucket.delete(current.payment_proof_key).catch(() => undefined);
    }
    return Response.json(
      { ok: true, paymentStatus: "proof_submitted", paymentSubmittedAt: submittedAt },
      { headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } },
    );
  } catch (error) {
    if (uploadedKey) {
      try { await (await paymentBucket()).delete(uploadedKey); } catch { /* Best-effort cleanup. */ }
    }
    return deviceErrorResponse(error);
  }
}
