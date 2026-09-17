import {
  DeviceAccessError,
  getCourseDatabase,
  verifyDeviceRequest,
} from "../../../device-auth.server";

export const dynamic = "force-dynamic";

const LESSON_COUNT = 8;

type LearnerRow = {
  learner_name: string | null;
  person_code: string | null;
  class_name: string | null;
  last_seen_at: string | null;
  completed_json: string | null;
  scores_json: string | null;
  total_active_seconds: number | null;
  last_activity_at: string | null;
  last_lesson: string | null;
  last_part: string | null;
  analysis_count: number | null;
  last_analysis_json: string | null;
  last_analysis_at: string | null;
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
    const result = await database.prepare(
      `SELECT
          da.learner_name,
          da.person_code,
          da.class_name,
          da.last_seen_at,
          dp.completed_json,
          dp.scores_json,
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
            ORDER BY e.id DESC LIMIT 1) AS last_analysis_at
        FROM device_access da
        LEFT JOIN device_profiles dp ON dp.device_id = da.device_id
        WHERE da.person_role = 'learner'
          AND da.status = 'approved'
          AND lower(trim(da.class_name)) = lower(trim(?))
        ORDER BY COALESCE(dp.last_activity_at, da.last_seen_at) DESC, da.learner_name ASC
        LIMIT 200`,
    ).bind(teacher.className).all<LearnerRow>();

    const learners = (result.results ?? []).map((row) => {
      const completedLessons = completedLessonCount(row.completed_json);
      const progress = Math.round((completedLessons / LESSON_COUNT) * 100);
      const analysis = analysisSummary(row.last_analysis_json, row.last_analysis_at);
      const inactivityHours = hoursAgo(row.last_activity_at ?? row.last_seen_at);
      const needsSupport = inactivityHours > 7 * 24 || progress < 50 || Boolean(analysis && (analysis.confidence < 70 || analysis.captureQuality === "review"));
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
      },
      learners,
      privacy: {
        mediaStored: false,
        note: "Bảng giám sát chỉ dùng tiến độ và tóm tắt phân tích; video/ảnh gốc không được trả về Giảng viên.",
      },
    });
  } catch (error) {
    if (error instanceof DeviceAccessError) {
      return json({ error: error.message, code: error.code, device: error.device }, error.status);
    }
    return json({ error: "Không thể tải dữ liệu giám sát Giảng viên." }, 500);
  }
}
