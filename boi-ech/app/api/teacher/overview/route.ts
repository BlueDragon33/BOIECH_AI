import { learnerIntelligence, type AiLearnerProfile, type AiSelfAssessment } from "../../../ai-engine.server";
import { publishedCourseDocument } from "../../../course-content.server";
import { buildLearningAnalytics, type LearningEventRow } from "../../../teacher-learning-analytics.server";
import {
  DeviceAccessError,
  getCourseDatabase,
  verifyDeviceRequest,
} from "../../../device-auth.server";

export const dynamic = "force-dynamic";

const LESSON_COUNT = 8;

type LearnerRow = {
  device_id: string;
  learner_name: string | null;
  person_code: string | null;
  class_name: string | null;
  last_seen_at: string | null;
  completed_json: string | null;
  scores_json: string | null;
  attempts_json: string | null;
  total_active_seconds: number | null;
  last_activity_at: string | null;
  last_lesson: string | null;
  last_part: string | null;
  analysis_count: number | null;
  last_analysis_json: string | null;
  last_analysis_at: string | null;
  teacher_action_count: number | null;
  last_teacher_action_type: string | null;
  last_teacher_action_json: string | null;
  last_teacher_action_at: string | null;
};

type AssessmentRow = {
  device_id: string;
  lesson_number: string;
  section: string;
  rating: number;
  confidence: number;
  created_at: string;
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
  });
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; }
  catch { return fallback; }
}

function completedLessonCount(value: string | null) {
  const completed = parseJson<unknown>(value, []);
  if (!Array.isArray(completed)) return 0;
  const unique = new Set(
    completed.filter((item): item is string => typeof item === "string" && /^bai-0[1-8]$/.test(item)),
  );
  return Math.min(LESSON_COUNT, unique.size);
}

function averageScore(value: string | null) {
  const scores = parseJson<Record<string, unknown>>(value, {});
  const numeric = Object.values(scores)
    .map((score) => Number(score))
    .filter((score) => Number.isFinite(score) && score >= 0 && score <= 10);
  if (!numeric.length) return null;
  return Math.round((numeric.reduce((sum, score) => sum + score, 0) / numeric.length) * 10) / 10;
}

function analysisSummary(value: string | null, fallbackAt: string | null) {
  const source = parseJson<Record<string, unknown> | null>(value, null);
  if (!source) return null;
  const quality = source.captureQuality && typeof source.captureQuality === "object"
    ? source.captureQuality as Record<string, unknown>
    : {};
  const errors = Array.isArray(source.errors) ? source.errors : [];
  const topErrors = errors.slice(0, 3).map((item) => {
    if (!item || typeof item !== "object") return "";
    const title = (item as Record<string, unknown>).title;
    return typeof title === "string" ? title.slice(0, 120) : "";
  }).filter(Boolean);
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(source.score) || 0))),
    confidence: Math.max(0, Math.min(100, Math.round(Number(source.confidence) || 0))),
    captureQuality: quality.level === "good" ? "good" : "review",
    poseCoverage: Math.max(0, Math.min(100, Math.round(Number(quality.poseCoverage) || 0))),
    averageVisibility: Math.max(0, Math.min(100, Math.round(Number(quality.averageVisibility) || 0))),
    cameraView: source.cameraView === "side" ? "side" : "rear",
    errorCount: errors.length,
    topErrors,
    analyzedAt: typeof source.analyzedAt === "string" && source.analyzedAt ? source.analyzedAt : fallbackAt,
  };
}

function teacherActionSummary(type: string | null, value: string | null, createdAt: string | null) {
  const source = parseJson<Record<string, unknown> | null>(value, null);
  if (!source || !type) return null;
  const action = type === "teacher_assignment"
    ? "assignment"
    : type === "teacher_analysis_review"
      ? "review"
      : type === "teacher_feedback"
        ? "feedback"
        : null;
  if (!action) return null;
  return {
    action,
    teacherName: typeof source.teacherName === "string" ? source.teacherName.slice(0, 120) : "Giảng viên",
    title: typeof source.title === "string" ? source.title.slice(0, 160) : "",
    note: typeof source.note === "string" ? source.note.slice(0, 1200) : "",
    lessonNumber: typeof source.lessonNumber === "string" ? source.lessonNumber.slice(0, 2) : "",
    reviewStatus: source.reviewStatus === "follow-up" ? "follow-up" : source.reviewStatus === "reviewed" ? "reviewed" : "",
    analysisAt: typeof source.analysisAt === "string" ? source.analysisAt.slice(0, 80) : "",
    createdAt,
  };
}

function hoursAgo(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 3_600_000) : Number.POSITIVE_INFINITY;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const hostname = new URL(request.url).hostname;
    const previewRequest = hostname === "terminal.local" || hostname === "localhost";
    const teacher = await verifyDeviceRequest(payload, previewRequest);
    if (teacher.personRole !== "teacher") {
      throw new DeviceAccessError("Chỉ Giảng viên được xem bảng giám sát học viên.", 403, "TEACHER_ROLE_REQUIRED", teacher);
    }
    if (!teacher.className) {
      throw new DeviceAccessError("Hồ sơ Giảng viên chưa có lớp / đơn vị phụ trách.", 400, "TEACHER_CLASS_REQUIRED", teacher);
    }

    const database = await getCourseDatabase();
    const [document, result, assessmentsResult, learningEventsResult] = await Promise.all([
      publishedCourseDocument(database),
      database.prepare(
      `SELECT
          da.device_id,
          da.learner_name,
          da.person_code,
          da.class_name,
          da.last_seen_at,
          dp.completed_json,
          dp.scores_json,
          dp.attempts_json,
          dp.total_active_seconds,
          dp.last_activity_at,
          dp.last_lesson,
          dp.last_part,
          (SELECT COUNT(*) FROM course_activity_events e
            WHERE e.device_id = da.device_id AND e.event_type = 'video_ai_analysis') AS analysis_count,
          (SELECT e.detail_json FROM course_activity_events e
            WHERE e.device_id = da.device_id AND e.event_type = 'video_ai_analysis'
            ORDER BY e.id DESC LIMIT 1) AS last_analysis_json,
          (SELECT e.created_at FROM course_activity_events e
            WHERE e.device_id = da.device_id AND e.event_type = 'video_ai_analysis'
            ORDER BY e.id DESC LIMIT 1) AS last_analysis_at,
          (SELECT COUNT(*) FROM course_activity_events e
            WHERE e.device_id = da.device_id
              AND e.event_type IN ('teacher_feedback', 'teacher_assignment', 'teacher_analysis_review')) AS teacher_action_count,
          (SELECT e.event_type FROM course_activity_events e
            WHERE e.device_id = da.device_id
              AND e.event_type IN ('teacher_feedback', 'teacher_assignment', 'teacher_analysis_review')
            ORDER BY e.id DESC LIMIT 1) AS last_teacher_action_type,
          (SELECT e.detail_json FROM course_activity_events e
            WHERE e.device_id = da.device_id
              AND e.event_type IN ('teacher_feedback', 'teacher_assignment', 'teacher_analysis_review')
            ORDER BY e.id DESC LIMIT 1) AS last_teacher_action_json,
          (SELECT e.created_at FROM course_activity_events e
            WHERE e.device_id = da.device_id
              AND e.event_type IN ('teacher_feedback', 'teacher_assignment', 'teacher_analysis_review')
            ORDER BY e.id DESC LIMIT 1) AS last_teacher_action_at
        FROM device_access da
        LEFT JOIN device_profiles dp ON dp.device_id = da.device_id
        WHERE da.person_role = 'learner'
          AND da.status = 'approved'
          AND lower(trim(da.class_name)) = lower(trim(?))
        ORDER BY COALESCE(dp.last_activity_at, da.last_seen_at) DESC, da.learner_name ASC
        LIMIT 200`,
      ).bind(teacher.className).all<LearnerRow>(),
      database.prepare(
        `SELECT a.device_id, a.lesson_number, a.section, a.rating, a.confidence, a.created_at
           FROM learner_self_assessments a
           JOIN device_access da ON da.device_id = a.device_id
          WHERE da.person_role = 'learner'
            AND da.status = 'approved'
            AND lower(trim(da.class_name)) = lower(trim(?))
          ORDER BY a.created_at DESC
          LIMIT 3000`,
      ).bind(teacher.className).all<AssessmentRow>(),
      database.prepare(
        `SELECT e.device_id, e.event_type, e.lesson_number, e.part, e.detail_json, e.created_at
           FROM course_activity_events e
           JOIN device_access da ON da.device_id = e.device_id
          WHERE da.person_role = 'learner'
            AND da.status = 'approved'
            AND lower(trim(da.class_name)) = lower(trim(?))
            AND e.event_type IN (
              'teacher_feedback',
              'teacher_assignment',
              'teacher_analysis_review',
              'quiz_submit',
              'video_ai_analysis',
              'heartbeat',
              'offline_session',
              'part_complete'
            )
          ORDER BY e.device_id ASC, e.created_at ASC, e.id ASC
          LIMIT 12000`,
      ).bind(teacher.className).all<LearningEventRow>(),
    ]);

    const assessmentsByDevice = new Map<string, AiSelfAssessment[]>();
    for (const row of assessmentsResult.results ?? []) {
      const current = assessmentsByDevice.get(row.device_id) ?? [];
      if (!current.some((item) => item.lessonNumber === row.lesson_number && item.section === row.section)) {
        current.push({
          lessonNumber: row.lesson_number,
          section: row.section,
          rating: row.rating,
          confidence: row.confidence,
          createdAt: row.created_at,
        });
        assessmentsByDevice.set(row.device_id, current);
      }
    }

    const learningEventsByDevice = new Map<string, LearningEventRow[]>();
    for (const row of learningEventsResult.results ?? []) {
      const current = learningEventsByDevice.get(row.device_id) ?? [];
      current.push(row);
      learningEventsByDevice.set(row.device_id, current);
    }

    const learners = (result.results ?? []).map((row) => {
      const completedLessons = completedLessonCount(row.completed_json);
      const progress = Math.round((completedLessons / LESSON_COUNT) * 100);
      const analysis = analysisSummary(row.last_analysis_json, row.last_analysis_at);
      const latestTeacherAction = teacherActionSummary(row.last_teacher_action_type, row.last_teacher_action_json, row.last_teacher_action_at);
      const learnerProfile: AiLearnerProfile = {
        completed: parseJson<string[]>(row.completed_json, []),
        scores: parseJson<Record<string, number>>(row.scores_json, {}),
        attempts: parseJson<Record<string, number>>(row.attempts_json, {}),
        totalActiveSeconds: Math.max(0, Number(row.total_active_seconds) || 0),
        lastActivityAt: row.last_activity_at,
      };
      const intelligence = learnerIntelligence(document, learnerProfile, assessmentsByDevice.get(row.device_id) ?? []);
      const unlockedCompetencies = intelligence.competencies.filter((item) => item.unlocked);
      const averageMastery = unlockedCompetencies.length
        ? Math.round(unlockedCompetencies.reduce((sum, item) => sum + item.mastery, 0) / unlockedCompetencies.length)
        : 0;
      const adaptiveAlerts = intelligence.alerts.filter((item) => item.level !== "info");
      const learningAnalytics = buildLearningAnalytics(learningEventsByDevice.get(row.device_id) ?? []);
      const inactivityHours = hoursAgo(row.last_activity_at ?? row.last_seen_at);
      const needsSupport = inactivityHours > 7 * 24
        || progress < 50
        || adaptiveAlerts.length > 0
        || Boolean(analysis && (analysis.confidence < 70 || analysis.captureQuality === "review"));
      return {
        name: row.learner_name?.trim() || "Học viên",
        personCode: row.person_code?.trim() || "",
        className: row.class_name?.trim() || teacher.className,
        completedLessons,
        totalLessons: LESSON_COUNT,
        progress,
        averageScore: averageScore(row.scores_json),
        totalActiveMinutes: Math.round(Math.max(0, Number(row.total_active_seconds) || 0) / 60),
        lastActivityAt: row.last_activity_at ?? row.last_seen_at,
        lastLesson: row.last_lesson,
        lastPart: row.last_part,
        analysisCount: Math.max(0, Number(row.analysis_count) || 0),
        lastAnalysis: analysis,
        teacherActionCount: Math.max(0, Number(row.teacher_action_count) || 0),
        latestTeacherAction,
        adaptive: {
          priorityLesson: intelligence.priorityLesson,
          priorityPart: intelligence.priorityPart,
          averageMastery,
          alerts: intelligence.alerts,
        },
        learningAnalytics,
        needsSupport,
        inactiveDays: Number.isFinite(inactivityHours) ? Math.floor(inactivityHours / 24) : null,
      };
    });

    const active7d = learners.filter((item) => item.inactiveDays !== null && item.inactiveDays < 7).length;
    const needingSupport = learners.filter((item) => item.needsSupport).length;
    const analysisCount = learners.reduce((sum, item) => sum + item.analysisCount, 0);
    const averageProgress = learners.length
      ? Math.round(learners.reduce((sum, item) => sum + item.progress, 0) / learners.length)
      : 0;
    const interventionCount = learners.reduce((sum, item) => sum + item.learningAnalytics.summary.interventionCount, 0);
    const withFollowUpEvidence = learners.reduce((sum, item) => sum + item.learningAnalytics.summary.withFollowUpEvidence, 0);
    const positiveObserved = learners.reduce((sum, item) => sum + item.learningAnalytics.summary.positiveObserved, 0);
    const pendingFollowUp = learners.reduce((sum, item) => sum + item.learningAnalytics.summary.pendingFollowUp, 0);

    return json({
      teacher: {
        name: teacher.learnerName,
        personCode: teacher.personCode,
        className: teacher.className,
      },
      summary: {
        learnerCount: learners.length,
        active7d,
        needingSupport,
        analysisCount,
        averageProgress,
        interventionCount,
        withFollowUpEvidence,
        positiveObserved,
        pendingFollowUp,
      },
      learners,
      privacy: {
        mediaStored: false,
        note: "Bảng giám sát và Learning Analytics chỉ dùng sự kiện tiến độ, điểm, tóm tắt AI và can thiệp chuyên môn; video/ảnh gốc không được trả về Giảng viên.",
      },
    });
  } catch (error) {
    if (error instanceof DeviceAccessError) {
      return json({ error: error.message, code: error.code, device: error.device }, error.status);
    }
    return json({ error: "Không thể tải dữ liệu giám sát Giảng viên." }, 500);
  }
}
