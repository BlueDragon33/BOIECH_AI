"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  analyzeHealthSymptoms,
  analyzeHealthTrend,
  HEALTH_SYMPTOMS,
  type HealthCheckInput,
  type HealthCheckResult,
  type HealthCourseTrend,
  type HealthEpisodeEntry,
  type HealthSymptomKey,
} from "./health-offline-engine";

type Question = { q: string; options: [string, string, string, string]; answer: number; explain: string };
type Lesson = {
  number: string;
  title: string;
  summary: string;
  content: { html: string; safety: string[] };
  practice: { steps: string[] };
  analysis: { html: string };
  review: { points: string[] };
  quiz: { questions: Question[] };
};
type Course = {
  schemaVersion: number;
  application: string;
  policyVersion: string;
  reviewedOn: string;
  title: string;
  passScore: number;
  lessons: Record<string, Lesson>;
};
type View = "home" | "lesson" | "checker" | "doctor" | "emergency";
type Tab = "Học" | "Thực hành" | "Phân tích" | "Ôn tập" | "Kiểm tra";
type Profile = { id: string; nickname: string; ageMonths: number; sex: "boy" | "girl" };

type StoredEpisode = { id: string; profileId: string; name: string; createdAt: string; entries: HealthEpisodeEntry[] };

const tabs: Tab[] = ["Học", "Thực hành", "Phân tích", "Ôn tập", "Kiểm tra"];
const store = {
  profile: "child-health-profile-v1",
  progress: "child-health-progress-v1",
  scores: "child-health-scores-v1",
  episodes: "child-health-episodes-v1",
};

function safeJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function plainRichText(value: string) {
  return value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<[^>]*>/g, "")
    .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&").replaceAll("&nbsp;", " ")
    .replace(/\n{3,}/g, "\n\n").trim();
}

function ageBand(age: number) {
  if (age < 12) return "9–11 tháng";
  if (age < 24) return "1 tuổi";
  if (age < 36) return "2 tuổi";
  if (age < 48) return "3 tuổi";
  if (age < 60) return "4 tuổi";
  return "5 tuổi";
}

function breathThreshold(age: number) { return age < 12 ? "≥50 lần/phút" : "≥40 lần/phút"; }

function checkerDefault(ageMonths: number): HealthCheckInput {
  return { ageMonths, symptoms: [], days: 1, course: "same", intakePercent: 100, hoursSinceUrine: 0 };
}

export default function HealthClient({ initialCourse }: { initialCourse: Course }) {
  const lessonNumbers = Object.keys(initialCourse.lessons).sort();
  const [view, setView] = useState<View>("home");
  const [lessonNumber, setLessonNumber] = useState(lessonNumbers[0] ?? "01");
  const [tab, setTab] = useState<Tab>("Học");
  const [profile, setProfile] = useState<Profile>({ id: "child-1", nickname: "Bé", ageMonths: 9, sex: "boy" });
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);
  const [checker, setChecker] = useState<HealthCheckInput>(checkerDefault(9));
  const [checkerResult, setCheckerResult] = useState<HealthCheckResult | null>(null);
  const [episodes, setEpisodes] = useState<StoredEpisode[]>([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState("");
  const [episodeEntry, setEpisodeEntry] = useState<HealthEpisodeEntry>({ ...checkerDefault(9), id: "entry", time: new Date().toISOString(), coughSeverity: 0, energy: 3 });

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      const fallbackProfile: Profile = { id: "child-1", nickname: "Bé", ageMonths: 9, sex: "boy" };
      const loadedProfile = safeJson<Profile>(localStorage.getItem(store.profile), fallbackProfile);
      const ageMonths = Math.max(9, Math.min(60, loadedProfile.ageMonths || 9));
      const nextProfile = { ...loadedProfile, ageMonths };
      const storedEpisodes = safeJson<StoredEpisode[]>(localStorage.getItem(store.episodes), []);
      setProfile(nextProfile);
      setProgress(safeJson<Record<string, boolean>>(localStorage.getItem(store.progress), {}));
      setScores(safeJson<Record<string, number>>(localStorage.getItem(store.scores), {}));
      setEpisodes(storedEpisodes);
      setActiveEpisodeId(storedEpisodes.find((item) => item.profileId === nextProfile.id)?.id ?? "");
      setChecker(checkerDefault(ageMonths));
      setEpisodeEntry({ ...checkerDefault(ageMonths), id: crypto.randomUUID(), time: new Date().toISOString(), coughSeverity: 0, energy: 3 });
      setHydrated(true);
    });
    return () => { cancelled = true; window.cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem(store.profile, JSON.stringify(profile)); }, [profile, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(store.progress, JSON.stringify(progress)); }, [progress, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(store.scores, JSON.stringify(scores)); }, [scores, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(store.episodes, JSON.stringify(episodes)); }, [episodes, hydrated]);

  const lessons = lessonNumbers.map((number) => initialCourse.lessons[number]);
  const currentLesson = initialCourse.lessons[lessonNumber];
  const activeEpisode = episodes.find((item) => item.id === activeEpisodeId && item.profileId === profile.id) ?? null;
  const trend = activeEpisode ? analyzeHealthTrend(activeEpisode.entries) : { warnings: [], improvements: [] };
  const completion = Math.round(lessons.reduce((sum, lesson) => {
    const completeTabs = tabs.filter((item) => item === "Kiểm tra" ? (scores[lesson.number] ?? 0) >= initialCourse.passScore : progress[`${lesson.number}:${item}`]).length;
    return sum + completeTabs / tabs.length;
  }, 0) / Math.max(1, lessons.length) * 100);

  function changeAge(value: number) {
    const ageMonths = Math.max(9, Math.min(60, value || 9));
    setProfile((current) => ({ ...current, ageMonths }));
    setChecker((current) => ({ ...current, ageMonths }));
    setEpisodeEntry((current) => ({ ...current, ageMonths }));
  }

  function selectLesson(number: string) { setLessonNumber(number); setTab("Học"); setView("lesson"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function markDone() { if (tab !== "Kiểm tra") setProgress((current) => ({ ...current, [`${lessonNumber}:${tab}`]: true })); }
  function nextTab() { const index = tabs.indexOf(tab); if (index < tabs.length - 1) setTab(tabs[index + 1]); }
  function toggleSymptom(key: HealthSymptomKey, target: "checker" | "episode") {
    const update = (value: HealthCheckInput) => ({ ...value, symptoms: value.symptoms.includes(key) ? value.symptoms.filter((item) => item !== key) : [...value.symptoms, key] });
    if (target === "checker") setChecker(update);
    else setEpisodeEntry((current) => ({ ...current, ...update(current) }));
  }
  function runChecker() { setCheckerResult(analyzeHealthSymptoms({ ...checker, ageMonths: profile.ageMonths })); }
  function createEpisode() {
    const created: StoredEpisode = { id: crypto.randomUUID(), profileId: profile.id, name: `Đợt bệnh ${new Date().toLocaleDateString("vi-VN")}`, createdAt: new Date().toISOString(), entries: [] };
    setEpisodes((current) => [created, ...current]); setActiveEpisodeId(created.id);
  }
  function saveEpisodeEntry() {
    if (!activeEpisode) return;
    const entry: HealthEpisodeEntry = { ...episodeEntry, id: crypto.randomUUID(), time: new Date().toISOString(), ageMonths: profile.ageMonths };
    setEpisodes((current) => current.map((item) => item.id === activeEpisode.id ? { ...item, entries: [...item.entries, entry] } : item));
    setEpisodeEntry({ ...checkerDefault(profile.ageMonths), id: crypto.randomUUID(), time: new Date().toISOString(), coughSeverity: 0, energy: 3 });
  }

  return <main className="health-shell">
    <header className="health-top"><div>
      <div className="health-brand"><div className="health-logo">SK</div><div><strong>Sức khỏe trẻ 9 tháng–5 tuổi</strong><small>Giáo trình + Bác sĩ gia đình Offline</small></div></div>
      <div className="health-top-actions"><Link className="health-button" href="/bien-tap-suc-khoe-tre">Biên tập</Link><button className="health-button danger" onClick={() => setView("emergency")}>Cấp cứu</button></div>
    </div></header>

    <div className="health-layout">
      <aside className="health-side">
        <section className="health-profile">
          <label>Biệt danh của bé</label><input value={profile.nickname} maxLength={30} onChange={(event) => setProfile({ ...profile, nickname: event.target.value })} />
          <label>Tuổi (tháng)</label><input type="number" min={9} max={60} value={profile.ageMonths} onChange={(event) => changeAge(Number(event.target.value))} />
          <label>Giới</label><select value={profile.sex} onChange={(event) => setProfile({ ...profile, sex: event.target.value === "girl" ? "girl" : "boy" })}><option value="boy">Bé trai</option><option value="girl">Bé gái</option></select>
          <div className="health-progress"><span style={{ width: `${completion}%` }} /></div><small>Tiến độ giáo trình {completion}%</small>
        </section>
        <button className="health-button primary" style={{ width: "100%", marginTop: 10 }} onClick={() => setView("checker")}>AI Offline · Kiểm tra triệu chứng</button>
        <button className="health-button" style={{ width: "100%", marginTop: 7 }} onClick={() => setView("doctor")}>Nhật ký bệnh & xu hướng</button>
        <div className="health-side-title">8 bài học</div>
        <nav className="health-nav">{lessons.map((lesson) => <button key={lesson.number} className={view === "lesson" && lesson.number === lessonNumber ? "active" : ""} onClick={() => selectLesson(lesson.number)}><i>{lesson.number}</i><span>{lesson.title}</span><small>{(scores[lesson.number] ?? 0) >= initialCourse.passScore ? "✓" : ""}</small></button>)}</nav>
      </aside>

      <section className="health-main">
        {view === "home" ? <Home course={initialCourse} profile={profile} completion={completion} lessons={lessons} selectLesson={selectLesson} openChecker={() => setView("checker")} openDoctor={() => setView("doctor")} /> : null}
        {view === "lesson" && currentLesson ? <LessonView course={initialCourse} lesson={currentLesson} tab={tab} setTab={setTab} markDone={markDone} nextTab={nextTab} bestScore={scores[lessonNumber] ?? 0} saveScore={(value) => setScores((current) => ({ ...current, [lessonNumber]: Math.max(current[lessonNumber] ?? 0, value) }))} /> : null}
        {view === "checker" ? <Checker profile={profile} input={checker} setInput={setChecker} toggle={(key) => toggleSymptom(key, "checker")} result={checkerResult} run={runChecker} /> : null}
        {view === "doctor" ? <Doctor profile={profile} episodes={episodes.filter((item) => item.profileId === profile.id)} active={activeEpisode} setActive={setActiveEpisodeId} create={createEpisode} entry={episodeEntry} setEntry={setEpisodeEntry} toggle={(key) => toggleSymptom(key, "episode")} save={saveEpisodeEntry} trend={trend} /> : null}
        {view === "emergency" ? <Emergency profile={profile} openChecker={() => setView("checker")} /> : null}
      </section>
    </div>

    <nav className="health-mobile"><button onClick={() => setView("home")}>Tổng quan</button><button onClick={() => setView("checker")}>Triệu chứng</button><button onClick={() => setView("doctor")}>Nhật ký</button><button onClick={() => setView("emergency")}>Cấp cứu</button></nav>
    <footer className="health-footer">Nội dung giáo trình chỉ lấy từ bản đã được Trung tâm quản trị phê duyệt. Hồ sơ, triệu chứng và nhật ký bệnh của gia đình chỉ lưu trong trình duyệt này và không được gửi về Trung tâm. Site hỗ trợ ghi nhớ/phân tầng nguy cơ, không thay thế khám và chẩn đoán.</footer>
  </main>;
}

function Home({ course, profile, completion, lessons, selectLesson, openChecker, openDoctor }: { course: Course; profile: Profile; completion: number; lessons: Lesson[]; selectLesson: (n: string) => void; openChecker: () => void; openDoctor: () => void }) {
  return <>
    <section className="health-hero"><span>Nội dung đã kiểm duyệt · {course.reviewedOn}</span><h1>{course.title}</h1><p>Giáo trình 8 bài dành cho cha mẹ, kết hợp AI offline phân tầng nguy cơ và nhật ký diễn biến. Luật cấp cứu chạy độc lập với nội dung biên tập.</p><div className="health-pills"><i className="health-pill">{ageBand(profile.ageMonths)}</i><i className="health-pill">{profile.sex === "boy" ? "Bé trai" : "Bé gái"}</i><i className="health-pill">Thở nhanh: {breathThreshold(profile.ageMonths)}</i><i className="health-pill">Tiến độ {completion}%</i><i className="health-pill">Policy {course.policyVersion}</i></div></section>
    <div className="health-emergency"><strong>Dấu đỏ:</strong> khó thở rõ/rút lõm ngực, tím môi, ngưng thở, co giật, li bì/khó đánh thức hoặc không uống được → cần đánh giá y tế khẩn, không trì hoãn để thử thêm thuốc tại nhà.</div>
    <section className="health-card"><h2>Công cụ dùng ngay</h2><div className="health-grid"><button className="health-lesson-card" onClick={openChecker}><small>AI OFFLINE</small><h3>Kiểm tra triệu chứng</h3><p>Chọn dấu hiệu + nhịp thở + SpO₂ + lượng uống để phân tầng nguy cơ và các khả năng cần nghĩ tới.</p></button><button className="health-lesson-card" onClick={openDoctor}><small>THEO DÕI NHIỀU NGÀY</small><h3>Bác sĩ gia đình Offline</h3><p>So sánh diễn biến và cảnh báo tình huống ho giảm nhưng hô hấp/toàn trạng đang xấu.</p></button></div></section>
    <section className="health-card"><h2>Lộ trình 8 bài</h2><div className="health-grid">{lessons.map((lesson) => <button className="health-lesson-card" key={lesson.number} onClick={() => selectLesson(lesson.number)}><small>Bài {lesson.number}</small><h3>{lesson.title}</h3><p>{lesson.summary}</p></button>)}</div></section>
    <section className="health-card"><h2>Ghi nhớ theo hồ sơ hiện tại</h2><ul className="health-list"><li>Ngưỡng thở nhanh khi ho/khó thở: <strong>{breathThreshold(profile.ageMonths)}</strong>, đếm đủ 60 giây khi trẻ yên.</li><li>{profile.ageMonths < 12 ? <strong>Chưa dùng mật ong, kể cả mật ong hấp quất/chanh.</strong> : "Từ 12 tháng có thể dùng một lượng nhỏ mật ong để dịu ho khi cần."}</li><li>{profile.sex === "boy" ? "Bé trai: không cố tuột bao quy đầu chưa tự tách." : "Bé gái: vệ sinh nhẹ và dạy lau từ trước ra sau khi đủ tuổi."}</li></ul></section>
  </>;
}

function LessonView({ course, lesson, tab, setTab, markDone, nextTab, bestScore, saveScore }: { course: Course; lesson: Lesson; tab: Tab; setTab: (t: Tab) => void; markDone: () => void; nextTab: () => void; bestScore: number; saveScore: (n: number) => void }) {
  return <section className="health-card"><small className="health-muted">Bài {lesson.number}</small><h1>{lesson.title}</h1><p className="health-muted">{lesson.summary}</p><div className="health-tabs">{tabs.map((item) => <button key={item} className={item === tab ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
    {tab === "Học" ? <><div className="health-rich">{plainRichText(lesson.content.html)}</div>{lesson.content.safety.map((text) => <div className="health-safety" key={text}>{text}</div>)}<div style={{ display: "flex", gap: 8 }}><button className="health-button primary" onClick={markDone}>Đã học</button><button className="health-button" onClick={nextTab}>Tiếp: Thực hành</button></div></> : null}
    {tab === "Thực hành" ? <><h3>Checklist thực hành</h3><ol className="health-list">{lesson.practice.steps.map((step) => <li key={step}>{step}</li>)}</ol><div style={{ display: "flex", gap: 8 }}><button className="health-button primary" onClick={markDone}>Hoàn thành</button><button className="health-button" onClick={nextTab}>Tiếp: Phân tích</button></div></> : null}
    {tab === "Phân tích" ? <><div className="health-rich">{plainRichText(lesson.analysis.html)}</div><div style={{ display: "flex", gap: 8 }}><button className="health-button primary" onClick={markDone}>Đã hiểu</button><button className="health-button" onClick={nextTab}>Tiếp: Ôn tập</button></div></> : null}
    {tab === "Ôn tập" ? <><ul className="health-list">{lesson.review.points.map((point) => <li key={point}>{point}</li>)}</ul><div style={{ display: "flex", gap: 8 }}><button className="health-button primary" onClick={markDone}>Hoàn thành ôn tập</button><button className="health-button" onClick={nextTab}>Làm kiểm tra</button></div></> : null}
    {tab === "Kiểm tra" ? <Quiz lesson={lesson} passScore={course.passScore} bestScore={bestScore} saveScore={saveScore} /> : null}
  </section>;
}

function Quiz({ lesson, passScore, bestScore, saveScore }: { lesson: Lesson; passScore: number; bestScore: number; saveScore: (n: number) => void }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<number | null>(null);
  function submit() { if (Object.keys(answers).length !== lesson.quiz.questions.length) return; const value = lesson.quiz.questions.reduce((sum, q, i) => sum + (answers[i] === q.answer ? 1 : 0), 0); setResult(value); saveScore(value); }
  return <><h3>Kiểm tra 10 câu · đạt từ {passScore}/10</h3>{lesson.quiz.questions.map((q, index) => <article className="health-quiz" key={`${q.q}-${index}`}><strong>Câu {index + 1}. {q.q}</strong>{q.options.map((option, oi) => <label className="health-option" key={option}><input type="radio" name={`health-q-${lesson.number}-${index}`} checked={answers[index] === oi} onChange={() => setAnswers({ ...answers, [index]: oi })} /> {option}</label>)}{result !== null ? <small className="health-muted">{answers[index] === q.answer ? "Đúng. " : `Đáp án đúng: ${q.options[q.answer]}. `}{q.explain}</small> : null}</article>)}<button className="health-button primary" onClick={submit} disabled={Object.keys(answers).length !== lesson.quiz.questions.length}>Nộp bài</button>{result !== null ? <div className={`health-score ${result >= passScore ? "pass" : "fail"}`}>Kết quả {result}/10 · {result >= passScore ? "Đạt" : "Chưa đạt"}. Điểm tốt nhất đã lưu: {Math.max(bestScore, result)}/10.</div> : bestScore ? <div className={`health-score ${bestScore >= passScore ? "pass" : "fail"}`}>Điểm tốt nhất: {bestScore}/10.</div> : null}</>;
}

function Checker({ profile, input, setInput, toggle, result, run }: { profile: Profile; input: HealthCheckInput; setInput: (v: HealthCheckInput) => void; toggle: (k: HealthSymptomKey) => void; result: HealthCheckResult | null; run: () => void }) {
  const groups = [...new Set(HEALTH_SYMPTOMS.map((item) => item.group))];
  return <><section className="health-checker-head"><small>AI OFFLINE · DỮ LIỆU KHÔNG GỬI LÊN MÁY CHỦ</small><h1>Kiểm tra triệu chứng</h1><p>Hàng rào dấu đỏ chạy trước phần nhận dạng mẫu bệnh. Kết quả là phân tầng nguy cơ và định hướng, không phải chẩn đoán chắc chắn.</p></section><section className="health-card"><h2>Thông tin hiện tại · {profile.ageMonths} tháng</h2><div className="health-fields"><Field label="Ngày bệnh thứ"><input type="number" min={1} max={60} value={input.days} onChange={(e) => setInput({ ...input, days: Number(e.target.value) || 1 })} /></Field><Field label="Diễn biến"><select value={input.course} onChange={(e) => setInput({ ...input, course: e.target.value as HealthCourseTrend })}><option value="same">Không đổi rõ</option><option value="better">Đang đỡ</option><option value="worse">Nặng dần</option><option value="betterThenWorse">Đã đỡ rồi nặng lại</option></select></Field><Field label="Nhiệt độ cao nhất °C"><input type="number" step="0.1" placeholder="38.5" value={input.temperature || ""} onChange={(e) => setInput({ ...input, temperature: Number(e.target.value) || undefined })} /></Field><Field label={`Nhịp thở/phút · ngưỡng ${breathThreshold(profile.ageMonths)}`}><input type="number" placeholder="Đếm đủ 60 giây lúc yên" value={input.respiratoryRate || ""} onChange={(e) => setInput({ ...input, respiratoryRate: Number(e.target.value) || undefined })} /></Field><Field label="SpO₂ % nếu có"><input type="number" placeholder="Không có thì để trống" value={input.spo2 || ""} onChange={(e) => setInput({ ...input, spo2: Number(e.target.value) || undefined })} /></Field><Field label="Ăn/uống so bình thường %"><input type="number" min={0} max={100} value={input.intakePercent} onChange={(e) => setInput({ ...input, intakePercent: Number(e.target.value) })} /></Field><Field label="Số giờ từ lần tiểu cuối"><input type="number" min={0} max={48} value={input.hoursSinceUrine} onChange={(e) => setInput({ ...input, hoursSinceUrine: Number(e.target.value) || 0 })} /></Field></div></section><section className="health-card"><h2>Chọn triệu chứng</h2><div className="health-symptom-groups">{groups.map((group) => <div className="health-symptom-group" key={group}><h4>{group}</h4>{HEALTH_SYMPTOMS.filter((item) => item.group === group).map((item) => <label className={`health-symptom ${item.danger ? "danger" : ""}`} key={item.id}><input type="checkbox" checked={input.symptoms.includes(item.id)} onChange={() => toggle(item.id)} />{item.label}</label>)}</div>)}</div><button className="health-button primary" style={{ marginTop: 12 }} onClick={run}>AI offline tổng hợp</button></section>{result ? <Result result={result} /> : null}</>;
}

function Result({ result }: { result: HealthCheckResult }) {
  return <section className="health-card"><div className={`health-result l${result.level}`}><small>MỨC ƯU TIÊN</small><h2>{result.title}</h2><p>{result.summary}</p></div><div className="health-result-grid"><div className="health-result-box"><h3>Vì sao?</h3>{result.reasons.length ? <ul className="health-list">{result.reasons.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Chưa phát hiện dấu nguy hiểm trong dữ liệu đã nhập.</p>}</div><div className="health-result-box"><h3>Nên làm gì?</h3><ul className="health-list">{result.actions.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="health-result-box"><h3>Các khả năng cần nghĩ tới</h3>{result.patterns.length ? result.patterns.map((item) => <article className="health-rule" key={item.name}><strong>{item.name}</strong><small>{item.strength}</small><ul className="health-list">{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></article>) : <p>Chưa đủ dữ liệu để nhận dạng mẫu bệnh rõ.</p>}<small className="health-source-note">Không phải chẩn đoán.</small></div><div className="health-result-box"><h3>Không nên tự làm</h3><ul className="health-list">{result.avoid.map((item) => <li key={item}>{item}</li>)}</ul></div></div><div className="health-result-box" style={{ marginTop: 10 }}><strong>Độ đầy đủ dữ liệu: {result.dataQuality}%</strong><div className="health-quality"><span style={{ width: `${result.dataQuality}%` }} /></div>{result.missing.length ? <p className="health-source-note">Nên bổ sung: {result.missing.join("; ")}</p> : null}</div>{result.rules.length ? <div className="health-result-box" style={{ marginTop: 10 }}><h3>Luật an toàn đã kích hoạt</h3>{result.rules.map((rule) => <div className="health-rule" key={`${rule.source}-${rule.label}`}><strong>{rule.label} · {rule.source}</strong><small>{rule.detail}</small></div>)}</div> : null}</section>;
}

function Doctor({ profile, episodes, active, setActive, create, entry, setEntry, toggle, save, trend }: { profile: Profile; episodes: StoredEpisode[]; active: StoredEpisode | null; setActive: (id: string) => void; create: () => void; entry: HealthEpisodeEntry; setEntry: (v: HealthEpisodeEntry) => void; toggle: (k: HealthSymptomKey) => void; save: () => void; trend: { warnings: string[]; improvements: string[] } }) {
  const point = active?.entries.length ? analyzeHealthSymptoms(active.entries.at(-1)!) : null;
  return <><section className="health-doctor"><small>100% OFFLINE</small><h1>Bác sĩ gia đình Offline</h1><p>Ghi cùng một đợt bệnh qua nhiều lần để phát hiện xu hướng thay vì chỉ nhìn tiếng ho hoặc sốt ở một thời điểm.</p></section><section className="health-card"><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><h2>Đợt bệnh</h2><p className="health-muted">Dữ liệu chỉ nằm trên trình duyệt hiện tại.</p></div><button className="health-button primary" onClick={create}>+ Đợt mới</button></div>{episodes.map((episode) => <button key={episode.id} className="health-lesson-card" style={{ width: "100%", marginBottom: 7 }} onClick={() => setActive(episode.id)}><strong>{episode.name}</strong><p>{episode.entries.length} lần theo dõi · {episode.id === active?.id ? "Đang mở" : "Nhấn để mở"}</p></button>)}</section>{active ? <><section className="health-card"><h2>Ghi lần theo dõi mới · {profile.nickname}</h2><div className="health-fields"><Field label="Ngày bệnh thứ"><input type="number" min={1} value={entry.days} onChange={(e) => setEntry({ ...entry, days: Number(e.target.value) || 1 })} /></Field><Field label="Nhiệt độ °C"><input type="number" step="0.1" value={entry.temperature || ""} onChange={(e) => setEntry({ ...entry, temperature: Number(e.target.value) || undefined })} /></Field><Field label="Nhịp thở/phút"><input type="number" value={entry.respiratoryRate || ""} onChange={(e) => setEntry({ ...entry, respiratoryRate: Number(e.target.value) || undefined })} /></Field><Field label="SpO₂ %"><input type="number" value={entry.spo2 || ""} onChange={(e) => setEntry({ ...entry, spo2: Number(e.target.value) || undefined })} /></Field><Field label="Ăn/uống %"><input type="number" min={0} max={100} value={entry.intakePercent} onChange={(e) => setEntry({ ...entry, intakePercent: Number(e.target.value) })} /></Field><Field label="Giờ từ lần tiểu cuối"><input type="number" min={0} value={entry.hoursSinceUrine} onChange={(e) => setEntry({ ...entry, hoursSinceUrine: Number(e.target.value) || 0 })} /></Field><Field label="Mức ho"><select value={entry.coughSeverity} onChange={(e) => setEntry({ ...entry, coughSeverity: Number(e.target.value) as 0 | 1 | 2 | 3 })}><option value={0}>Không ho</option><option value={1}>Nhẹ</option><option value={2}>Vừa</option><option value={3}>Nhiều</option></select></Field><Field label="Toàn trạng"><select value={entry.energy} onChange={(e) => setEntry({ ...entry, energy: Number(e.target.value) as 0 | 1 | 2 | 3 })}><option value={3}>Gần bình thường</option><option value={2}>Hơi mệt</option><option value={1}>Mệt rõ</option><option value={0}>Rất mệt/li bì</option></select></Field></div><details style={{ marginTop: 10 }}><summary><strong>Chọn triệu chứng</strong></summary><div className="health-symptom-groups" style={{ marginTop: 8 }}>{[...new Set(HEALTH_SYMPTOMS.map((item) => item.group))].map((group) => <div className="health-symptom-group" key={group}><h4>{group}</h4>{HEALTH_SYMPTOMS.filter((item) => item.group === group).map((item) => <label className={`health-symptom ${item.danger ? "danger" : ""}`} key={item.id}><input type="checkbox" checked={entry.symptoms.includes(item.id)} onChange={() => toggle(item.id)} />{item.label}</label>)}</div>)}</div></details><button className="health-button primary" style={{ marginTop: 10 }} onClick={save}>Lưu và so sánh</button></section><section className="health-card"><h2>AI xu hướng</h2>{trend.warnings.map((warning) => <div className="health-warning" key={warning}>{warning}</div>)}{trend.improvements.length ? <div className="health-result l0"><strong>Dấu cải thiện</strong><ul className="health-list">{trend.improvements.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}{point ? <Result result={point} /> : <p className="health-muted">Chưa có dữ liệu để đánh giá.</p>}</section><section className="health-card"><h2>Dòng thời gian</h2><div className="health-timeline">{[...active.entries].reverse().map((item) => <article key={item.id}><strong>Ngày bệnh {item.days} · {new Date(item.time).toLocaleString("vi-VN")}</strong><p className="health-muted">{item.temperature ? `${item.temperature}°C · ` : ""}{item.respiratoryRate ? `${item.respiratoryRate} nhịp/phút · ` : ""}{item.spo2 ? `SpO₂ ${item.spo2}% · ` : ""}uống {item.intakePercent}% · mức ho {item.coughSeverity}/3 · năng lượng {item.energy}/3</p></article>)}</div></section></> : null}</>;
}

function Emergency({ profile, openChecker }: { profile: Profile; openChecker: () => void }) {
  const signs = ["Tím môi/mặt hoặc khó thở rõ", "Rút lõm ngực mạnh, rên hoặc thở rất gắng sức", "Có cơn ngưng thở", "Li bì/khó đánh thức", "Co giật", "Không uống được hoặc nôn mọi thứ kèm dấu mất nước", "Ban tím/chấm xuất huyết không mất màu khi ấn", "Tình trạng xấu rất nhanh và trẻ khác hẳn thường ngày"];
  return <><section className="health-doctor" style={{ background: "#7d1c14" }}><small>CHẾ ĐỘ KHẨN</small><h1>Dấu hiệu cần xử trí ngay</h1><p>Nếu trẻ có dấu đỏ, ưu tiên cấp cứu/đánh giá y tế thay vì tiếp tục thử thuốc tại nhà.</p></section><section className="health-card"><div className="health-grid">{signs.map((sign) => <div className="health-safety" style={{ borderLeftColor: "#b1261b", background: "#fff0ee" }} key={sign}><strong>{sign}</strong></div>)}</div><h3>Khi đang chờ hoặc di chuyển đi khám</h3><ul className="health-list"><li>Không trì hoãn để tìm thuốc ho, thuốc Đông y, kháng sinh hoặc corticoid.</li><li>Không ép ăn/uống nếu trẻ khó thở nặng, lơ mơ hoặc nôn liên tục.</li><li>Mang theo danh sách thuốc đã dùng và thời điểm dùng.</li><li>Nếu nghi hóc và trẻ không thể ho/nói/khóc hiệu quả, thực hiện sơ cứu đúng lứa tuổi nếu đã được đào tạo và gọi trợ giúp khẩn cấp.</li></ul><p><strong>{profile.ageMonths} tháng:</strong> ngưỡng thở nhanh khi ho/khó thở là {breathThreshold(profile.ageMonths)}. Một số dấu nguy hiểm có thể xảy ra dù SpO₂ máy gia đình trông bình thường.</p><button className="health-button primary" onClick={openChecker}>Mở kiểm tra triệu chứng</button></section></>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="health-field"><label>{label}</label>{children}</div>; }
