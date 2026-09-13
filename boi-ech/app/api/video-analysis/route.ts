import {
  DeviceAccessError,
  getCourseDatabase,
  verifyDeviceRequest,
} from "../../device-auth.server";

export const dynamic = "force-dynamic";

const LESSONS = new Set(["01", "02", "03", "04", "05", "06", "07", "08"]);
const CAMERA_VIEWS = new Set(["rear", "side"]);
const SEVERITIES = new Set(["info", "warning", "critical"]);
const MAX_DETAIL_BYTES = 24 * 1024;
const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_ERRORS = 10;

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
  });
}

function text(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function number(value: unknown, minimum: number, maximum: number, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function integer(value: unknown, minimum: number, maximum: number, fallback = 0) {
  return Math.round(number(value, minimum, maximum, fallback));
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasForbiddenBinaryField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenBinaryField);
  const object = record(value);
  if (!object) return false;
  return Object.entries(object).some(([key, child]) => {
    if (/(?:video|frame|image|base64|blob|dataurl|objecturl|thumbnail)/i.test(key)) return true;
    return hasForbiddenBinaryField(child);
  });
}

async function readBoundedJson(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Kết quả không hợp lệ: máy chủ chỉ nhận JSON.");
  }
  const declaredBytes = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_REQUEST_BYTES) {
    throw new Error("Kết quả vượt giới hạn 32 KB.");
  }
  if (!request.body) throw new Error("Kết quả không hợp lệ: yêu cầu rỗng.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new Error("Kết quả vượt giới hạn 32 KB.");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>;
  } catch {
    throw new Error("Kết quả không hợp lệ: JSON bị lỗi.");
  }
}

function normalizeError(value: unknown) {
  const item = record(value);
  if (!item) return null;
  const code = text(item.code, 48).replace(/[^A-Z0-9_-]/gi, "_").toUpperCase();
  const title = text(item.title, 120);
  if (!code || !title) return null;
  const severityRaw = text(item.severity, 16);
  return {
    code,
    title,
    timeSec: number(item.timeSec, 0, 30, 0),
    severity: SEVERITIES.has(severityRaw) ? severityRaw : "warning",
    metric: text(item.metric, 48),
    observed: text(item.observed, 80),
    expected: text(item.expected, 100),
    recommendation: text(item.recommendation, 240),
    confidence: integer(item.confidence, 0, 100, 0),
  };
}

function normalizeAnalysis(value: unknown) {
  const source = record(value);
  if (!source || hasForbiddenBinaryField(source)) {
    throw new Error("Kết quả không hợp lệ: máy chủ chỉ nhận dữ liệu phân tích, không nhận video hoặc ảnh.");
  }

  const cameraViewRaw = text(source.cameraView, 16);
  const categoriesSource = record(source.categories) ?? {};
  const errors = Array.isArray(source.errors)
    ? source.errors.slice(0, MAX_ERRORS).map(normalizeError).filter(Boolean)
    : [];

  const normalized = {
    id: text(source.id, 80).replace(/[^A-Za-z0-9:_-]/g, ""),
    engineVersion: text(source.engineVersion, 64) || "breaststroke-local-v1",
    analyzedAt: text(source.analyzedAt, 40),
    durationSec: number(source.durationSec, 0.1, 30, 0.1),
    fileSizeBytes: integer(source.fileSizeBytes, 0, 50 * 1024 * 1024, 0),
    width: integer(source.width, 1, 7680, 1),
    height: integer(source.height, 1, 4320, 1),
    sampledFrames: integer(source.sampledFrames, 1, 240, 1),
    detectedFrames: integer(source.detectedFrames, 0, 240, 0),
    cameraView: CAMERA_VIEWS.has(cameraViewRaw) ? cameraViewRaw : "rear",
    score: integer(source.score, 0, 100, 0),
    confidence: integer(source.confidence, 0, 100, 0),
    categories: {
      legs: integer(categoriesSource.legs, 0, 100, 0),
      arms: integer(categoriesSource.arms, 0, 100, 0),
      coordination: integer(categoriesSource.coordination, 0, 100, 0),
      bodyLine: integer(categoriesSource.bodyLine, 0, 100, 0),
    },
    errors,
  };

  if (!normalized.id || normalized.detectedFrames > normalized.sampledFrames) {
    throw new Error("Kết quả phân tích thiếu mã phiên hoặc số khung hình không hợp lệ.");
  }
  const bytes = new TextEncoder().encode(JSON.stringify(normalized)).byteLength;
  if (bytes > MAX_DETAIL_BYTES) throw new Error("Kết quả phân tích vượt giới hạn đồng bộ.");
  return normalized;
}

export async function POST(request: Request) {
  try {
    const payload = await readBoundedJson(request);
    const hostname = new URL(request.url).hostname;
    const previewRequest = hostname === "terminal.local" || hostname === "localhost";
    const device = await verifyDeviceRequest(payload, previewRequest);
    const lessonNumber = text(payload.lessonNumber, 2);
    if (!LESSONS.has(lessonNumber)) return json({ error: "Bài học không hợp lệ." }, 400);

    const analysis = normalizeAnalysis(payload.analysis);
    const database = await getCourseDatabase();
    const clientEventId = `video-ai:${analysis.id}`.slice(0, 100);

    await database.prepare(
      `INSERT OR IGNORE INTO course_activity_events
        (device_id, event_type, lesson_number, part, detail_json, client_event_id)
       VALUES (?, 'video_ai_analysis', ?, 'phan-tich', ?, ?)`,
    ).bind(device.deviceId, lessonNumber, JSON.stringify(analysis), clientEventId).run();

    await database.prepare(
      `UPDATE device_profiles
          SET last_activity_at = CURRENT_TIMESTAMP,
              last_lesson = ?,
              last_part = 'phan-tich',
              updated_at = CURRENT_TIMESTAMP
        WHERE device_id = ?`,
    ).bind(lessonNumber, device.deviceId).run();

    return json({ saved: true, analysisId: analysis.id });
  } catch (error) {
    if (error instanceof DeviceAccessError) {
      return json({ error: error.message, code: error.code, device: error.device }, error.status);
    }
    const message = error instanceof Error ? error.message : "Không thể lưu kết quả phân tích.";
    const status = /vượt giới hạn/i.test(message) ? 413 : /không hợp lệ|thiếu mã/i.test(message) ? 400 : 500;
    return json({ error: status === 500 ? "Dịch vụ lưu kết quả đang tạm gián đoạn." : message }, status);
  }
}
