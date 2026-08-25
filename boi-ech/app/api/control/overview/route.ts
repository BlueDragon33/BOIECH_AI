import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import { COURSE_LESSON_NUMBERS } from "../../../course-content.server";
import { LESSON_PARTS, courseProgressKey, normalizeCompletedProgress } from "../../../course-logic";
import {
  accessExpiryAfterDays,
  deviceErrorResponse,
  getAccessAutomationSettings,
  getCourseDatabase,
  normalizeAccessExpiry,
} from "../../../device-auth.server";

export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return controlPreflight(request);
}

const DEVICE_PRESENCE_TIMEOUT_MS = 150_000;

type PaymentBucket = { delete(key: string): Promise<void> };

async function paymentBucket() {
  const workers = await import("cloudflare:workers");
  return (workers.env as unknown as { BUCKET?: PaymentBucket }).BUCKET;
}

function normalizedNamePart(value: unknown, maximum: number) {
  const normalized = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : "";
  return normalized && /[\p{L}\p{M}]/u.test(normalized) && !/[^\p{L}\p{M}\s'.-]/u.test(normalized) ? normalized : "";
}

type Row = {
  device_id: string;
  display_code: string;
  status: "pending" | "approved" | "blocked";
  label: string | null;
  learner_name: string | null;
  learner_family_name: string | null;
  learner_given_name: string | null;
  person_role: "learner" | "teacher" | null;
  person_code: string | null;
  class_name: string | null;
  phone: string | null;
  registration_submitted_at: string | null;
  access_group: "unassigned" | "free" | "paid";
  payment_status: "unassigned" | "awaiting_payment" | "proof_submitted" | "free_approved" | "paid_verified";
  payment_proof_key: string | null;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
  payment_rejected_at: string | null;
  payment_review_note: string | null;
  access_expires_at: string | null;
  personal_edit_enabled: number | null;
  auto_confirmed_at: string | null;
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

type ActivityRow = {
  device_id: string;
  event_type: string;
  lesson_number: string | null;
  part: string | null;
  detail_json: string;
  created_at: string;
};

type FirstCompletionRow = {
  device_id: string;
  lesson_number: string | null;
  part: string | null;
  created_at: string;
};

type ActivityDay = {
  date: string;
  loginCount: number;
  studyMinutes: number;
  quizAttempts: number;
  progressPercent: number;
};

type DeletedDeviceRow = {
  device_id: string;
  display_code: string;
  reason: "spam" | "duplicate" | "test" | "other";
  learner_name: string | null;
  deleted_by: string;
  deleted_at: string;
};

function parse<T>(value: string | null, fallback: T): T {
  try { return JSON.parse(value ?? "") as T; } catch { return fallback; }
}

function isoDay(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "";
}

function activityDays(dayCount: number) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - (dayCount - 1 - index));
    return isoDay(date);
  });
}

function view(row: Row) {
  const completed = normalizeCompletedProgress(parse<unknown>(row.completed_json, []));
  const scores = parse<Record<string, number>>(row.scores_json, {});
  const attempts = parse<Record<string, number>>(row.attempts_json, {});
  const completedSteps = COURSE_LESSON_NUMBERS.reduce(
    (total, lesson) => total + LESSON_PARTS.filter((part) => completed.includes(courseProgressKey(part, lesson))).length,
    0,
  );
  const scoreTotal = COURSE_LESSON_NUMBERS.reduce((total, lesson) => total + Math.max(0, Math.min(10, scores[lesson] ?? 0)), 0);
  const lastPresenceAt = row.last_seen_at;
  const lastPresenceTime = Date.parse(lastPresenceAt);
  const active = row.status !== "blocked"
    && Number.isFinite(lastPresenceTime)
    && Date.now() - lastPresenceTime <= DEVICE_PRESENCE_TIMEOUT_MS;
  const offlineSinceAt = active || !Number.isFinite(lastPresenceTime)
    ? null
    : new Date(lastPresenceTime + DEVICE_PRESENCE_TIMEOUT_MS).toISOString();
  const registrationComplete = Boolean(row.learner_name?.trim() && row.person_role && row.person_code?.trim() && row.class_name?.trim() && row.phone?.trim() && row.registration_submitted_at);
  const expiryTime = row.access_expires_at ? Date.parse(row.access_expires_at) : Number.NaN;
  const accessExpired = Number.isFinite(expiryTime) && expiryTime <= Date.now();
  const accessExpiringSoon = !accessExpired && Number.isFinite(expiryTime) && expiryTime - Date.now() <= 7 * 24 * 60 * 60 * 1000;
  const accessDaysRemaining = Number.isFinite(expiryTime)
    ? Math.max(0, Math.ceil((expiryTime - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;
  return {
    deviceId: row.device_id,
    deviceCode: row.display_code,
    status: row.status,
    label: row.label,
    learnerName: row.learner_name,
    learnerFamilyName: row.learner_family_name,
    learnerGivenName: row.learner_given_name,
    personRole: row.person_role,
    personCode: row.person_code,
    className: row.class_name,
    phone: row.phone,
    registrationComplete,
    accessGroup: row.access_group ?? "unassigned",
    paymentStatus: row.payment_status ?? "unassigned",
    paymentAmount: 50_000,
    paymentProofAvailable: Boolean(row.payment_proof_key),
    paymentSubmittedAt: row.payment_submitted_at,
    paymentVerifiedAt: row.payment_verified_at,
    paymentRejectedAt: row.payment_rejected_at,
    paymentReviewNote: row.payment_review_note,
    accessExpiresAt: row.access_expires_at,
    accessExpired,
    accessExpiringSoon,
    accessDaysRemaining,
    personalEditEnabled: row.personal_edit_enabled === 1 && !accessExpired,
    personalEditConfigured: row.personal_edit_enabled === 1,
    autoConfirmedAt: row.auto_confirmed_at,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    blockedAt: row.blocked_at,
    lastSeenAt: row.last_seen_at,
    lastPresenceAt,
    offlineSinceAt,
    lastLearningActivityAt: row.last_activity_at,
    lastActivityAt: row.last_activity_at ?? row.last_seen_at,
    active,
    completedLessons: COURSE_LESSON_NUMBERS.filter((lesson) => completed.includes(`bai-${lesson}`)).length,
    completedSteps,
    completionPercent: Math.round((completedSteps / 40) * 100),
    masteryPercent: Math.round((scoreTotal / 80) * 100),
    attempts: Object.values(attempts).reduce((total, value) => total + Math.max(0, Number(value) || 0), 0),
    totalActiveSeconds: Math.max(0, Number(row.total_active_seconds) || 0),
    lastLesson: row.last_lesson,
    lastPart: row.last_part,
    scores,
    activityTimeline: [] as ActivityDay[],
  };
}

async function attachActivity<T extends ReturnType<typeof view>>(devices: T[], dayCount: number) {
  if (devices.length === 0 || dayCount <= 0) return devices;
  const database = await getCourseDatabase();
  const ids = devices.map((device) => device.deviceId);
  const placeholders = ids.map(() => "?").join(", ");
  const days = activityDays(dayCount);
  const startDay = days[0];
  const [recentResult, completionResult] = await Promise.all([
    database.prepare(
      `SELECT device_id, event_type, lesson_number, part, detail_json, created_at
         FROM course_activity_events
        WHERE device_id IN (${placeholders}) AND created_at >= ?
        ORDER BY created_at ASC LIMIT 20000`,
    ).bind(...ids, `${startDay} 00:00:00`).all<ActivityRow>(),
    database.prepare(
      `SELECT device_id, lesson_number, part, MIN(created_at) AS created_at
         FROM course_activity_events
        WHERE device_id IN (${placeholders}) AND event_type = 'part_complete'
        GROUP BY device_id, lesson_number, part`,
    ).bind(...ids).all<FirstCompletionRow>(),
  ]);
  return devices.map((device) => {
    const timeline = new Map(days.map((date) => [date, { date, loginCount: 0, studyMinutes: 0, quizAttempts: 0, progressPercent: 0 }]));
    for (const event of recentResult.results) {
      if (event.device_id !== device.deviceId) continue;
      const detail = parse<Record<string, unknown>>(event.detail_json, {});
      const occurredAt = event.event_type === "offline_session" && typeof detail.occurredAt === "string"
        ? detail.occurredAt
        : event.created_at;
      const day = timeline.get(isoDay(occurredAt));
      if (!day) continue;
      if (event.event_type === "lesson_open") day.loginCount += 1;
      if (event.event_type === "quiz_submit") day.quizAttempts += 1;
      if (event.event_type === "heartbeat" || event.event_type === "offline_session") {
        day.studyMinutes += Math.max(0, Number(detail.activeSeconds) || 0) / 60;
      }
    }
    const recentFirstCompletions = completionResult.results.filter((item: FirstCompletionRow) => item.device_id === device.deviceId && timeline.has(isoDay(item.created_at)));
    let cumulativeSteps = Math.max(0, device.completedSteps - recentFirstCompletions.length);
    for (const date of days) {
      cumulativeSteps += recentFirstCompletions.filter((item: FirstCompletionRow) => isoDay(item.created_at) === date).length;
      const day = timeline.get(date)!;
      day.studyMinutes = Math.round(day.studyMinutes);
      day.progressPercent = Math.round((Math.min(40, cumulativeSteps) / 40) * 100);
    }
    return { ...device, activityTimeline: days.map((date) => timeline.get(date)!) };
  });
}

async function rows(displayCodes?: string[], activityDayCount = 30) {
  if (displayCodes && displayCodes.length === 0) return [];
  const database = await getCourseDatabase();
  const where = displayCodes ? `WHERE d.display_code IN (${displayCodes.map(() => "?").join(", ")})` : "";
  const statement = database.prepare(
    `SELECT d.device_id, d.display_code, d.status, d.label, d.learner_name,
            d.learner_family_name, d.learner_given_name, d.person_role, d.person_code, d.class_name,
            d.phone, d.registration_submitted_at, d.access_group, d.payment_status,
            d.payment_proof_key, d.payment_submitted_at, d.payment_verified_at,
            d.payment_rejected_at, d.payment_review_note,
            d.access_expires_at, d.personal_edit_enabled, d.auto_confirmed_at,
            d.created_at, d.approved_at, d.blocked_at, d.last_seen_at,
            p.completed_json, p.scores_json, p.attempts_json, p.total_active_seconds,
            p.last_activity_at, p.last_lesson, p.last_part
       FROM device_access d LEFT JOIN device_profiles p ON p.device_id = d.device_id
      ${where}
      ORDER BY CASE d.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
               COALESCE(p.last_activity_at, d.last_seen_at) DESC LIMIT 500`,
  );
  const result = await (displayCodes ? statement.bind(...displayCodes) : statement).all<Row>();
  return attachActivity(result.results.map(view), activityDayCount);
}

async function auditRows() {
  const database = await getCourseDatabase();
  const result = await database.prepare(
    `SELECT id, actor, action, target, detail_json, created_at
       FROM course_audit_log ORDER BY id DESC LIMIT 200`,
  ).all<{ id: number; actor: string; action: string; target: string; detail_json: string; created_at: string }>();
  return result.results.map((row: { id: number; actor: string; action: string; target: string; detail_json: string; created_at: string }) => ({
    id: `boi-ech-${row.id}`,
    source: "Bơi ếch",
    actor: row.actor,
    action: row.action,
    target: row.target,
    detail: parse<Record<string, unknown>>(row.detail_json, {}),
    createdAt: row.created_at,
  }));
}

async function deletedDeviceRows() {
  const database = await getCourseDatabase();
  const result = await database.prepare(
    `SELECT device_id, display_code, reason, learner_name, deleted_by, deleted_at
       FROM device_deletion_tombstones ORDER BY deleted_at DESC LIMIT 200`,
  ).all<DeletedDeviceRow>();
  return result.results.map((row: DeletedDeviceRow) => ({
    deviceId: row.device_id,
    deviceCode: row.display_code,
    reason: row.reason,
    learnerName: row.learner_name,
    deletedBy: row.deleted_by,
    deletedAt: row.deleted_at,
  }));
}

export async function GET(request: Request) {
  try {
    const { role } = await requireControlService(request);
    const searchParams = new URL(request.url).searchParams;
    const deviceCodePattern = /^BE-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
    const suppliedCode = searchParams.get("deviceCode");
    const suppliedCodes = searchParams.get("deviceCodes");
    const requestedActivityDays = Number(searchParams.get("activityDays") ?? "30");
    const activityDayCount = Number.isFinite(requestedActivityDays)
      ? Math.max(0, Math.min(90, Math.floor(requestedActivityDays)))
      : 30;
    const requestedCodes = suppliedCode !== null
      ? [suppliedCode.trim().toUpperCase()].filter((code) => deviceCodePattern.test(code))
      : suppliedCodes !== null
        ? [...new Set(suppliedCodes.split(",").map((code) => code.trim().toUpperCase()).filter((code) => deviceCodePattern.test(code)))].slice(0, 500)
        : undefined;
    return controlResponse({
      application: { id: "boi-ech", name: "Bơi ếch AI", lessonCount: 8 },
      devices: await rows(requestedCodes, activityDayCount),
      ...(requestedCodes === undefined && role === "owner" ? { deletedDevices: await deletedDeviceRows() } : {}),
      automation: await getAccessAutomationSettings(),
      auditLog: requestedCodes === undefined && ["publisher", "owner"].includes(role) ? await auditRows() : [],
    }, 200, request);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}

export async function POST(request: Request) {
  try {
    const { actor, role } = await requireControlService(request);
    if (!["publisher", "owner"].includes(role)) return controlResponse({ error: "Không có quyền quản lý thiết bị học." }, 403, request);
    const respond = (data: unknown, status = 200) => controlResponse(data, status, request);
    const payload = (await request.json()) as Record<string, unknown>;
    const requestedAction = typeof payload.action === "string" ? payload.action : "";
    const action = requestedAction === "approve" ? "grant-free" : requestedAction;
    const database = await getCourseDatabase();

    if (action === "update-automation") {
      const enabled = payload.enabled === true;
      const defaultAccessDays = Math.floor(Number(payload.defaultAccessDays));
      const defaultDeviceLimit = Math.floor(Number(payload.defaultDeviceLimit));
      if (!Number.isFinite(defaultAccessDays) || defaultAccessDays < 1 || defaultAccessDays > 365) {
        return respond({ error: "Thời hạn tự động phải từ 1 đến 365 ngày." }, 400);
      }
      if (!Number.isFinite(defaultDeviceLimit) || defaultDeviceLimit < 1 || defaultDeviceLimit > 1_000) {
        return respond({ error: "Hạn mức tự động phải từ 1 đến 1.000 thiết bị." }, 400);
      }
      await database.batch([
        database.prepare(
          `INSERT INTO access_automation_settings
            (id, auto_confirm_new_devices, default_access_days, default_device_limit, updated_by, updated_at)
           VALUES ('global', ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET auto_confirm_new_devices = excluded.auto_confirm_new_devices,
             default_access_days = excluded.default_access_days,
             default_device_limit = excluded.default_device_limit, updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
        ).bind(enabled ? 1 : 0, defaultAccessDays, defaultDeviceLimit, actor),
        database.prepare(
          "INSERT INTO course_audit_log (actor, action, target, detail_json) VALUES (?, 'access_automation_updated', 'global', ?)",
        ).bind(actor, JSON.stringify({ enabled, defaultAccessDays, defaultDeviceLimit, source: "control-center" })),
      ]);
      return respond({ automation: await getAccessAutomationSettings() });
    }

    const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : "";
    if (!/^[a-f0-9]{64}$/.test(deviceId)) return respond({ error: "Mã thiết bị không hợp lệ." }, 400);

    if (action === "restore-deleted-device") {
      if (role !== "owner") {
        return respond({ error: "Chỉ Chủ hệ thống mới được cho phép thiết bị đã xóa đăng ký lại." }, 403);
      }
      const deleted = await database.prepare(
        "SELECT display_code, reason FROM device_deletion_tombstones WHERE device_id = ?",
      ).bind(deviceId).first<{ display_code: string; reason: string }>();
      if (!deleted) return respond({ error: "Thiết bị không còn trong danh sách đã xóa." }, 404);
      const confirmedCode = typeof payload.confirmDeviceCode === "string"
        ? payload.confirmDeviceCode.trim().toUpperCase()
        : "";
      if (confirmedCode !== deleted.display_code) {
        return respond({ error: `Hãy nhập chính xác mã ${deleted.display_code} để cho phép đăng ký lại.` }, 409);
      }
      await database.batch([
        database.prepare("DELETE FROM device_deletion_tombstones WHERE device_id = ?").bind(deviceId),
        database.prepare(
          "INSERT INTO course_audit_log (actor, action, target, detail_json) VALUES (?, 'learning_device_registration_reopened', ?, ?)",
        ).bind(actor, deviceId, JSON.stringify({ source: "control-center", deviceCode: deleted.display_code, previousReason: deleted.reason })),
      ]);
      return respond({ restoredDeviceId: deviceId, deletedDevices: await deletedDeviceRows() });
    }

    const current = await database.prepare(
      `SELECT device_id, display_code, learner_name, learner_family_name, learner_given_name,
              person_role, person_code, class_name, phone, registration_submitted_at,
              access_group, payment_status, payment_proof_key, status,
              access_expires_at, personal_edit_enabled, migrated_from_user_key
         FROM device_access WHERE device_id = ?`,
    ).bind(deviceId).first<{
      device_id: string;
      display_code: string;
      learner_name: string | null;
      learner_family_name: string | null;
      learner_given_name: string | null;
      person_role: "learner" | "teacher" | null;
      person_code: string | null;
      class_name: string | null;
      phone: string | null;
      registration_submitted_at: string | null;
      access_group: string;
      payment_status: string;
      payment_proof_key: string | null;
      status: "pending" | "approved" | "blocked";
      access_expires_at: string | null;
      personal_edit_enabled: number;
      migrated_from_user_key: string | null;
    }>();
    if (!current) return respond({ error: "Không tìm thấy thiết bị." }, 404);

    if (action === "delete-spam-device") {
      if (role !== "owner") {
        return respond({ error: "Chỉ Chủ hệ thống mới được xóa vĩnh viễn thiết bị rác." }, 403);
      }
      const confirmedCode = typeof payload.confirmDeviceCode === "string"
        ? payload.confirmDeviceCode.trim().toUpperCase()
        : "";
      if (confirmedCode !== current.display_code) {
        return respond({ error: `Hãy nhập chính xác mã ${current.display_code} để xác nhận xóa.` }, 409);
      }
      if (current.payment_status === "paid_verified") {
        return respond({ error: "Tài khoản đã xác minh thanh toán được bảo vệ. Hãy khóa thiết bị thay vì xóa." }, 409);
      }
      const certificate = await database.prepare(
        "SELECT id FROM course_certificates WHERE device_id = ? LIMIT 1",
      ).bind(deviceId).first<{ id: string }>();
      if (certificate) {
        return respond({ error: "Thiết bị đã được cấp chứng chỉ nên không thể xóa. Hãy khóa thiết bị để bảo toàn hồ sơ học tập." }, 409);
      }
      const allowedReasons = new Set(["spam", "duplicate", "test", "other"]);
      const requestedReason = typeof payload.deleteReason === "string" ? payload.deleteReason : "spam";
      const deleteReason = allowedReasons.has(requestedReason) ? requestedReason : "spam";
      const statements = [
        database.prepare(
          `INSERT INTO device_deletion_tombstones
            (device_id, display_code, reason, learner_name, deleted_by, deleted_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(device_id) DO UPDATE SET display_code = excluded.display_code,
             reason = excluded.reason, learner_name = excluded.learner_name,
             deleted_by = excluded.deleted_by, deleted_at = CURRENT_TIMESTAMP`,
        ).bind(deviceId, current.display_code, deleteReason, current.learner_name, actor),
        database.prepare("DELETE FROM device_challenges WHERE device_id = ?").bind(deviceId),
        database.prepare(
          "DELETE FROM ai_feedback WHERE device_id = ? OR interaction_id IN (SELECT id FROM ai_interactions WHERE subject_id = ?)",
        ).bind(deviceId, deviceId),
        database.prepare("DELETE FROM ai_quiz_sessions WHERE device_id = ?").bind(deviceId),
        database.prepare("DELETE FROM learner_self_assessments WHERE device_id = ?").bind(deviceId),
        database.prepare("DELETE FROM ai_device_controls WHERE device_id = ?").bind(deviceId),
        database.prepare("DELETE FROM ai_interactions WHERE subject_id = ?").bind(deviceId),
        database.prepare("DELETE FROM payment_reviews WHERE device_id = ?").bind(deviceId),
        database.prepare("DELETE FROM course_activity_events WHERE device_id = ?").bind(deviceId),
        database.prepare("DELETE FROM device_profiles WHERE device_id = ?").bind(deviceId),
      ];
      if (current.migrated_from_user_key) {
        statements.push(database.prepare("DELETE FROM course_profiles WHERE user_key = ?").bind(current.migrated_from_user_key));
      }
      statements.push(
        database.prepare("DELETE FROM device_access WHERE device_id = ?").bind(deviceId),
        database.prepare(
          "INSERT INTO course_audit_log (actor, action, target, detail_json) VALUES (?, 'learning_device_deleted', ?, ?)",
        ).bind(actor, deviceId, JSON.stringify({
          source: "control-center",
          deviceCode: current.display_code,
          learnerName: current.learner_name,
          previousStatus: current.status,
          reason: deleteReason,
        })),
      );
      await database.batch(statements);
      if (current.payment_proof_key) {
        const bucket = await paymentBucket();
        if (bucket) await bucket.delete(current.payment_proof_key).catch(() => undefined);
      }
      return respond({
        deletedDeviceId: deviceId,
        deletedDeviceCode: current.display_code,
        deletedDevices: await deletedDeviceRows(),
        devices: [],
      });
    }

    const registrationComplete = Boolean(current.learner_name?.trim() && current.person_role && current.person_code?.trim() && current.class_name?.trim() && current.phone?.trim() && current.registration_submitted_at);
    if (["grant-free", "require-payment", "verify-payment"].includes(action) && !registrationComplete) {
      return respond({ error: "Thiết bị chưa gửi đủ vai trò, mã định danh, họ tên, lớp và số điện thoại." }, 409);
    }

    let auditAction = action;
    if (action === "grant-free") {
      if (current.payment_status === "paid_verified") {
        return respond({ error: "Tài khoản đã xác minh thanh toán, không thể chuyển ngược sang miễn phí." }, 409);
      }
      const automation = await getAccessAutomationSettings();
      await database.prepare(
        `UPDATE device_access SET status = 'approved', access_group = 'free', payment_status = 'free_approved',
                approved_at = CURRENT_TIMESTAMP, blocked_at = NULL, payment_verified_at = NULL,
                payment_rejected_at = NULL, payment_review_note = NULL,
                access_expires_at = COALESCE(access_expires_at, ?), updated_at = CURRENT_TIMESTAMP
          WHERE device_id = ?`,
      ).bind(accessExpiryAfterDays(automation.defaultAccessDays), deviceId).run();
      auditAction = "learning_device_free_approved";
    } else if (action === "require-payment") {
      if (current.access_group !== "unassigned") {
        return respond({ error: "Thiết bị đã được phân nhóm; không thể tự đổi luồng thanh toán." }, 409);
      }
      await database.prepare(
        `UPDATE device_access SET status = 'pending', access_group = 'paid',
                payment_status = CASE WHEN payment_proof_key IS NULL THEN 'awaiting_payment' ELSE 'proof_submitted' END,
                approved_at = NULL, blocked_at = NULL, payment_verified_at = NULL,
                personal_edit_enabled = 0, auto_confirmed_at = NULL, access_expires_at = NULL,
                payment_rejected_at = NULL, payment_review_note = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE device_id = ?`,
      ).bind(deviceId).run();
      auditAction = "learning_device_payment_required";
    } else if (action === "verify-payment") {
      if (current.access_group !== "paid" || current.payment_status !== "proof_submitted" || !current.payment_proof_key) {
        return respond({ error: "Cần có ảnh chuyển khoản hợp lệ trước khi xác minh." }, 409);
      }
      await database.prepare(
        `UPDATE device_access SET status = 'approved', access_group = 'paid', payment_status = 'paid_verified',
                approved_at = CURRENT_TIMESTAMP, payment_verified_at = CURRENT_TIMESTAMP, blocked_at = NULL,
                payment_rejected_at = NULL, payment_review_note = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE device_id = ?`,
      ).bind(deviceId).run();
      await database.prepare(
        `UPDATE payment_reviews SET status = 'verified', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
                review_note = NULL
          WHERE id = (SELECT id FROM payment_reviews WHERE device_id = ? AND status = 'submitted'
                       AND proof_key = ? ORDER BY submitted_at DESC LIMIT 1)`,
      ).bind(actor, deviceId, current.payment_proof_key).run();
      auditAction = "learning_device_payment_verified";
    } else if (action === "reject-payment") {
      if (current.access_group !== "paid" || current.payment_status !== "proof_submitted" || !current.payment_proof_key) {
        return respond({ error: "Thiết bị chưa có ảnh chuyển khoản chờ xác minh." }, 409);
      }
      const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 500) : "";
      if (note.length < 5) return respond({ error: "Hãy ghi rõ lý do để người học biết cần sửa gì." }, 400);
      const previousProofKey = current.payment_proof_key;
      await database.batch([
        database.prepare(
          `UPDATE device_access SET status = 'pending', payment_status = 'awaiting_payment',
                  payment_proof_key = NULL, payment_proof_name = NULL,
                  payment_proof_content_type = NULL, payment_proof_size = NULL,
                  payment_submitted_at = NULL, payment_verified_at = NULL,
                  payment_rejected_at = CURRENT_TIMESTAMP, payment_review_note = ?,
                  updated_at = CURRENT_TIMESTAMP WHERE device_id = ?`,
        ).bind(note, deviceId),
        database.prepare(
          `UPDATE payment_reviews SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
                  review_note = ?
            WHERE id = (SELECT id FROM payment_reviews WHERE device_id = ? AND status = 'submitted'
                         AND proof_key = ? ORDER BY submitted_at DESC LIMIT 1)`,
        ).bind(actor, note, deviceId, previousProofKey),
      ]);
      const bucket = await paymentBucket();
      if (bucket) await bucket.delete(previousProofKey).catch(() => undefined);
      auditAction = "learning_device_payment_rejected";
    } else if (action === "toggle-personal-edit") {
      if (!registrationComplete) return respond({ error: "Thiết bị chưa nhập đủ thông tin người học." }, 409);
      const enabled = payload.enabled === true;
      if (enabled && current.person_role !== "teacher") {
        return respond({ error: "Quyền sửa nội dung chỉ cấp cho hồ sơ Giảng viên." }, 409);
      }
      const automation = await getAccessAutomationSettings();
      if (enabled) {
        const keepPaid = current.payment_status === "paid_verified";
        await database.prepare(
          `UPDATE device_access SET status = 'approved',
                  access_group = CASE WHEN ? THEN access_group ELSE 'free' END,
                  payment_status = CASE WHEN ? THEN payment_status ELSE 'free_approved' END,
                  personal_edit_enabled = 1, auto_confirmed_at = CURRENT_TIMESTAMP,
                  access_expires_at = ?, approved_at = CURRENT_TIMESTAMP, blocked_at = NULL,
                  updated_at = CURRENT_TIMESTAMP WHERE device_id = ?`,
        ).bind(keepPaid ? 1 : 0, keepPaid ? 1 : 0, accessExpiryAfterDays(automation.defaultAccessDays), deviceId).run();
        auditAction = "learning_device_personal_edit_enabled";
      } else {
        await database.prepare(
          "UPDATE device_access SET personal_edit_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?",
        ).bind(deviceId).run();
        auditAction = "learning_device_personal_edit_disabled";
      }
    } else if (action === "renew-access") {
      if (!registrationComplete) return respond({ error: "Thiết bị chưa nhập đủ thông tin người học." }, 409);
      if (current.status === "blocked") return respond({ error: "Hãy mở khóa thiết bị trước khi gia hạn." }, 409);
      const automation = await getAccessAutomationSettings();
      const keepPaid = current.payment_status === "paid_verified";
      await database.prepare(
        `UPDATE device_access SET status = 'approved',
                access_group = CASE WHEN ? THEN access_group ELSE 'free' END,
                payment_status = CASE WHEN ? THEN payment_status ELSE 'free_approved' END,
                access_expires_at = ?, approved_at = CURRENT_TIMESTAMP, blocked_at = NULL,
                updated_at = CURRENT_TIMESTAMP WHERE device_id = ?`,
      ).bind(keepPaid ? 1 : 0, keepPaid ? 1 : 0, accessExpiryAfterDays(automation.defaultAccessDays), deviceId).run();
      auditAction = "learning_device_access_renewed";
    } else if (action === "block") {
      await database.prepare(
        "UPDATE device_access SET status = 'blocked', blocked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?",
      ).bind(deviceId).run();
      auditAction = "learning_device_block";
    } else if (action === "unblock") {
      const canOpen = current.payment_status === "free_approved" || current.payment_status === "paid_verified";
      await database.prepare(
        `UPDATE device_access SET status = ?, blocked_at = NULL,
                approved_at = CASE WHEN ? = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
                updated_at = CURRENT_TIMESTAMP WHERE device_id = ?`,
      ).bind(canOpen ? "approved" : "pending", canOpen ? "approved" : "pending", deviceId).run();
      auditAction = "learning_device_unblocked";
    } else if (action === "profile") {
      const learnerFamilyName = normalizedNamePart(payload.learnerFamilyName, 60);
      const learnerGivenName = normalizedNamePart(payload.learnerGivenName, 60);
      const usesSplitName = payload.learnerFamilyName !== undefined || payload.learnerGivenName !== undefined;
      if (usesSplitName && (!learnerFamilyName || !learnerGivenName)) {
        return respond({ error: "Hãy nhập đầy đủ cả Họ và Tên bằng chữ cái." }, 400);
      }
      const legacyName = typeof payload.learnerName === "string" ? payload.learnerName.trim().replace(/\s+/g, " ").slice(0, 100) : "";
      const learnerName = usesSplitName ? `${learnerFamilyName} ${learnerGivenName}` : legacyName || current.learner_name || "";
      const storedFamilyName = usesSplitName ? learnerFamilyName : current.learner_family_name;
      const storedGivenName = usesSplitName ? learnerGivenName : current.learner_given_name;
      const label = typeof payload.label === "string" ? payload.label.trim().slice(0, 80) : "";
      const accessExpiresAt = normalizeAccessExpiry(payload.accessExpiresAt);
      await database.prepare(
        `UPDATE device_access SET learner_name = ?, learner_family_name = ?, learner_given_name = ?,
                label = ?, access_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?`,
      ).bind(learnerName || null, storedFamilyName || null, storedGivenName || null, label || null, accessExpiresAt, deviceId).run();
      auditAction = "learning_device_profile";
    } else if (action === "reset-progress") {
      await database.prepare(
        `UPDATE device_profiles SET completed_json = '[]', scores_json = '{}', attempts_json = '{}',
                total_active_seconds = 0, last_activity_at = NULL, last_lesson = NULL,
                last_part = NULL, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?`,
      ).bind(deviceId).run();
      auditAction = "learning_device_reset_progress";
      await database.prepare(
        `INSERT INTO course_activity_events (device_id, event_type, detail_json)
         VALUES (?, 'progress_reset', '{}')`,
      ).bind(deviceId).run();
    } else {
      return respond({ error: "Thao tác không hợp lệ." }, 400);
    }
    await database.prepare(
      "INSERT INTO course_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)",
    ).bind(actor, auditAction, deviceId, JSON.stringify({ source: "control-center" })).run();
    return respond({ devices: await rows([current.display_code], 30) });
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}
