import {
  publishedCourseDocument,
  type CourseDocument,
} from "../../course-content.server";
import { lessonVisualsFor, publicQuestionsFor } from "../../course-visuals.server";
import {
  LESSON_PARTS,
  courseProgressKey,
  firstMissingPrerequisite,
  normalizeCompletedProgress,
} from "../../course-logic";
import {
  DeviceAccessError,
  getCourseDatabase,
  verifyDeviceRequest,
} from "../../device-auth.server";
import type {
  LessonContentPayload,
  ServerCourseState,
  ServerQuestion,
} from "../../course-types";

export const dynamic = "force-dynamic";

type CourseRow = {
  device_id: string;
  completed_json: string;
  scores_json: string;
  attempts_json: string;
  total_active_seconds: number;
  last_activity_at: string | null;
  last_lesson: string | null;
  last_part: string | null;
};

type CourseProfile = {
  deviceId: string;
  completed: string[];
  scores: Record<string, number>;
  attempts: Record<string, number>;
  totalActiveSeconds: number;
  lastActivityAt: string | null;
  lastLesson: string | null;
  lastPart: string | null;
};

const lessonNumbers = ["01", "02", "03", "04", "05", "06", "07", "08"] as const;
type LessonNumber = (typeof lessonNumbers)[number];

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
  });
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeLesson(value: unknown): LessonNumber | null {
  return typeof value === "string" && lessonNumbers.includes(value as LessonNumber)
    ? (value as LessonNumber)
    : null;
}

async function contentFor(lessonNumber: LessonNumber, document: CourseDocument): Promise<LessonContentPayload> {
  const visuals = await lessonVisualsFor(lessonNumber);
  if (lessonNumber === "03") {
    return {
      kind: "movement",
      lessonNumber,
      phases: document.movement.phases,
      analysisPhases: document.movement.analysisPhases,
      mistakes: document.movement.mistakes,
      practice: document.movement.practice,
      sessionPlan: document.movement.sessionPlan,
      questions: publicQuestionsFor(document.movement.questions, lessonNumber, visuals),
      visuals,
    };
  }

  const detail = document.foundationDetails[lessonNumber as keyof typeof document.foundationDetails];
  return {
    kind: "foundation",
    lessonNumber,
    detail: {
      ...detail,
      questions: publicQuestionsFor(detail.questions, lessonNumber, visuals),
    },
    visuals,
  };
}

function serverQuestionsFor(lessonNumber: LessonNumber, document: CourseDocument): readonly ServerQuestion[] {
  return lessonNumber === "03"
    ? document.movement.questions
    : document.foundationDetails[lessonNumber as keyof typeof document.foundationDetails].questions;
}

function isLessonUnlocked(completed: readonly string[], lessonNumber: LessonNumber) {
  const index = lessonNumbers.indexOf(lessonNumber);
  return index === 0 || completed.includes(`bai-${lessonNumbers[index - 1]}`);
}

async function readProfile(deviceId: string): Promise<CourseProfile> {
  const database = await getCourseDatabase();
  const row = await database.prepare(
    `SELECT device_id, completed_json, scores_json, attempts_json, total_active_seconds,
            last_activity_at, last_lesson, last_part
       FROM device_profiles WHERE device_id = ?`,
  ).bind(deviceId).first<CourseRow>();
  if (!row) {
    // Quyền mở bài chỉ được hình thành qua các hành động đã xác thực phía máy chủ.
    // Không nhập trạng thái hoàn thành do trình duyệt tự khai khi cấp thiết bị mới.
    const completed: string[] = [];
    await database.prepare(
      "INSERT INTO device_profiles (device_id, completed_json, scores_json) VALUES (?, ?, '{}')",
    ).bind(deviceId, JSON.stringify(completed)).run();
    return {
      deviceId,
      completed,
      scores: {},
      attempts: {},
      totalActiveSeconds: 0,
      lastActivityAt: null,
      lastLesson: null,
      lastPart: null,
    };
  }
  return {
    deviceId: row.device_id,
    completed: normalizeCompletedProgress(parseJson<unknown>(row.completed_json, [])),
    scores: parseJson<Record<string, number>>(row.scores_json, {}),
    attempts: parseJson<Record<string, number>>(row.attempts_json, {}),
    totalActiveSeconds: Math.max(0, Number(row.total_active_seconds) || 0),
    lastActivityAt: row.last_activity_at,
    lastLesson: row.last_lesson,
    lastPart: row.last_part,
  };
}

async function saveProfile(profile: CourseProfile) {
  const database = await getCourseDatabase();
  await database.prepare(
    `UPDATE device_profiles
       SET completed_json = ?, scores_json = ?, attempts_json = ?,
           total_active_seconds = ?, last_activity_at = ?, last_lesson = ?, last_part = ?,
           updated_at = CURRENT_TIMESTAMP
     WHERE device_id = ?`,
  ).bind(
    JSON.stringify(profile.completed),
    JSON.stringify(profile.scores),
    JSON.stringify(profile.attempts),
    profile.totalActiveSeconds,
    profile.lastActivityAt,
    profile.lastLesson,
    profile.lastPart,
    profile.deviceId,
  ).run();
}

function stateFor(profile: CourseProfile): ServerCourseState {
  return {
    completed: profile.completed,
    scores: profile.scores,
    boundDevice: true,
  };
}

async function recordActivity(
  profile: CourseProfile,
  eventType: string,
  lessonNumber: LessonNumber | null,
  part: string | null,
  detail: Record<string, unknown> = {},
  clientEventId: string | null = null,
) {
  const database = await getCourseDatabase();
  profile.lastActivityAt = new Date().toISOString();
  profile.lastLesson = lessonNumber ?? profile.lastLesson;
  profile.lastPart = part ?? profile.lastPart;
  await database.prepare(
    `INSERT INTO course_activity_events
      (device_id, event_type, lesson_number, part, detail_json, client_event_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(profile.deviceId, eventType, lessonNumber, part, JSON.stringify(detail), clientEventId).run();
}

function normalizeClientEventId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9:_-]{8,100}$/.test(value) ? value : null;
}

async function clientEventAlreadyApplied(database: Awaited<ReturnType<typeof getCourseDatabase>>, deviceId: string, clientEventId: string | null) {
  if (!clientEventId) return false;
  const existing = await database.prepare(
    "SELECT id FROM course_activity_events WHERE device_id = ? AND client_event_id = ? LIMIT 1",
  ).bind(deviceId, clientEventId).first<{ id: number }>();
  return Boolean(existing);
}

function addCompleted(profile: CourseProfile, keys: string[]) {
  const completed = new Set(profile.completed);
  keys.forEach((key) => completed.add(key));
  profile.completed = [...completed];
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    const hostname = new URL(request.url).hostname;
    const previewRequest = hostname === "terminal.local" || hostname === "localhost";
    const device = await verifyDeviceRequest(payload, previewRequest);
    const profile = await readProfile(device.deviceId);
    const lessonNumber = normalizeLesson(payload.lessonNumber);
    const database = await getCourseDatabase();
    const document = await publishedCourseDocument(database);
    const clientEventId = normalizeClientEventId(payload.clientEventId);

    if (action === "bootstrap") {
      if (!lessonNumber) return json({ error: "Bài học không hợp lệ." }, 400);
      if (!isLessonUnlocked(profile.completed, lessonNumber)) {
        return json({ error: "Bài học này chưa được mở." }, 403);
      }
      await recordActivity(profile, "lesson_open", lessonNumber, "hoc-tap");
      await saveProfile(profile);
      return json({
        state: stateFor(profile),
        content: await contentFor(lessonNumber, document),
        outlines: lessonNumbers.map((number) => document.lessonOutlines[number]),
      });
    }

    if (action === "heartbeat") {
      if (await clientEventAlreadyApplied(database, profile.deviceId, clientEventId)) return json({ state: stateFor(profile), duplicate: true });
      const now = Date.now();
      const requestedSeconds = Math.max(0, Math.min(300, Number(payload.activeSeconds) || 0));
      const previousActivity = profile.lastActivityAt ? Date.parse(profile.lastActivityAt) : Number.NaN;
      const elapsedSeconds = Number.isFinite(previousActivity)
        ? Math.max(0, Math.min(300, Math.floor((now - previousActivity) / 1000)))
        : 0;
      const creditedSeconds = Math.min(requestedSeconds, elapsedSeconds);
      profile.totalActiveSeconds += creditedSeconds;
      const part = typeof payload.part === "string" ? payload.part.slice(0, 32) : profile.lastPart;
      await recordActivity(profile, "heartbeat", lessonNumber, part, { activeSeconds: creditedSeconds }, clientEventId);
      await saveProfile(profile);
      return json({ state: stateFor(profile) });
    }

    if (action === "offline-session") {
      if (await clientEventAlreadyApplied(database, profile.deviceId, clientEventId)) return json({ state: stateFor(profile), duplicate: true });
      if (!clientEventId) return json({ error: "Hoạt động offline thiếu mã chống trùng lặp." }, 400);
      const requestedSeconds = Math.max(0, Math.min(300, Math.floor(Number(payload.activeSeconds) || 0)));
      const occurredAt = typeof payload.occurredAt === "string" ? payload.occurredAt : "";
      const occurredTime = Date.parse(occurredAt);
      const oldestAccepted = Date.now() - 30 * 24 * 60 * 60 * 1000;
      if (requestedSeconds < 1 || !Number.isFinite(occurredTime) || occurredTime < oldestAccepted || occurredTime > Date.now() + 5 * 60 * 1000) {
        return json({ error: "Nhật ký học offline không hợp lệ hoặc đã quá cũ." }, 400);
      }
      const dayStart = new Date(occurredTime);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const daily = await database.prepare(
        `SELECT COALESCE(SUM(CAST(json_extract(detail_json, '$.activeSeconds') AS INTEGER)), 0) AS seconds
           FROM course_activity_events
          WHERE device_id = ? AND event_type = 'offline_session'
            AND json_extract(detail_json, '$.occurredAt') >= ?
            AND json_extract(detail_json, '$.occurredAt') < ?`,
      ).bind(profile.deviceId, dayStart.toISOString(), dayEnd.toISOString()).first<{ seconds: number }>();
      const creditedSeconds = Math.min(requestedSeconds, Math.max(0, 6 * 60 * 60 - (Number(daily?.seconds) || 0)));
      if (creditedSeconds < 1) return json({ state: stateFor(profile), dailyLimitReached: true });
      profile.totalActiveSeconds += creditedSeconds;
      const part = typeof payload.part === "string" ? payload.part.slice(0, 32) : profile.lastPart;
      await recordActivity(profile, "offline_session", lessonNumber, part, { activeSeconds: creditedSeconds, occurredAt }, clientEventId);
      await saveProfile(profile);
      return json({ state: stateFor(profile), syncedOfflineSeconds: creditedSeconds });
    }

    if (!lessonNumber) return json({ error: "Bài học không hợp lệ." }, 400);
    if (!isLessonUnlocked(profile.completed, lessonNumber)) {
      return json({ error: "Hãy hoàn thành bài trước để mở nội dung này." }, 403);
    }

    if (action === "complete") {
      if (await clientEventAlreadyApplied(database, profile.deviceId, clientEventId)) return json({ state: stateFor(profile), duplicate: true });
      const part = typeof payload.part === "string" ? payload.part : "";
      if (!LESSON_PARTS.slice(0, 4).includes(part as (typeof LESSON_PARTS)[number])) {
        return json({ error: "Phần học không hợp lệ." }, 400);
      }
      const missing = firstMissingPrerequisite(
        profile.completed,
        lessonNumber,
        part as (typeof LESSON_PARTS)[number],
      );
      if (missing) return json({ error: "Cần hoàn thành phần trước theo đúng thứ tự." }, 409);
      addCompleted(profile, [courseProgressKey(part as (typeof LESSON_PARTS)[number], lessonNumber)]);
      await recordActivity(profile, "part_complete", lessonNumber, part, {}, clientEventId);
      await saveProfile(profile);
      return json({ state: stateFor(profile) });
    }

    if (action === "submit") {
      const missing = firstMissingPrerequisite(profile.completed, lessonNumber, "kiem-tra");
      if (missing) return json({ error: "Cần hoàn thành bốn phần trước khi nộp bài." }, 409);
      const submittedAnswers = Array.isArray(payload.answers) ? payload.answers.map(Number) : [];
      const bank = serverQuestionsFor(lessonNumber, document);
      if (submittedAnswers.length !== bank.length || submittedAnswers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 3)) {
        return json({ error: "Hãy trả lời đủ mười câu trước khi nộp." }, 400);
      }
      const score = bank.reduce((total, item, index) => total + (submittedAnswers[index] === item.answer ? 1 : 0), 0);
      const passed = score >= Math.ceil(bank.length * 0.8);
      if (passed) profile.scores[lessonNumber] = Math.max(profile.scores[lessonNumber] ?? 0, score);
      profile.attempts[lessonNumber] = (profile.attempts[lessonNumber] ?? 0) + 1;
      if (passed) addCompleted(profile, [courseProgressKey("kiem-tra", lessonNumber), `bai-${lessonNumber}`]);
      await recordActivity(profile, "quiz_submit", lessonNumber, "kiem-tra", { score, passed });
      await saveProfile(profile);
      return json({ score, passed, resetRequired: !passed, state: stateFor(profile) });
    }

    return json({ error: "Thao tác không được hỗ trợ." }, 400);
  } catch (error) {
    if (error instanceof DeviceAccessError) {
      return json({ error: error.message, code: error.code, device: error.device }, error.status);
    }
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    const message = error instanceof Error ? error.message : "Không thể xử lý yêu cầu.";
    return json({ error: status === 500 ? "Dịch vụ học tập đang tạm gián đoạn." : message }, status);
  }
}
