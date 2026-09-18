type LearningEventRow = {
  device_id: string;
  event_type: string;
  lesson_number: string | null;
  part: string | null;
  detail_json: string;
  created_at: string;
};

export type InterventionEvidence = {
  kind: "quiz" | "video";
  lessonNumber: string | null;
  score: number;
  confidence: number | null;
  usable: boolean;
  at: string;
};

export type InterventionLearningAnalytics = {
  action: "feedback" | "assignment" | "review";
  actionLabel: string;
  teacherName: string;
  lessonNumber: string | null;
  interventionAt: string;
  note: string;
  beforeQuiz: InterventionEvidence | null;
  afterQuiz: InterventionEvidence | null;
  beforeVideo: InterventionEvidence | null;
  afterVideo: InterventionEvidence | null;
  quizDelta: number | null;
  videoDelta: number | null;
  activeMinutesAfter: number;
  learningEventsAfter: number;
  observedChange: "positive" | "stable" | "mixed" | "negative" | "new-evidence" | "activity-only" | "pending";
  evidenceNote: string;
};

export type LearnerLearningAnalytics = {
  interventions: InterventionLearningAnalytics[];
  latest: InterventionLearningAnalytics | null;
  summary: {
    interventionCount: number;
    withFollowUpEvidence: number;
    positiveObserved: number;
    pendingFollowUp: number;
  };
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; }
  catch { return fallback; }
}

function time(value: string | null | undefined) {
  if (!value) return Number.NaN;
  return Date.parse(value);
}

function boundedScore(value: unknown, maximum: number) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(maximum, score)) : null;
}

function actionType(eventType: string) {
  if (eventType === "teacher_feedback") return "feedback" as const;
  if (eventType === "teacher_assignment") return "assignment" as const;
  if (eventType === "teacher_analysis_review") return "review" as const;
  return null;
}

function actionLabel(action: "feedback" | "assignment" | "review") {
  return action === "assignment" ? "Giao bài luyện"
    : action === "review" ? "Review phân tích"
      : "Nhận xét chuyên môn";
}

function evidenceFor(event: LearningEventRow): InterventionEvidence | null {
  const detail = parseJson<Record<string, unknown>>(event.detail_json, {});
  if (event.event_type === "quiz_submit") {
    const score = boundedScore(detail.score, 10);
    if (score === null) return null;
    return {
      kind: "quiz",
      lessonNumber: event.lesson_number,
      score,
      confidence: null,
      usable: true,
      at: event.created_at,
    };
  }
  if (event.event_type === "video_ai_analysis") {
    const score = boundedScore(detail.score, 100);
    if (score === null) return null;
    const confidence = boundedScore(detail.confidence, 100) ?? 0;
    const quality = detail.captureQuality && typeof detail.captureQuality === "object"
      ? detail.captureQuality as Record<string, unknown>
      : {};
    return {
      kind: "video",
      lessonNumber: event.lesson_number,
      score,
      confidence,
      usable: confidence >= 70 && quality.level === "good",
      at: typeof detail.analyzedAt === "string" && detail.analyzedAt ? detail.analyzedAt : event.created_at,
    };
  }
  return null;
}

function sameLesson(event: LearningEventRow, lessonNumber: string | null) {
  return !lessonNumber || event.lesson_number === lessonNumber;
}

function nearestEvidence(
  events: LearningEventRow[],
  kind: "quiz" | "video",
  lessonNumber: string | null,
  interventionTime: number,
  direction: "before" | "after",
  followUpCutoff = Number.POSITIVE_INFINITY,
) {
  const type = kind === "quiz" ? "quiz_submit" : "video_ai_analysis";
  const evidenceWindow = 30 * 86_400_000;
  const matching = events.filter((event) => {
    if (event.event_type !== type || !sameLesson(event, lessonNumber)) return false;
    const eventTime = time(event.created_at);
    if (!Number.isFinite(eventTime)) return false;
    return direction === "before"
      ? eventTime <= interventionTime && eventTime >= interventionTime - evidenceWindow
      : eventTime > interventionTime && eventTime <= Math.min(interventionTime + evidenceWindow, followUpCutoff);
  });
  matching.sort((left, right) => direction === "before"
    ? time(right.created_at) - time(left.created_at)
    : time(left.created_at) - time(right.created_at));
  return matching.length ? evidenceFor(matching[0]) : null;
}

function roundedDelta(after: InterventionEvidence | null, before: InterventionEvidence | null) {
  if (!after || !before || !after.usable || !before.usable) return null;
  return Math.round((after.score - before.score) * 10) / 10;
}

function activityAfter(events: LearningEventRow[], interventionTime: number, followUpCutoff = Number.POSITIVE_INFINITY) {
  const windowEnd = Math.min(interventionTime + 14 * 86_400_000, followUpCutoff);
  let seconds = 0;
  let count = 0;
  for (const event of events) {
    const eventTime = time(event.created_at);
    if (!Number.isFinite(eventTime) || eventTime <= interventionTime || eventTime > windowEnd) continue;
    if (!["heartbeat", "offline_session", "part_complete", "quiz_submit", "video_ai_analysis"].includes(event.event_type)) continue;
    count += 1;
    if (event.event_type === "heartbeat" || event.event_type === "offline_session") {
      const detail = parseJson<Record<string, unknown>>(event.detail_json, {});
      const activeSeconds = Number(detail.activeSeconds);
      if (Number.isFinite(activeSeconds) && activeSeconds > 0) seconds += Math.min(300, activeSeconds);
    }
  }
  return { activeMinutes: Math.round(seconds / 60), count };
}

function observedChange(
  quizDelta: number | null,
  videoDelta: number | null,
  hasAfterEvidence: boolean,
  learningEventsAfter: number,
) {
  const signals = [
    quizDelta === null ? null : quizDelta >= 1 ? 1 : quizDelta <= -1 ? -1 : 0,
    videoDelta === null ? null : videoDelta >= 5 ? 1 : videoDelta <= -5 ? -1 : 0,
  ].filter((value): value is number => value !== null);
  if (signals.includes(1) && signals.includes(-1)) return "mixed" as const;
  if (signals.includes(1)) return "positive" as const;
  if (signals.includes(-1)) return "negative" as const;
  if (signals.length) return "stable" as const;
  if (hasAfterEvidence) return "new-evidence" as const;
  if (learningEventsAfter > 0) return "activity-only" as const;
  return "pending" as const;
}

function evidenceNote(value: InterventionLearningAnalytics["observedChange"]) {
  if (value === "positive") return "Có tín hiệu kết quả tăng trong cửa sổ theo dõi sau can thiệp; đây là thay đổi quan sát được, không khẳng định quan hệ nhân quả.";
  if (value === "negative") return "Có tín hiệu kết quả giảm sau can thiệp; cần Giảng viên xem lại bối cảnh trước khi kết luận.";
  if (value === "mixed") return "Các tín hiệu sau can thiệp chưa đồng nhất giữa kiểm tra và phân tích AI.";
  if (value === "stable") return "Đã có dữ liệu trước/sau nhưng thay đổi nhỏ trong ngưỡng theo dõi.";
  if (value === "new-evidence") return "Đã có bằng chứng sau can thiệp nhưng chưa có mốc trước tương đương để tính chênh lệch.";
  if (value === "activity-only") return "Học viên đã hoạt động sau can thiệp nhưng chưa có kiểm tra hoặc phân tích đủ điều kiện so sánh.";
  return "Chưa có hoạt động hoặc bằng chứng sau can thiệp để đối chiếu.";
}

export function buildLearningAnalytics(events: LearningEventRow[]): LearnerLearningAnalytics {
  const ordered = [...events].sort((left, right) => time(left.created_at) - time(right.created_at));
  const teacherEvents = ordered.filter((event) => Boolean(actionType(event.event_type)));
  const interventions = teacherEvents
    .map((event, actionIndex) => {
      const action = actionType(event.event_type)!;
      const detail = parseJson<Record<string, unknown>>(event.detail_json, {});
      const interventionTime = time(event.created_at);
      const nextInterventionTime = time(teacherEvents[actionIndex + 1]?.created_at);
      const followUpCutoff = Number.isFinite(nextInterventionTime) ? nextInterventionTime : Number.POSITIVE_INFINITY;
      const detailLesson = typeof detail.lessonNumber === "string" && /^0[1-8]$/.test(detail.lessonNumber) ? detail.lessonNumber : null;
      const reviewedAnalysisAt = action === "review" && typeof detail.analysisAt === "string" ? detail.analysisAt : "";
      const reviewedVideo = reviewedAnalysisAt
        ? ordered.find((candidate) => {
            if (candidate.event_type !== "video_ai_analysis") return false;
            const evidence = evidenceFor(candidate);
            return evidence?.at === reviewedAnalysisAt || candidate.created_at === reviewedAnalysisAt;
          })
        : null;
      const lessonNumber = event.lesson_number && /^0[1-8]$/.test(event.lesson_number)
        ? event.lesson_number
        : detailLesson ?? reviewedVideo?.lesson_number ?? null;
      const beforeQuiz = nearestEvidence(ordered, "quiz", lessonNumber, interventionTime, "before");
      const afterQuiz = nearestEvidence(ordered, "quiz", lessonNumber, interventionTime, "after", followUpCutoff);
      const beforeVideo = nearestEvidence(ordered, "video", lessonNumber, interventionTime, "before");
      const afterVideo = nearestEvidence(ordered, "video", lessonNumber, interventionTime, "after", followUpCutoff);
      const quizDelta = roundedDelta(afterQuiz, beforeQuiz);
      const videoDelta = roundedDelta(afterVideo, beforeVideo);
      const activity = activityAfter(ordered, interventionTime, followUpCutoff);
      const hasAfterEvidence = Boolean(afterQuiz || afterVideo);
      const change = observedChange(quizDelta, videoDelta, hasAfterEvidence, activity.count);
      return {
        action,
        actionLabel: actionLabel(action),
        teacherName: typeof detail.teacherName === "string" ? detail.teacherName.slice(0, 120) : "Giảng viên",
        lessonNumber,
        interventionAt: event.created_at,
        note: typeof detail.note === "string" ? detail.note.slice(0, 240) : "",
        beforeQuiz,
        afterQuiz,
        beforeVideo,
        afterVideo,
        quizDelta,
        videoDelta,
        activeMinutesAfter: activity.activeMinutes,
        learningEventsAfter: activity.count,
        observedChange: change,
        evidenceNote: evidenceNote(change),
      } satisfies InterventionLearningAnalytics;
    })
    .sort((left, right) => time(right.interventionAt) - time(left.interventionAt))
    .slice(0, 12);

  return {
    interventions,
    latest: interventions[0] ?? null,
    summary: {
      interventionCount: interventions.length,
      withFollowUpEvidence: interventions.filter((item) => item.afterQuiz || item.afterVideo).length,
      positiveObserved: interventions.filter((item) => item.observedChange === "positive").length,
      pendingFollowUp: interventions.filter((item) => ["pending", "activity-only", "negative", "mixed"].includes(item.observedChange)).length,
    },
  };
}

export type { LearningEventRow };
