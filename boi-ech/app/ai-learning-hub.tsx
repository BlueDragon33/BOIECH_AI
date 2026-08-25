"use client";

import { useEffect, useMemo, useState } from "react";

type AiSettings = {
  enabled: boolean;
  tutorEnabled: boolean;
  adaptiveEnabled: boolean;
  contentAssistantEnabled: boolean;
  deviceReason: string | null;
  engineVersion: string;
  dataPolicy: string;
};

type Competency = {
  lessonNumber: string;
  label: string;
  mastery: number;
  attempts: number;
  score: number | null;
  unlocked: boolean;
};

type LearningPlanItem = {
  id: string;
  minutes: number;
  lessonNumber: string;
  section: string;
  title: string;
  reason: string;
};

type Intelligence = {
  generatedAt: string;
  engineVersion: string;
  profileVersion: string;
  priorityLesson: string;
  priorityPart: string;
  competencies: Competency[];
  alerts: { level: "info" | "warning" | "critical"; code: string; text: string }[];
  beforeAfter: { lessonNumber: string; first: number; latest: number; best: number; attempts: number }[];
  todayPlan: LearningPlanItem[];
};

type Assessment = { lessonNumber: string; section: string; rating: number; confidence: number; createdAt: string };
type Citation = { lessonNumber: string; section: string; label: string };
type MentorResponse = {
  answer: string;
  steps: string[];
  citations: Citation[];
  safety: string;
  engineVersion: string;
  promptVersion: string;
};
type MentorInteraction = { id: string; query: string | null; response: MentorResponse; createdAt: string };
type AdaptiveQuestion = { q: string; options: string[]; lessonNumber: string };
type AdaptiveQuiz = { sessionId: string; questions: AdaptiveQuestion[]; passScore: number; questionCount: number; focusLessons: string[] };

export type AiApiResponse = {
  settings?: AiSettings;
  intelligence?: Intelligence;
  assessments?: Assessment[];
  interactions?: {
    id: string;
    query: string | null;
    response: Partial<MentorResponse>;
    createdAt: string;
  }[];
  interaction?: MentorInteraction;
  quiz?: AdaptiveQuiz;
  score?: number;
  passed?: boolean;
  resetRequired?: boolean;
  saved?: boolean;
  error?: string;
  code?: string;
};

const sectionLabels: Record<string, string> = {
  "hoc-tap": "Nội dung",
  "thuc-hanh": "Thực hành",
  "phan-tich": "Phân tích",
  "on-tap": "Ôn tập",
  "kiem-tra": "Kiểm tra",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date) : "—";
}

export default function AiLearningHub({
  learnerName,
  currentLesson,
  online,
  request,
  onNavigate,
  onNotice,
}: {
  learnerName: string;
  currentLesson: string;
  online: boolean;
  request: (payload: Record<string, unknown>) => Promise<AiApiResponse>;
  onNavigate: (lessonNumber: string, section: string) => void;
  onNotice: (message: string) => void;
}) {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [intelligence, setIntelligence] = useState<Intelligence | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [interactions, setInteractions] = useState<MentorInteraction[]>([]);
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState(3);
  const [confidence, setConfidence] = useState(3);
  const [assessmentNote, setAssessmentNote] = useState("");
  const [assessmentSection, setAssessmentSection] = useState("hoc-tap");
  const [quiz, setQuiz] = useState<AdaptiveQuiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [busy, setBusy] = useState(true);
  const [localNotice, setLocalNotice] = useState("");

  function accept(data: AiApiResponse) {
    if (data.settings) setSettings(data.settings);
    if (data.intelligence) setIntelligence(data.intelligence);
    if (data.assessments) setAssessments(data.assessments);
    if (data.interactions) {
      setInteractions(data.interactions.flatMap((item) => typeof item.response.answer === "string" ? [{ ...item, response: item.response as MentorResponse }] : []));
    }
  }

  async function load() {
    if (!online) { setBusy(false); return; }
    setBusy(true);
    try { accept(await request({ action: "bootstrap" })); }
    catch (error) { setLocalNotice(error instanceof Error ? error.message : "Chưa thể tải hồ sơ AI."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  // Hồ sơ AI chỉ cần nạp khi trang trợ giảng được mở; hành động sau đó tự cập nhật dữ liệu.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ask() {
    if (!query.trim() || busy || !online) return;
    setBusy(true);
    setLocalNotice("");
    try {
      const data = await request({ action: "ask", query, lessonNumber: currentLesson, section: intelligence?.priorityPart ?? "hoc-tap" });
      if (data.interaction) setInteractions((current) => [data.interaction!, ...current].slice(0, 8));
      setQuery("");
    } catch (error) { setLocalNotice(error instanceof Error ? error.message : "Trợ giảng chưa thể trả lời."); }
    finally { setBusy(false); }
  }

  async function saveAssessment() {
    if (busy || !online) return;
    setBusy(true);
    setLocalNotice("");
    try {
      const data = await request({ action: "self-assess", lessonNumber: currentLesson, section: assessmentSection, rating, confidence, note: assessmentNote });
      accept(data);
      setAssessmentNote("");
      setLocalNotice("Đã lưu tự đánh giá và cập nhật lại lộ trình cá nhân.");
    } catch (error) { setLocalNotice(error instanceof Error ? error.message : "Chưa thể lưu tự đánh giá."); }
    finally { setBusy(false); }
  }

  async function sendFeedback(interactionId: string, feedback: "helpful" | "not_helpful" | "inappropriate") {
    try {
      await request({ action: "feedback", interactionId, rating: feedback });
      setLocalNotice(feedback === "helpful" ? "Cảm ơn phản hồi của bạn." : "Đã gửi phản hồi tới giáo viên để kiểm tra.");
    } catch (error) { setLocalNotice(error instanceof Error ? error.message : "Chưa thể gửi phản hồi."); }
  }

  async function createQuiz() {
    if (busy || !online) return;
    setBusy(true);
    setQuizResult(null);
    setQuizAnswers({});
    setLocalNotice("");
    try {
      const data = await request({ action: "create-quiz", lessonNumber: currentLesson });
      if (data.quiz) setQuiz(data.quiz);
    } catch (error) { setLocalNotice(error instanceof Error ? error.message : "Chưa thể tạo bài luyện."); }
    finally { setBusy(false); }
  }

  async function submitQuiz() {
    if (!quiz || Object.keys(quizAnswers).length !== quiz.questionCount || busy || !online) return;
    setBusy(true);
    try {
      const data = await request({ action: "submit-quiz", sessionId: quiz.sessionId, answers: quiz.questions.map((_, index) => quizAnswers[index]) });
      if (typeof data.score === "number") {
        setQuizResult({ score: data.score, passed: Boolean(data.passed) });
        if (!data.passed) {
          setQuiz(null);
          setQuizAnswers({});
          setLocalNotice(`${learnerName} đạt ${data.score}/10, chưa đủ 8/10. Lượt này đã đóng; hãy tạo bài mới và làm lại từ đầu.`);
        } else setLocalNotice(`${learnerName} đạt ${data.score}/10 trong bài luyện thích ứng.`);
        void load();
      }
    } catch (error) { setLocalNotice(error instanceof Error ? error.message : "Chưa thể chấm bài luyện."); }
    finally { setBusy(false); }
  }

  function exportAiReport() {
    const report = { exportedAt: new Date().toISOString(), learner: learnerName, settings, intelligence, assessments, interactions: interactions.map((item) => ({ ...item, query: item.query ? "Đã ẩn khỏi bản xuất cá nhân" : null })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-ai-boi-ech-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const averageMastery = useMemo(() => {
    const unlocked = intelligence?.competencies.filter((item) => item.unlocked) ?? [];
    return unlocked.length ? Math.round(unlocked.reduce((sum, item) => sum + item.mastery, 0) / unlocked.length) : 0;
  }, [intelligence]);

  if (!online) return <div className="page ai-page"><section className="ai-offline"><span>Trợ giảng AI cần mạng</span><h1>Nội dung bài học vẫn dùng được khi offline</h1><p>AI không chạy ngầm và không gửi hàng đợi để tránh câu trả lời lỗi thời. Kết nối lại rồi mở mục này để lấy lộ trình mới.</p></section></div>;
  if (busy && !settings) return <div className="page secure-loading" role="status"><span>Đang phân tích dữ liệu học</span><h2>Tạo lộ trình riêng cho {learnerName}</h2><p>Chỉ dùng tiến độ, điểm, lượt làm và tự đánh giá đã lưu.</p></div>;
  if (settings && !settings.enabled) return <div className="page ai-page"><section className="ai-offline"><span>AI đang tạm tắt</span><h1>Quản trị viên đã dừng AI cho thiết bị này</h1><p>{settings.deviceReason || "Các bài học, kiểm tra chính thức và dữ liệu tiến độ vẫn hoạt động bình thường."}</p></section></div>;

  return (
    <div className="page ai-page">
      <section className="ai-hero">
        <div><span>Frog AI · Không dùng AI thị giác</span><h1>Trợ giảng cá nhân của {learnerName}</h1><p>Giải thích từ đúng bài giảng đã xuất bản, xác định phần còn yếu và đề xuất một kế hoạch ngắn có thể kiểm tra.</p><div className="ai-hero-actions"><button onClick={() => document.getElementById("ai-chat")?.scrollIntoView({ behavior: "smooth" })}>Hỏi trợ giảng</button><button onClick={exportAiReport}>Xuất báo cáo AI</button></div></div>
        <aside><span>Năng lực đang mở</span><strong>{averageMastery}%</strong><small>Ưu tiên Bài {intelligence?.priorityLesson ?? currentLesson} · {sectionLabels[intelligence?.priorityPart ?? "hoc-tap"]}</small><div><i style={{ width: `${averageMastery}%` }} /></div></aside>
      </section>

      <section className="ai-privacy"><i>✓</i><div><strong>Dữ liệu tối thiểu, có thể kiểm soát</strong><p>{settings?.dataPolicy || "Không dùng camera, ảnh hoặc video; không gửi dữ liệu cá nhân ra ngoài."} Không nhập số điện thoại hoặc thông tin sức khỏe riêng tư vào ô hỏi.</p></div><span>{settings?.engineVersion}</span></section>

      {localNotice ? <div className="ai-notice" role="status">{localNotice}<button onClick={() => setLocalNotice("")}>×</button></div> : null}
      {intelligence?.alerts.length ? <section className="ai-alerts"><header><span>Cần chú ý</span><strong>AI phát hiện tín hiệu cần hỗ trợ</strong></header>{intelligence.alerts.map((alert) => <article key={alert.code} className={alert.level}><i>!</i><p>{alert.text}</p></article>)}</section> : null}

      <section className="ai-section">
        <header><div><span>Kế hoạch hôm nay</span><h2>Ba việc vừa sức, có lý do rõ ràng</h2></div><small>Cập nhật từ tiến độ mới nhất</small></header>
        <div className="ai-plan-grid">{intelligence?.todayPlan.map((item, index) => <button key={item.id} onClick={() => onNavigate(item.lessonNumber, item.section)}><span>{String(index + 1).padStart(2, "0")} · {item.minutes} phút</span><strong>{item.title}</strong><p>{item.reason}</p><i>Mở phần học →</i></button>)}</div>
      </section>

      <section className="ai-two-column">
        <article className="ai-competency-card"><header><span>Hồ sơ năng lực</span><h2>Theo từng bài đã mở</h2></header><div>{intelligence?.competencies.map((item) => <section key={item.lessonNumber} className={!item.unlocked ? "locked" : ""}><div><span>Bài {item.lessonNumber}</span><strong>{item.label}</strong><small>{item.unlocked ? item.score === null ? "Chưa có điểm kiểm tra" : `Điểm tốt nhất ${item.score}/10 · ${item.attempts} lượt` : "Chưa mở"}</small></div><b>{item.mastery}%</b><em><i style={{ width: `${item.mastery}%` }} /></em></section>)}</div></article>
        <article className="ai-self-card"><header><span>Tự đánh giá</span><h2>{learnerName} vừa tập thế nào?</h2><p>Không ghi bệnh án hoặc thông tin riêng tư. Chỉ chọn cảm nhận học tập.</p></header><label><span>Phần vừa học</span><select value={assessmentSection} onChange={(event) => setAssessmentSection(event.target.value)}>{Object.entries(sectionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Mức thực hiện · {rating}/5</span><input type="range" min="1" max="5" value={rating} onChange={(event) => setRating(Number(event.target.value))} /></label><label><span>Độ tự tin · {confidence}/5</span><input type="range" min="1" max="5" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label><label><span>Ghi chú không bắt buộc</span><textarea maxLength={300} value={assessmentNote} onChange={(event) => setAssessmentNote(event.target.value)} placeholder="Ví dụ: nhịp thở chưa đều ở cuối quãng" /></label><button onClick={() => void saveAssessment()} disabled={busy}>Lưu và tính lại lộ trình</button></article>
      </section>

      <section id="ai-chat" className="ai-chat-card">
        <header><div><span>Trợ giảng có nguồn dẫn</span><h2>Hỏi về kỹ thuật hoặc lỗi cần sửa</h2><p>AI không trả đáp án kiểm tra và sẽ chuyển sang hướng dẫn an toàn khi phát hiện tình huống khẩn cấp.</p></div><span>Bài đang mở · {currentLesson}</span></header>
        <form onSubmit={(event) => { event.preventDefault(); void ask(); }}><textarea value={query} maxLength={500} onChange={(event) => setQuery(event.target.value)} placeholder={`Ví dụ: Bài ${currentLesson}, tôi cần chú ý gì để thực hiện đúng?`} /><div><small>{query.trim().length}/500 · tối đa 30 câu/giờ</small><button disabled={busy || query.trim().length < 2}>Gửi câu hỏi</button></div></form>
        <div className="ai-conversation">{interactions.map((item) => <article key={item.id}><div className="ai-question"><span>{learnerName}</span><p>{item.query}</p></div><div className="ai-answer"><span>Frog AI · {formatDate(item.createdAt)}</span><p>{item.response.answer}</p>{item.response.steps?.length ? <ol>{item.response.steps.map((step) => <li key={step}>{step}</li>)}</ol> : null}{item.response.citations?.length ? <div className="ai-citations">{item.response.citations.map((citation) => <button key={citation.label} onClick={() => onNavigate(citation.lessonNumber, citation.section === "content" ? "hoc-tap" : citation.section === "practice" ? "thuc-hanh" : citation.section === "analysis" ? "phan-tich" : "on-tap")}>{citation.label}</button>)}</div> : null}<footer><span>Phản hồi này có hữu ích?</span><button onClick={() => void sendFeedback(item.id, "helpful")}>Hữu ích</button><button onClick={() => void sendFeedback(item.id, "not_helpful")}>Chưa tốt</button><button onClick={() => void sendFeedback(item.id, "inappropriate")}>Báo nội dung sai</button></footer></div></article>)}{interactions.length === 0 ? <div className="ai-empty"><strong>Chưa có câu hỏi</strong><p>Hỏi một vấn đề cụ thể; câu trả lời sẽ kèm vị trí bài học để đối chiếu.</p></div> : null}</div>
      </section>

      <section className="ai-adaptive-card">
        <header><div><span>Bài luyện thích ứng</span><h2>Mười câu từ những bài còn yếu</h2><p>Câu hỏi lấy từ ngân hàng đã được giáo viên duyệt. Không báo đúng sai từng câu; đạt 8/10, nếu chưa đạt phải tạo lượt mới và làm lại từ đầu.</p></div>{!quiz ? <button onClick={() => void createQuiz()} disabled={busy || !settings?.adaptiveEnabled}>Tạo bài luyện mới</button> : <span>Trọng tâm · Bài {quiz.focusLessons.join(", ")}</span>}</header>
        {quiz ? <div className="ai-adaptive-questions">{quiz.questions.map((item, questionIndex) => <article key={`${item.lessonNumber}-${questionIndex}`}><span>Câu {questionIndex + 1}/10 · Bài {item.lessonNumber}</span><h3>{item.q}</h3><div>{item.options.map((option, optionIndex) => <button key={option} className={quizAnswers[questionIndex] === optionIndex ? "selected" : ""} onClick={() => setQuizAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))}><i>{String.fromCharCode(65 + optionIndex)}</i>{option}</button>)}</div></article>)}<footer><span>Đã trả lời {Object.keys(quizAnswers).length}/10</span><button onClick={() => void submitQuiz()} disabled={busy || Object.keys(quizAnswers).length !== 10}>Nộp toàn bộ bài luyện</button></footer></div> : null}
        {quizResult?.passed ? <div className="ai-quiz-result pass"><strong>{quizResult.score}/10 · Đạt</strong><p>Kết quả bài luyện đã được ghi vào báo cáo AI; bài kiểm tra chính thức của khóa học không bị thay đổi.</p></div> : null}
      </section>

      <section className="ai-before-after"><header><span>Trước và sau</span><h2>So sánh kết quả theo từng bài</h2></header><div>{intelligence?.beforeAfter.length ? intelligence.beforeAfter.map((item) => <article key={item.lessonNumber}><span>Bài {item.lessonNumber}</span><div><small>Lần đầu</small><strong>{item.first}/10</strong></div><i>→</i><div><small>Gần nhất</small><strong>{item.latest}/10</strong></div><em>Tốt nhất {item.best}/10 · {item.attempts} lượt</em></article>) : <p>Chưa đủ hai lượt kiểm tra để lập báo cáo thay đổi.</p>}</div></section>
      <footer className="ai-page-footer"><span>AI chỉ hỗ trợ học tập, không thay thế giáo viên, người giám sát hoặc nhân viên y tế.</span><button onClick={() => { onNotice("Đã cập nhật lại hồ sơ AI từ máy chủ."); void load(); }}>Cập nhật phân tích</button></footer>
    </div>
  );
}
