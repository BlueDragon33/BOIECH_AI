import { DeviceAccessError, getCourseDatabase, verifyDeviceRequest } from "../../device-auth.server";

export const dynamic = "force-dynamic";

const LESSONS = ["01", "02", "03", "04", "05", "06", "07", "08"] as const;

type CertificateRow = {
  verification_code: string;
  device_code: string;
  learner_name: string;
  class_name: string;
  scores_json: string;
  total_active_seconds: number;
  completed_at: string;
  course_version: number;
  issued_at: string;
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
  });
}

function parse<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function publicCertificate(row: CertificateRow) {
  return {
    verificationCode: row.verification_code,
    deviceCode: row.device_code,
    learnerName: row.learner_name,
    className: row.class_name,
    scores: parse<Record<string, number>>(row.scores_json, {}),
    totalActiveSeconds: Math.max(0, Number(row.total_active_seconds) || 0),
    completedAt: row.completed_at,
    courseVersion: row.course_version,
    issuedAt: row.issued_at,
    courseTitle: "Ứng dụng AI trong dạy và học môn Bơi ếch",
  };
}

async function certificateForCode(code: string) {
  const database = await getCourseDatabase();
  return database.prepare(
    `SELECT verification_code, device_code, learner_name, class_name, scores_json,
            total_active_seconds, completed_at, course_version, issued_at
       FROM course_certificates WHERE verification_code = ?`,
  ).bind(code).first<CertificateRow>();
}

function verificationCode() {
  const value = [...crypto.getRandomValues(new Uint8Array(10))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `BECH-${value.slice(0, 5)}-${value.slice(5, 10)}-${value.slice(10, 15)}-${value.slice(15)}`;
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim().toUpperCase() ?? "";
  if (!/^BECH-[A-F0-9]{5}(?:-[A-F0-9]{5}){3}$/.test(code)) return json({ valid: false, error: "Mã chứng chỉ không hợp lệ." }, 400);
  const row = await certificateForCode(code);
  if (!row) return json({ valid: false, error: "Không tìm thấy chứng chỉ." }, 404);
  return json({ valid: true, certificate: publicCertificate(row) });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const hostname = new URL(request.url).hostname;
    const previewRequest = hostname === "terminal.local" || hostname === "localhost";
    const device = await verifyDeviceRequest(payload, previewRequest);
    if (!device.registrationComplete || !device.learnerName || !device.className) {
      return json({ error: "Hồ sơ người học chưa đầy đủ." }, 409);
    }
    const database = await getCourseDatabase();
    const profile = await database.prepare(
      `SELECT completed_json, scores_json, total_active_seconds
         FROM device_profiles WHERE device_id = ?`,
    ).bind(device.deviceId).first<{ completed_json: string; scores_json: string; total_active_seconds: number }>();
    const completed = parse<string[]>(profile?.completed_json ?? "[]", []);
    const scores = parse<Record<string, number>>(profile?.scores_json ?? "{}", {});
    if (!LESSONS.every((lesson) => completed.includes(`bai-${lesson}`) && Number(scores[lesson]) >= 8)) {
      return json({ error: "Chỉ tạo chứng chỉ sau khi hoàn thành đủ 8 bài và đạt tối thiểu 8/10 mỗi bài." }, 409);
    }

    const existing = await database.prepare(
      `SELECT verification_code, device_code, learner_name, class_name, scores_json,
              total_active_seconds, completed_at, course_version, issued_at
         FROM course_certificates WHERE device_id = ?`,
    ).bind(device.deviceId).first<CertificateRow>();
    if (existing) return json({ certificate: publicCertificate(existing), created: false });

    const completion = await database.prepare(
      `SELECT MAX(created_at) AS completed_at FROM course_activity_events
        WHERE device_id = ? AND event_type = 'quiz_submit'
          AND CAST(json_extract(detail_json, '$.passed') AS INTEGER) = 1`,
    ).bind(device.deviceId).first<{ completed_at: string | null }>();
    const published = await database.prepare(
      "SELECT version_number FROM course_content_versions WHERE status = 'published' ORDER BY version_number DESC LIMIT 1",
    ).first<{ version_number: number }>();
    const code = verificationCode();
    const issuedAt = new Date().toISOString();
    const completedAt = completion?.completed_at ?? issuedAt;
    const courseVersion = Number(published?.version_number) || 1;
    await database.batch([
      database.prepare(
        `INSERT INTO course_certificates
          (id, verification_code, device_id, device_code, learner_name, class_name,
           scores_json, total_active_seconds, completed_at, course_version, issued_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(), code, device.deviceId, device.deviceCode, device.learnerName,
        device.className, JSON.stringify(scores), Math.max(0, Number(profile?.total_active_seconds) || 0),
        completedAt, courseVersion, issuedAt,
      ),
      database.prepare(
        "INSERT INTO course_audit_log (actor, action, target, detail_json) VALUES (?, 'course_certificate_issued', ?, ?)",
      ).bind(device.deviceCode, device.deviceId, JSON.stringify({ verificationCode: code, courseVersion })),
    ]);
    const row = await certificateForCode(code);
    if (!row) return json({ error: "Không thể đọc chứng chỉ vừa tạo." }, 500);
    return json({ certificate: publicCertificate(row), created: true }, 201);
  } catch (error) {
    if (error instanceof DeviceAccessError) return json({ error: error.message, code: error.code, device: error.device }, error.status);
    return json({ error: "Dịch vụ chứng chỉ đang tạm gián đoạn." }, 500);
  }
}
