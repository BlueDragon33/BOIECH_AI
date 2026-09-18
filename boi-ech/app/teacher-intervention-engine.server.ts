export type InterventionSuggestionMode = "feedback" | "assignment" | "review";
export type InterventionSuggestionPriority = "critical" | "high" | "normal";

export type InterventionSuggestion = {
  id: string;
  mode: InterventionSuggestionMode;
  priority: InterventionSuggestionPriority;
  lessonNumber: string;
  title: string;
  reason: string;
  noteTemplate: string;
  evidence: string[];
  requiresHumanReview: true;
};

type SuggestionLearner = {
  name: string;
  progress: number;
  inactiveDays: number | null;
  lastLesson: string | null;
  lastAnalysis: {
    confidence: number;
    captureQuality: "good" | "review";
    topErrors: string[];
  } | null;
  adaptive: {
    priorityLesson: string;
    priorityPart: string;
    averageMastery: number;
    alerts: { level: "info" | "warning" | "critical"; code: string; text: string }[];
  } | null;
  learningAnalytics: {
    latest: {
      actionLabel: string;
      lessonNumber: string | null;
      observedChange: "positive" | "stable" | "mixed" | "negative" | "new-evidence" | "activity-only" | "pending";
      evidenceNote: string;
    } | null;
  };
};

function cleanLesson(value: string | null | undefined, fallback = "01") {
  return typeof value === "string" && /^0[1-8]$/.test(value) ? value : fallback;
}

function makeId(mode: InterventionSuggestionMode, reason: string, lessonNumber: string) {
  return `${mode}:${lessonNumber}:${reason.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 36)}`;
}

function suggestion(
  mode: InterventionSuggestionMode,
  priority: InterventionSuggestionPriority,
  lessonNumber: string,
  title: string,
  reason: string,
  noteTemplate: string,
  evidence: string[],
): InterventionSuggestion {
  return {
    id: makeId(mode, reason, lessonNumber),
    mode,
    priority,
    lessonNumber,
    title,
    reason,
    noteTemplate,
    evidence: evidence.filter(Boolean).slice(0, 4),
    requiresHumanReview: true,
  };
}

function priorityRank(value: InterventionSuggestionPriority) {
  return value === "critical" ? 3 : value === "high" ? 2 : 1;
}

export function buildInterventionSuggestions(learner: SuggestionLearner): InterventionSuggestion[] {
  const adaptiveLesson = cleanLesson(learner.adaptive?.priorityLesson, cleanLesson(learner.lastLesson));
  const latestLoop = learner.learningAnalytics.latest;
  const output: InterventionSuggestion[] = [];

  if (latestLoop?.observedChange === "negative" || latestLoop?.observedChange === "mixed") {
    const lesson = cleanLesson(latestLoop.lessonNumber, adaptiveLesson);
    output.push(suggestion(
      "feedback",
      "critical",
      lesson,
      "Đối chiếu lại sau can thiệp",
      latestLoop.observedChange === "negative"
        ? "Tín hiệu sau can thiệp đang giảm."
        : "Các tín hiệu sau can thiệp chưa đồng nhất.",
      `Hãy cùng xem lại Bài ${lesson}. Giảng viên cần đối chiếu kỹ thuật và bối cảnh luyện tập trước khi điều chỉnh nhiệm vụ tiếp theo.`,
      [latestLoop.evidenceNote, `Can thiệp gần nhất: ${latestLoop.actionLabel}`],
    ));
  }

  if (learner.lastAnalysis && (learner.lastAnalysis.confidence < 70 || learner.lastAnalysis.captureQuality === "review")) {
    const lesson = cleanLesson(learner.lastLesson, adaptiveLesson);
    output.push(suggestion(
      "review",
      "high",
      lesson,
      "Review bằng chứng AI trước khi giao bài",
      learner.lastAnalysis.confidence < 70
        ? `Độ tin cậy AI hiện chỉ ${learner.lastAnalysis.confidence}%.`
        : "Chất lượng capture cần Giảng viên đối chiếu.",
      "Đối chiếu lại bản phân tích, góc quay và lỗi kỹ thuật trước khi dùng kết quả để hướng dẫn học viên.",
      [
        `Confidence: ${learner.lastAnalysis.confidence}%`,
        learner.lastAnalysis.topErrors[0] ? `Lỗi nổi bật: ${learner.lastAnalysis.topErrors[0]}` : "",
      ],
    ));
  }

  const criticalAlert = learner.adaptive?.alerts.find((item) => item.level === "critical");
  const warningAlert = learner.adaptive?.alerts.find((item) => item.level === "warning");
  const alert = criticalAlert ?? warningAlert;
  if (alert) {
    output.push(suggestion(
      "assignment",
      criticalAlert ? "critical" : "high",
      adaptiveLesson,
      `Củng cố Bài ${adaptiveLesson}`,
      alert.text,
      `Tập trung củng cố Bài ${adaptiveLesson}, ưu tiên phần ${learner.adaptive?.priorityPart || "đang yếu"}. Hoàn thành bài luyện rồi quay lại kiểm tra để đối chiếu tiến bộ.`,
      [
        `Learner Model: ${learner.adaptive?.averageMastery ?? 0}%`,
        alert.text,
      ],
    ));
  }

  if ((learner.inactiveDays ?? 0) >= 7) {
    output.push(suggestion(
      "feedback",
      "high",
      adaptiveLesson,
      "Khôi phục nhịp học",
      `Học viên chưa hoạt động ${learner.inactiveDays} ngày.`,
      `Hãy quay lại lộ trình từ Bài ${adaptiveLesson}. Bắt đầu bằng một phiên ngắn, hoàn thành đúng phần đang mở rồi phản hồi nếu gặp khó khăn.`,
      [`Không hoạt động: ${learner.inactiveDays} ngày`],
    ));
  }

  if (learner.progress < 50 && !output.some((item) => item.mode === "assignment")) {
    output.push(suggestion(
      "assignment",
      "normal",
      adaptiveLesson,
      `Tiếp tục lộ trình tại Bài ${adaptiveLesson}`,
      `Tiến độ hiện tại mới ${learner.progress}%.`,
      `Hoàn thành phần được mở của Bài ${adaptiveLesson} theo đúng thứ tự, sau đó làm kiểm tra để cập nhật năng lực.`,
      [`Tiến độ: ${learner.progress}%`],
    ));
  }

  if (latestLoop && (latestLoop.observedChange === "pending" || latestLoop.observedChange === "activity-only")) {
    const lesson = cleanLesson(latestLoop.lessonNumber, adaptiveLesson);
    output.push(suggestion(
      "feedback",
      "normal",
      lesson,
      "Nhắc tạo bằng chứng sau can thiệp",
      latestLoop.observedChange === "pending"
        ? "Chưa có hoạt động hoặc bằng chứng sau can thiệp."
        : "Đã có hoạt động nhưng chưa có kiểm tra/phân tích đủ điều kiện so sánh.",
      `Sau khi luyện Bài ${lesson}, hãy hoàn thành kiểm tra hoặc gửi phân tích phù hợp để Giảng viên có dữ liệu đối chiếu trước/sau.`,
      [latestLoop.evidenceNote],
    ));
  }

  const deduped = new Map<string, InterventionSuggestion>();
  for (const item of output) {
    const key = `${item.mode}:${item.lessonNumber}`;
    const current = deduped.get(key);
    if (!current || priorityRank(item.priority) > priorityRank(current.priority)) deduped.set(key, item);
  }

  return [...deduped.values()]
    .sort((left, right) => priorityRank(right.priority) - priorityRank(left.priority))
    .slice(0, 3);
}
