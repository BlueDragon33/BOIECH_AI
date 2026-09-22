import {
  DeviceAccessError,
  deviceErrorResponse,
  getCourseDatabase,
  normalizeAccessExpiry,
  requireDeviceAdmin,
} from "../../../device-auth.server";
import { COURSE_LESSON_NUMBERS } from "../../../course-content.server";
import { LESSON_PARTS, courseProgressKey, normalizeCompletedProgress } from "../../../course-logic";

export const dynamic = "force-dynamic";

type AdminDeviceRow = {
  device_id: string;
  display_code: string;
  status: "pending" | "approved" | "blocked";
  device_type: "desktop" | "phone" | "tablet";
  device_type_override: "desktop" | "phone" | "tablet" | null;
  platform: string | null;
  browser: string | null;
  label: string | null;
  learner_name: string | null;
  learner_family_name: string | null;
  learner_given_name: string | null;
  person_role: "learner" | "teacher" | null;
  class_name: string | null;
  phone: string | null;
  registration_submitted_at: string | null;
  access_expires_at: string | null;
  created_at: string;
  approved_at: string | null;
  blocked_at: string | null;
  last_seen_at: string;
  completed_json: string | null;
  scores_json: string | null;
  attempts_json: string | null;
  total_active_seconds: number | null;
  last_activity_at: string | null;
  last_lesson: string | null;
  last_part: string | null;
};

function normalizeTeacherClasses(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  const classes = raw
    .split(/[;\n,]+/)
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  const unique = [...new Map(classes.map((item) => [item.toLocaleLowerCase("vi"), item])).values()];
  if (unique.length > 12) throw new DeviceAccessError("Mỗi giảng viên được phân tối đa 12 lớp.", 400, "TOO_MANY_TEACHER_CLASSES");
  if (unique.some((item) => item.length > 50)) throw new DeviceAccessError("Tên mỗi lớp không được vượt quá 50 ký tự.", 400, "INVALID_TEACHER_CLASS");
  return unique;
}

function response(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
  });
}

function summary(row: AdminDeviceRow) {
  let completed: string[] = [];
  let scores: Record<string, number> = {};
  let attempts: Record<string, number> = {};
  try { completed = normalizeCompletedProgress(JSON.parse(row.completed_json ?? "[]")); } catch { completed = []; }
  try { scores = JSON.parse(row.scores_json ?? "{}") as Record<string, number>; } catch { scores = {}; }
  try { attempts = JSON.parse(row.attempts_json ?? "{}") as Record<string, number>; } catch { attempts = {}; }
  const completedParts = COURSE_LESSON_NUMBERS.reduce(
    (total, lessonNumber) => total + LESSON_PARTS.filter((part) => completed.includes(courseProgressKey(part, lessonNumber))).length,
    0,
  );
  const scoreTotal = COURSE_LESSON_NUMBERS.reduce((total, lessonNumber) => total + Math.max(0, Math.min(10, scores[lessonNumber] ?? 0)), 0);
  const lastActivity = row.last_activity_at ?? row.last_seen_at;
  const lastActivityTime = Date.parse(lastActivity);
  const accessExpired = Boolean(row.access_expires_at && Date.parse(row.access_expires_at) <= Date.now());
  const active = row.status === "approved" && !accessExpired && Number.isFinite(lastActivityTime) && Date.now() - lastActivityTime <= 15 * 60 * 1000;
  const detectedDeviceType = row.device_type === "phone" || row.device_type === "tablet" ? row.device_type : "desktop";
  const deviceTypeOverride = row.device_type_override === "desktop" || row.device_type_override === "phone" || row.device_type_override === "tablet"
    ? row.device_type_override
    : null;
  return {
    deviceId: row.device_id,
    deviceCode: row.display_code,
    status: row.status,
    deviceType: deviceTypeOverride ?? detectedDeviceType,
    detectedDeviceType,
    deviceTypeOverride,
    platform: row.platform,
    browser: row.browser,
    label: row.label,
    learnerName: row.learner_name,
    learnerFamilyName: row.learner_family_name,
    learnerGivenName: row.learner_given_name,
    personRole: row.person_role,
    className: row.class_name,
    teacherClasses: row.person_role === "teacher" ? normalizeTeacherClasses(row.class_name) : [],
    phone: row.phone,
    registrationComplete: Boolean(row.learner_name?.trim() && row.class_name?.trim() && row.phone?.trim() && row.registration_submitted_at),
    accessExpiresAt: row.access_expires_at,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    blockedAt: row.blocked_at,
    lastSeenAt: row.last_seen_at,
    lastActivityAt: lastActivity,
    active,
    completedLessons: COURSE_LESSON_NUMBERS.filter((lessonNumber) => completed.includes(`bai-${lessonNumber}`)).length,
    completedSteps: completedParts,
    completionPercent: Math.round((completedParts / 40) * 100),
    masteryPercent: Math.round((scoreTotal / 80) * 100),
    attempts: Object.values(attempts).reduce((total, value) => total + Math.max(0, Number(value) || 0), 0),
    totalActiveSeconds: Math.max(0, Number(row.total_active_seconds) || 0),
    lastLesson: row.last_lesson,
    lastPart: row.last_part,
  };
}

async function listDevices() {
  const database = await getCourseDatabase();
  const result = await database.prepare(
    `SELECT d.device_id, d.display_code, d.status, d.device_type, d.device_type_override, d.platform, d.browser, d.label, d.learner_name,
            d.learner_family_name, d.learner_given_name, d.person_role, d.class_name,
            d.phone, d.registration_submitted_at,
            d.access_expires_at, d.created_at, d.approved_at, d.blocked_at, d.last_seen_at,
            p.completed_json, p.scores_json, p.attempts_json, p.total_active_seconds,
            p.last_activity_at, p.last_lesson, p.last_part
       FROM device_access d
       LEFT JOIN device_profiles p ON p.device_id = d.device_id
      ORDER BY CASE d.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
               d.last_seen_at DESC
      LIMIT 200`,
  ).all<AdminDeviceRow>();
  return result.results.map(summary);
}

export async function GET() {
  try {
    await requireDeviceAdmin();
    return response({ devices: await listDevices() });
  } catch (error) {
    return deviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireDeviceAdmin();
    const payload = (await request.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : "";
    if (!/^[a-f0-9]{64}$/.test(deviceId)) {
      throw new DeviceAccessError("Mã thiết bị không hợp lệ.", 400, "INVALID_DEVICE");
    }
    const database = await getCourseDatabase();
    const exists = await database.prepare(
      "SELECT device_id, learner_name, person_role, class_name, phone, registration_submitted_at FROM device_access WHERE device_id = ?",
    ).bind(deviceId).first<{ device_id: string; learner_name: string | null; person_role: "learner" | "teacher" | null; class_name: string | null; phone: string | null; registration_submitted_at: string | null }>();
    if (!exists) throw new DeviceAccessError("Không tìm thấy thiết bị.", 404, "DEVICE_NOT_FOUND");

    if (action === "approve") {
      if (!exists.learner_name?.trim() || !exists.class_name?.trim() || !exists.phone?.trim() || !exists.registration_submitted_at) {
        throw new DeviceAccessError("Thiết bị chưa gửi đủ Họ tên, Lớp và Số điện thoại.", 409, "REGISTRATION_REQUIRED");
      }
      await database.batch([
        database.prepare(
          `UPDATE device_access
              SET status = 'approved', access_group = 'free', payment_status = 'free_approved',
                  approved_at = CURRENT_TIMESTAMP, blocked_at = NULL
            WHERE device_id = ?`,
        ).bind(deviceId),
        database.prepare(
          `INSERT INTO device_profiles (device_id, completed_json, scores_json)
           VALUES (?, '[]', '{}') ON CONFLICT(device_id) DO NOTHING`,
        ).bind(deviceId),
      ]);
    } else if (action === "block") {
      await database.prepare(
        `UPDATE device_access
            SET status = 'blocked', blocked_at = CURRENT_TIMESTAMP
          WHERE device_id = ?`,
      ).bind(deviceId).run();
    } else if (action === "label") {
      const label = typeof payload.label === "string" ? payload.label.trim().slice(0, 80) : "";
      await database.prepare(
        "UPDATE device_access SET label = ? WHERE device_id = ?",
      ).bind(label || null, deviceId).run();
    } else if (action === "device-type") {
      const requestedType = typeof payload.deviceType === "string" ? payload.deviceType : "auto";
      if (!["auto", "desktop", "phone", "tablet"].includes(requestedType)) {
        throw new DeviceAccessError("Phân loại thiết bị không hợp lệ.", 400, "INVALID_DEVICE_TYPE");
      }
      await database.prepare(
        "UPDATE device_access SET device_type_override = ?, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?",
      ).bind(requestedType === "auto" ? null : requestedType, deviceId).run();
    } else if (action === "teacher-classes") {
      if (exists.person_role !== "teacher") {
        throw new DeviceAccessError("Chỉ hồ sơ Giảng viên mới có thể được phân nhiều lớp.", 409, "TEACHER_ROLE_REQUIRED");
      }
      const classes = normalizeTeacherClasses(payload.teacherClasses);
      if (!classes.length) {
        throw new DeviceAccessError("Giảng viên phải được phân ít nhất một lớp.", 400, "TEACHER_CLASS_REQUIRED");
      }
      await database.prepare(
        "UPDATE device_access SET class_name = ?, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?",
      ).bind(classes.join("; "), deviceId).run();
      await database.prepare(
        "INSERT INTO course_audit_log (actor, action, target, detail_json) VALUES ('admin', 'teacher_classes_updated', ?, ?)",
      ).bind(deviceId, JSON.stringify({ classes })).run();
    } else if (action === "profile") {
      const learnerName = typeof payload.learnerName === "string" ? payload.learnerName.trim().slice(0, 100) : "";
      const accessExpiresAt = normalizeAccessExpiry(payload.accessExpiresAt);
      await database.prepare(
        "UPDATE device_access SET learner_name = ?, learner_family_name = NULL, learner_given_name = NULL, access_expires_at = ? WHERE device_id = ?",
      ).bind(learnerName || null, accessExpiresAt, deviceId).run();
    } else if (action === "reset-progress") {
      await database.prepare(
        `UPDATE device_profiles
            SET completed_json = '[]', scores_json = '{}', attempts_json = '{}',
                total_active_seconds = 0, last_activity_at = NULL,
                last_lesson = NULL, last_part = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE device_id = ?`,
      ).bind(deviceId).run();
    } else {
      throw new DeviceAccessError("Thao tác quản lý không hợp lệ.", 400, "INVALID_ADMIN_ACTION");
    }
    return response({ devices: await listDevices() });
  } catch (error) {
    return deviceErrorResponse(error);
  }
}
