"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type StoredDeviceCredential = {
  version: 2;
  privateKey: CryptoKey | null;
  publicKey: JsonWebKey;
};

type TeacherAnalysis = {
  score: number;
  confidence: number;
  captureQuality: "good" | "review";
  poseCoverage: number;
  averageVisibility: number;
  cameraView: "rear" | "side";
  errorCount: number;
  topErrors: string[];
  analyzedAt: string | null;
};

type TeacherLearner = {
  name: string;
  personCode: string;
  className: string;
  completedLessons: number;
  totalLessons: number;
  progress: number;
  averageScore: number | null;
  totalActiveMinutes: number;
  lastActivityAt: string | null;
  lastLesson: string | null;
  lastPart: string | null;
  analysisCount: number;
  lastAnalysis: TeacherAnalysis | null;
  needsSupport: boolean;
  inactiveDays: number | null;
};

type TeacherOverview = {
  teacher: { name: string | null; personCode: string | null; className: string | null };
  summary: { learnerCount: number; active7d: number; needingSupport: number; analysisCount: number; averageProgress: number };
  learners: TeacherLearner[];
  privacy: { mediaStored: false; note: string };
};

type TeacherTab = "overview" | "class" | "learners" | "analysis" | "reports" | "schedule" | "profile";

function text(node: Element | null | undefined) {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("boi-ech-doc-lap", 4);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredDeviceCredential() {
  const db = await openDb();
  return new Promise<StoredDeviceCredential | undefined>((resolve, reject) => {
    const request = db.transaction("thiet-bi", "readonly").objectStore("thiet-bi").get("chinh");
    request.onsuccess = () => resolve(request.result as StoredDeviceCredential | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function signedTeacherProof(credential: StoredDeviceCredential, deviceId: string) {
  const challengeResponse = await fetch("/api/device", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "challenge", deviceId }),
  });
  const challengeData = await challengeResponse.json() as { challenge?: string; error?: string };
  if (!challengeResponse.ok || !challengeData.challenge) throw new Error(challengeData.error ?? "Không thể xác thực thiết bị Giảng viên.");
  const message = new TextEncoder().encode(`boi-ech:${deviceId}:${challengeData.challenge}`);
  const signature = credential.privateKey && crypto.subtle
    ? await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message)
    : crypto.getRandomValues(new Uint8Array(64)).buffer;
  return { deviceId, challenge: challengeData.challenge, signature: base64Url(new Uint8Array(signature)) };
}

async function loadTeacherOverview(deviceId: string) {
  const credential = await readStoredDeviceCredential();
  if (!credential) throw new Error("Không tìm thấy khóa thiết bị Giảng viên.");
  const proof = await signedTeacherProof(credential, deviceId);
  const response = await fetch("/api/teacher/overview", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(proof),
  });
  const data = await response.json() as TeacherOverview & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Không thể tải bảng giám sát.");
  return data;
}

function shortDate(value: string | null) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function TeacherIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    overview: <><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/></>,
    class: <><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></>,
    learners: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20a6 6 0 0 1 12 0m0 0a4 4 0 0 1 6 0"/></>,
    analysis: <><path d="M4 18V9m5 9V5m5 13v-7m5 7V3"/></>,
    report: <><path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6M9 7h3"/></>,
    schedule: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
    video: <><rect x="3" y="5" width="14" height="14" rx="3"/><path d="m17 10 4-2v8l-4-2zM8 9l5 3-5 3z"/></>,
    edit: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z"/><path d="m13.5 7 3.5 3.5"/></>,
    shield: <><path d="M12 3 5 6v5c0 5 3.3 8 7 10 3.7-2 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] ?? paths.overview}</svg>;
}

function TeacherNavigation({ tab, setTab, teacherName, className }: { tab: TeacherTab; setTab: (tab: TeacherTab) => void; teacherName: string; className: string }) {
  const rows: Array<{ id: TeacherTab; label: string; icon: string }> = [
    { id: "overview", label: "Tổng quan", icon: "overview" },
    { id: "class", label: "Lớp học", icon: "class" },
    { id: "learners", label: "Học viên", icon: "learners" },
    { id: "analysis", label: "Phân tích video", icon: "analysis" },
    { id: "reports", label: "Báo cáo", icon: "report" },
    { id: "schedule", label: "Lịch giám sát", icon: "schedule" },
    { id: "profile", label: "Hồ sơ", icon: "profile" },
  ];
  return <div className="teacher-role-nav" data-teacher-role-ui>
    <p>Không gian Giảng viên</p>
    <div className="teacher-role-nav-list">{rows.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><TeacherIcon name={item.icon}/><span>{item.label}</span></button>)}</div>
    <a className="teacher-editor-shortcut" href="/bien-tap-noi-dung"><span><TeacherIcon name="edit"/></span><div><small>Quyền chuyên môn</small><strong>Biên tập bài giảng</strong></div><b>→</b></a>
    <div className="teacher-nav-profile"><span>{teacherName.slice(0, 1).toUpperCase()}</span><div><small>Phụ trách</small><strong>{className || "Chưa xác định lớp"}</strong></div></div>
  </div>;
}

function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <article className="teacher-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function LearnerTable({ learners }: { learners: TeacherLearner[] }) {
  return <div className="teacher-table-wrap"><table className="teacher-table"><thead><tr><th>Học viên</th><th>Tiến độ</th><th>Điểm TB</th><th>Video AI</th><th>Hoạt động gần nhất</th><th>Trạng thái</th></tr></thead><tbody>{learners.map((learner) => <tr key={`${learner.personCode}-${learner.name}`}><td><div className="teacher-student"><span>{learner.name.slice(0,1).toUpperCase()}</span><div><strong>{learner.name}</strong><small>{learner.personCode || learner.className}</small></div></div></td><td><div className="teacher-progress"><span><i style={{ width: `${learner.progress}%` }}/></span><b>{learner.progress}%</b></div></td><td>{learner.averageScore === null ? "—" : learner.averageScore.toFixed(1)}</td><td>{learner.analysisCount}</td><td>{shortDate(learner.lastActivityAt)}{learner.lastLesson ? <small className="teacher-cell-note">Bài {learner.lastLesson} · {learner.lastPart ?? "học"}</small> : null}</td><td><span className={`teacher-status ${learner.needsSupport ? "warn" : "ok"}`}>{learner.needsSupport ? "Cần hỗ trợ" : "Đang ổn"}</span></td></tr>)}</tbody></table>{learners.length === 0 ? <div className="teacher-empty">Chưa có học viên nào trong đúng lớp/đơn vị phụ trách của Giảng viên.</div> : null}</div>;
}

function AnalysisList({ learners }: { learners: TeacherLearner[] }) {
  const items = learners.filter((item) => item.lastAnalysis).sort((a, b) => Date.parse(b.lastAnalysis?.analyzedAt ?? "") - Date.parse(a.lastAnalysis?.analyzedAt ?? ""));
  return <div className="teacher-analysis-list">{items.map((learner) => {
    const analysis = learner.lastAnalysis!;
    return <article key={`${learner.personCode}-${analysis.analyzedAt}`}><div className="teacher-analysis-score"><strong>{analysis.score}</strong><span>/100</span></div><div className="teacher-analysis-main"><header><div><strong>{learner.name}</strong><small>{learner.className} · {shortDate(analysis.analyzedAt)}</small></div><span className={analysis.captureQuality === "good" && analysis.confidence >= 70 ? "good" : "review"}>{analysis.confidence}% tin cậy</span></header><div className="teacher-analysis-facts"><span>Pose {analysis.poseCoverage}%</span><span>Visibility {analysis.averageVisibility}%</span><span>{analysis.cameraView === "side" ? "Góc ngang" : "Góc sau"}</span><span>{analysis.errorCount} tín hiệu lỗi</span></div>{analysis.topErrors.length ? <p><b>Cần xem:</b> {analysis.topErrors.join(" · ")}</p> : <p>Chưa có tín hiệu lỗi nổi bật trong bản tóm tắt mới nhất.</p>}</div></article>;
  })}{items.length === 0 ? <div className="teacher-empty">Chưa có tóm tắt phân tích video nào từ học viên trong lớp.</div> : null}</div>;
}

function TeacherDashboard({ overview, loading, error, tab, refresh }: { overview: TeacherOverview | null; loading: boolean; error: string; tab: TeacherTab; refresh: () => void }) {
  const learners = overview?.learners ?? [];
  const support = learners.filter((item) => item.needsSupport);
  const summary = overview?.summary ?? { learnerCount: 0, active7d: 0, needingSupport: 0, analysisCount: 0, averageProgress: 0 };
  const teacherName = overview?.teacher.name || text(document.querySelector(".learner-chip strong")).replace(/^Chào\s+/i, "") || "Giảng viên";
  const className = overview?.teacher.className || "Lớp phụ trách";

  if (loading && !overview) return <div className="teacher-dashboard" data-teacher-role-ui><div className="teacher-loading">Đang tải dữ liệu giám sát lớp…</div></div>;

  return <div className="teacher-dashboard" data-teacher-role-ui>
    {tab === "overview" ? <>
      <section className="teacher-hero"><div><span>ĐỒNG HÀNH CÙNG HỌC VIÊN</span><h1>Giám sát học viên,<br/><em>dẫn dắt tiến bộ mỗi ngày.</em></h1><p>Theo dõi tiến độ, bản tóm tắt phân tích AI và các tín hiệu cần hỗ trợ trong đúng lớp/đơn vị bạn phụ trách.</p><div><button onClick={() => document.querySelector<HTMLButtonElement>('[data-teacher-nav-target="learners"]')?.click()}>Xem học viên cần hỗ trợ →</button><a href="/phan-tich-video">Mở phân tích local</a></div></div><aside><TeacherIcon name="shield"/><strong>{className}</strong><small>{overview?.privacy.note ?? "Video gốc không được lưu trên máy chủ."}</small></aside></section>
      <section className="teacher-capabilities"><header><div><span>QUYỀN GIẢNG VIÊN</span><h2>Giám sát bằng dữ liệu thật</h2></div><button onClick={refresh}>Làm mới dữ liệu</button></header><div><article><TeacherIcon name="learners"/><strong>Theo dõi học viên</strong><small>Tiến độ, điểm, thời gian học và hoạt động gần nhất.</small></article><article><TeacherIcon name="analysis"/><strong>Giám sát AI</strong><small>Xem tóm tắt kỹ thuật và mức tin cậy, không truy cập video gốc.</small></article><article><TeacherIcon name="report"/><strong>Phát hiện cần hỗ trợ</strong><small>Tự gom học viên chậm tiến độ hoặc dữ liệu phân tích kém tin cậy.</small></article><article><TeacherIcon name="edit"/><strong>Biên tập bài giảng</strong><small>Dùng đúng luồng xin quyền/biên tập hiện có của hệ thống.</small></article></div></section>
      <section className="teacher-metrics"><Metric label="Học viên" value={summary.learnerCount} note={`${summary.active7d} hoạt động trong 7 ngày`}/><Metric label="Tiến độ lớp" value={`${summary.averageProgress}%`} note="Trung bình số bài đã hoàn thành"/><Metric label="Phân tích AI" value={summary.analysisCount} note="Tổng bản tóm tắt đã đồng bộ"/><Metric label="Cần hỗ trợ" value={summary.needingSupport} note="Chậm tiến độ hoặc bằng chứng yếu"/></section>
      <div className="teacher-main-grid"><section className="teacher-panel"><header><div><span>ƯU TIÊN HÔM NAY</span><h2>Học viên cần chú ý</h2></div><b>{support.length}</b></header><LearnerTable learners={support.slice(0, 8)}/></section><aside className="teacher-panel teacher-privacy"><span>RANH GIỚI DỮ LIỆU</span><h2>Giám sát nhưng không lấy video gốc</h2><p>Bơi ếch AI chỉ cung cấp cho Giảng viên tiến độ và JSON tóm tắt phân tích đã chuẩn hóa. Video, ảnh khung hình và pose landmarks vẫn ở thiết bị học viên.</p><a href="/phan-tich-video">Phân tích một video local →</a></aside></div>
    </> : null}

    {tab === "class" ? <section className="teacher-page"><header><span>LỚP PHỤ TRÁCH</span><h1>{className}</h1><p>Tổng hợp học tập của toàn bộ học viên có cùng lớp/đơn vị đăng ký với tài khoản Giảng viên.</p></header><div className="teacher-metrics"><Metric label="Sĩ số hệ thống" value={summary.learnerCount} note="Tài khoản học viên đã được duyệt"/><Metric label="Hoạt động 7 ngày" value={summary.active7d} note="Có tương tác gần đây"/><Metric label="Tiến độ trung bình" value={`${summary.averageProgress}%`} note="Theo 8 bài học"/><Metric label="Cần can thiệp" value={summary.needingSupport} note="Theo tiêu chí giám sát"/></div><LearnerTable learners={learners}/></section> : null}

    {tab === "learners" ? <section className="teacher-page"><header><span>HỌC VIÊN</span><h1>Danh sách giám sát</h1><p>Không hiển thị số điện thoại hay dữ liệu quản trị; chỉ dùng dữ liệu học tập cần thiết cho chuyên môn.</p></header><LearnerTable learners={learners}/></section> : null}

    {tab === "analysis" ? <section className="teacher-page"><header><span>PHÂN TÍCH VIDEO</span><h1>Tóm tắt AI của học viên</h1><p>Chỉ hiển thị kết quả media-free đã đồng bộ. Nếu cần xem video thật, học viên phải chủ động cung cấp video để phân tích local trên thiết bị.</p><a className="teacher-primary-link" href="/phan-tich-video">Mở workspace phân tích local →</a></header><AnalysisList learners={learners}/></section> : null}

    {tab === "reports" ? <section className="teacher-page"><header><span>BÁO CÁO</span><h1>Báo cáo lớp theo dữ liệu hiện có</h1><p>Tập trung vào tiến độ, hoạt động và mức độ cần hỗ trợ; không biến điểm AI thành đánh giá chính thức.</p></header><div className="teacher-report-grid"><article><strong>{summary.averageProgress}%</strong><span>Tiến độ trung bình</span></article><article><strong>{summary.active7d}/{summary.learnerCount}</strong><span>Học viên hoạt động 7 ngày</span></article><article><strong>{summary.analysisCount}</strong><span>Lần phân tích AI đã đồng bộ</span></article><article><strong>{summary.needingSupport}</strong><span>Học viên cần theo dõi thêm</span></article></div><LearnerTable learners={support}/></section> : null}

    {tab === "schedule" ? <section className="teacher-page"><header><span>LỊCH GIÁM SÁT</span><h1>Ưu tiên theo dữ liệu gần nhất</h1><p>Ứng dụng chưa tự tạo lịch dạy thay Giảng viên; bảng này sắp các ca cần kiểm tra dựa trên học viên đang có tín hiệu cần hỗ trợ.</p></header><div className="teacher-schedule-list">{support.slice(0, 10).map((learner, index) => <article key={learner.personCode || learner.name}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{learner.name}</strong><small>{learner.inactiveDays && learner.inactiveDays >= 7 ? `Chưa hoạt động ${learner.inactiveDays} ngày` : learner.lastAnalysis?.confidence && learner.lastAnalysis.confidence < 70 ? `Phân tích gần nhất tin cậy ${learner.lastAnalysis.confidence}%` : `Tiến độ ${learner.progress}%`}</small></div><b>Bài {learner.lastLesson ?? "—"}</b></article>)}</div></section> : null}

    {tab === "profile" ? <section className="teacher-page"><header><span>HỒ SƠ GIẢNG VIÊN</span><h1>{teacherName}</h1><p>Quyền giám sát được ràng buộc với số hiệu, thiết bị đã ký và lớp/đơn vị phụ trách trong hồ sơ đăng ký.</p></header><dl className="teacher-profile"><div><dt>Vai trò</dt><dd>Giảng viên</dd></div><div><dt>Số hiệu</dt><dd>{overview?.teacher.personCode || "—"}</dd></div><div><dt>Lớp / đơn vị phụ trách</dt><dd>{className}</dd></div><div><dt>Phạm vi học viên</dt><dd>Chỉ học viên cùng lớp/đơn vị</dd></div></dl><div className="teacher-profile-actions"><a href="/bien-tap-noi-dung">Biên tập nội dung bài giảng</a><a href="/phan-tich-video">Phân tích video local</a></div></section> : null}

    {error ? <div className="teacher-error" role="alert">{error}<button onClick={refresh}>Thử lại</button></div> : null}
  </div>;
}

export default function TeacherRoleShell() {
  const [active, setActive] = useState(false);
  const [tab, setTab] = useState<TeacherTab>("overview");
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dashboardMount, setDashboardMount] = useState<HTMLElement | null>(null);
  const [navMount, setNavMount] = useState<HTMLElement | null>(null);
  const deviceIdRef = useRef("");
  const loadedDeviceRef = useRef("");

  const refresh = useMemo(() => () => {
    const deviceId = deviceIdRef.current;
    if (!deviceId) return;
    setLoading(true);
    setError("");
    loadTeacherOverview(deviceId)
      .then((data) => { loadedDeviceRef.current = deviceId; setOverview(data); })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Không thể tải dữ liệu Giảng viên."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (window.location.pathname !== "/") return;
    let observer: MutationObserver | null = null;
    let timer = 0;
    let dashboardNode: HTMLElement | null = null;
    let navNode: HTMLElement | null = null;

    const sync = () => {
      timer = 0;
      const shell = document.querySelector<HTMLElement>(".app-shell");
      const role = text(document.querySelector(".learner-chip small"));
      const isTeacher = Boolean(shell && role === "Giảng viên");
      setActive(isTeacher);
      if (!isTeacher || !shell) {
        delete document.body.dataset.teacherRoleUi;
        return;
      }
      document.body.dataset.teacherRoleUi = "active";
      const main = shell.querySelector<HTMLElement>(".main-area");
      const sidebar = shell.querySelector<HTMLElement>(".sidebar");
      const topbar = main?.querySelector<HTMLElement>(":scope > .topbar");
      if (!main || !sidebar || !topbar) return;

      if (!dashboardNode) {
        dashboardNode = document.createElement("div");
        dashboardNode.className = "teacher-role-dashboard-mount";
        dashboardNode.dataset.teacherRoleUi = "mount";
        topbar.insertAdjacentElement("afterend", dashboardNode);
        setDashboardMount(dashboardNode);
      }
      if (!navNode) {
        navNode = document.createElement("div");
        navNode.className = "teacher-role-nav-mount";
        navNode.dataset.teacherRoleUi = "mount";
        sidebar.querySelector(".brand-row")?.insertAdjacentElement("afterend", navNode);
        setNavMount(navNode);
      }

      const chip = document.querySelector<HTMLElement>(".learner-chip");
      const title = chip?.getAttribute("title") ?? "";
      const code = title.includes("·") ? title.split("·").slice(1).join("·").trim() : "";
      const candidate = code && /^[a-f0-9]{64}$/i.test(code) ? code : "";
      const stateDeviceId = document.querySelector<HTMLElement>(".app-shell")?.getAttribute("data-device-id") ?? "";
      deviceIdRef.current = stateDeviceId || candidate;

      if (!deviceIdRef.current) {
        readStoredDeviceCredential().then(async (credential) => {
          if (!credential?.publicKey) return;
          const canonical = JSON.stringify({ kty: credential.publicKey.kty, crv: credential.publicKey.crv, x: credential.publicKey.x, y: credential.publicKey.y });
          const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
          deviceIdRef.current = [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
          if (loadedDeviceRef.current !== deviceIdRef.current) refresh();
        }).catch(() => undefined);
      } else if (loadedDeviceRef.current !== deviceIdRef.current && !loading) {
        refresh();
      }
    };

    const schedule = () => {
      if (timer) return;
      timer = window.setTimeout(sync, 0);
    };
    schedule();
    observer = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => mutation.target instanceof Element && mutation.target.closest("[data-teacher-role-ui]"))) return;
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "title"] });
    return () => {
      if (timer) window.clearTimeout(timer);
      observer?.disconnect();
      dashboardNode?.remove();
      navNode?.remove();
      delete document.body.dataset.teacherRoleUi;
    };
  }, [loading, refresh]);

  if (!active) return null;
  const teacherName = overview?.teacher.name || text(document.querySelector(".learner-chip strong")).replace(/^Chào\s+/i, "") || "Giảng viên";
  const className = overview?.teacher.className || "Lớp phụ trách";
  const nav = navMount ? createPortal(<div data-teacher-role-ui><TeacherNavigation tab={tab} setTab={setTab} teacherName={teacherName} className={className}/><div className="teacher-hidden-nav-targets">{(["learners"] as const).map((id) => <button key={id} data-teacher-nav-target={id} onClick={() => setTab(id)}/>)}</div></div>, navMount) : null;
  const dashboard = dashboardMount ? createPortal(<TeacherDashboard overview={overview} loading={loading} error={error} tab={tab} refresh={refresh}/>, dashboardMount) : null;
  return <>{nav}{dashboard}</>;
}
