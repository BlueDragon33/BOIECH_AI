"use client";

export type InterventionEvidenceClient = {
  kind: "quiz" | "video";
  lessonNumber: string | null;
  score: number;
  confidence: number | null;
  usable: boolean;
  at: string;
};

export type InterventionLearningAnalyticsClient = {
  action: "feedback" | "assignment" | "review";
  actionLabel: string;
  teacherName: string;
  lessonNumber: string | null;
  interventionAt: string;
  note: string;
  beforeQuiz: InterventionEvidenceClient | null;
  afterQuiz: InterventionEvidenceClient | null;
  beforeVideo: InterventionEvidenceClient | null;
  afterVideo: InterventionEvidenceClient | null;
  quizDelta: number | null;
  videoDelta: number | null;
  activeMinutesAfter: number;
  learningEventsAfter: number;
  observedChange: "positive" | "stable" | "mixed" | "negative" | "new-evidence" | "activity-only" | "pending";
  evidenceNote: string;
};

export type LearnerLearningAnalyticsClient = {
  interventions: InterventionLearningAnalyticsClient[];
  latest: InterventionLearningAnalyticsClient | null;
  summary: {
    interventionCount: number;
    withFollowUpEvidence: number;
    positiveObserved: number;
    pendingFollowUp: number;
  };
};

type AnalyticsLearner = {
  name: string;
  personCode: string;
  className: string;
  learningAnalytics: LearnerLearningAnalyticsClient;
};

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

function delta(value: number | null, suffix = "") {
  if (value === null) return "Chưa so sánh";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value}${suffix}`;
}

function changeLabel(value: InterventionLearningAnalyticsClient["observedChange"]) {
  if (value === "positive") return "Tín hiệu tăng";
  if (value === "negative") return "Tín hiệu giảm";
  if (value === "mixed") return "Tín hiệu chưa đồng nhất";
  if (value === "stable") return "Ít thay đổi";
  if (value === "new-evidence") return "Có bằng chứng mới";
  if (value === "activity-only") return "Đã hoạt động lại";
  return "Chờ theo dõi";
}

function Evidence({
  label,
  before,
  after,
  change,
  suffix,
}: {
  label: string;
  before: InterventionEvidenceClient | null;
  after: InterventionEvidenceClient | null;
  change: number | null;
  suffix?: string;
}) {
  const lowTrust = [before, after].some((item) => item?.kind === "video" && !item.usable);
  return (
    <div className="teacher-loop-evidence">
      <span>{label}</span>
      <div>
        <strong>{before ? `${before.score}${suffix ?? ""}` : "—"}</strong>
        <i>→</i>
        <strong>{after ? `${after.score}${suffix ?? ""}` : "—"}</strong>
      </div>
      <small>{delta(change, suffix)}{lowTrust ? " · có mốc AI chưa đủ tin cậy" : ""}</small>
    </div>
  );
}

export default function TeacherLearningAnalyticsPanel({
  learners,
  onSelect,
}: {
  learners: AnalyticsLearner[];
  onSelect: (personCode: string) => void;
}) {
  const interventions = learners
    .flatMap((learner) => learner.learningAnalytics.interventions.map((item) => ({
      learner,
      item,
    })))
    .sort((left, right) => Date.parse(right.item.interventionAt) - Date.parse(left.item.interventionAt));

  const totals = learners.reduce((sum, learner) => ({
    interventionCount: sum.interventionCount + learner.learningAnalytics.summary.interventionCount,
    withFollowUpEvidence: sum.withFollowUpEvidence + learner.learningAnalytics.summary.withFollowUpEvidence,
    positiveObserved: sum.positiveObserved + learner.learningAnalytics.summary.positiveObserved,
    pendingFollowUp: sum.pendingFollowUp + learner.learningAnalytics.summary.pendingFollowUp,
  }), { interventionCount: 0, withFollowUpEvidence: 0, positiveObserved: 0, pendingFollowUp: 0 });

  return (
    <section className="teacher-learning-analytics" aria-label="Learning Analytics sau can thiệp của Giảng viên">
      <header>
        <div>
          <span>TEACHER-IN-THE-LOOP · LEARNING ANALYTICS</span>
          <h2>Trước → can thiệp → sau</h2>
          <p>Ghép sự kiện học theo thời gian để hỗ trợ Giảng viên theo dõi. Các thay đổi dưới đây không tự chứng minh can thiệp là nguyên nhân.</p>
        </div>
        <div className="teacher-loop-summary">
          <article><strong>{totals.interventionCount}</strong><span>Can thiệp đã ghi</span></article>
          <article><strong>{totals.withFollowUpEvidence}</strong><span>Có bằng chứng sau</span></article>
          <article><strong>{totals.positiveObserved}</strong><span>Tín hiệu tăng</span></article>
          <article><strong>{totals.pendingFollowUp}</strong><span>Cần theo dõi tiếp</span></article>
        </div>
      </header>

      <div className="teacher-loop-list">
        {interventions.slice(0, 12).map(({ learner, item }, index) => (
          <article key={`${learner.personCode}-${item.interventionAt}-${index}`} className="teacher-loop-card">
            <header>
              <div>
                <span>{item.actionLabel}{item.lessonNumber ? ` · Bài ${item.lessonNumber}` : ""}</span>
                <strong>{learner.name}</strong>
                <small>{learner.className} · {shortDate(item.interventionAt)} · {item.teacherName}</small>
              </div>
              <b className={`teacher-loop-status ${item.observedChange}`}>{changeLabel(item.observedChange)}</b>
            </header>

            <div className="teacher-loop-evidence-grid">
              <Evidence label="Kiểm tra" before={item.beforeQuiz} after={item.afterQuiz} change={item.quizDelta} suffix="/10" />
              <Evidence label="Video AI" before={item.beforeVideo} after={item.afterVideo} change={item.videoDelta} suffix="/100" />
              <div className="teacher-loop-evidence activity">
                <span>Hoạt động sau can thiệp</span>
                <div><strong>{item.activeMinutesAfter} phút</strong></div>
                <small>{item.learningEventsAfter} sự kiện học trong cửa sổ 14 ngày</small>
              </div>
            </div>

            <p className="teacher-loop-note">{item.evidenceNote}</p>
            {item.note ? <blockquote>{item.note}</blockquote> : null}
            <footer>
              <span>Bằng chứng được lấy từ tiến độ, kiểm tra và tóm tắt AI media-free.</span>
              <button type="button" onClick={() => onSelect(learner.personCode)}>Mở hồ sơ →</button>
            </footer>
          </article>
        ))}

        {interventions.length === 0 ? (
          <div className="teacher-loop-empty">
            <strong>Chưa có vòng lặp can thiệp để đối chiếu</strong>
            <p>Sau khi Giảng viên gửi nhận xét, giao bài luyện hoặc review AI, hệ thống sẽ ghép các sự kiện học tiếp theo vào mốc đó.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
