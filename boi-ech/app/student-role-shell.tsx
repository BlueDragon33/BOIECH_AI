"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type LessonSnapshot = {
  index: number;
  number: string;
  title: string;
  state: string;
  detail: string;
  locked: boolean;
  done: boolean;
  current: boolean;
};

type StudentSnapshot = {
  name: string;
  initial: string;
  personCode: string;
  activeSection: string;
  completedLessons: number;
  totalLessons: number;
  lessonProgress: number;
  selectedLesson: string;
  network: string;
  access: string;
  deviceType: "desktop" | "phone" | "tablet";
  platform: string;
  browser: string;
  lessons: LessonSnapshot[];
};

const EMPTY: StudentSnapshot = {
  name: "Học viên",
  initial: "H",
  personCode: "",
  activeSection: "Tổng quan",
  completedLessons: 0,
  totalLessons: 8,
  lessonProgress: 0,
  selectedLesson: "01",
  network: "Đang kết nối",
  access: "",
  deviceType: "desktop",
  platform: "",
  browser: "",
  lessons: [],
};

const DEVICE_TYPE_LABELS = {
  desktop: "Máy tính",
  phone: "Điện thoại",
  tablet: "Máy tính bảng / iPad",
} as const;

const ORIGINAL_NAV: Record<string, string> = {
  home: "Tổng quan",
  lessons: "Học tập",
  practice: "Thực hành",
  review: "Ôn tập",
  test: "Kiểm tra",
  results: "Dữ liệu",
  ai: "Frog AI",
};

function text(node: Element | null | undefined) {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function findOriginalNav(label: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".sidebar nav button"))
    .find((button) => text(button.querySelector("b")) === label) ?? null;
}

function clickOriginalNav(label: string) {
  findOriginalNav(label)?.click();
}

function ensureOverview() {
  const overview = findOriginalNav(ORIGINAL_NAV.home);
  if (overview && !overview.classList.contains("active")) overview.click();
}

function scrollStudentTarget(id: string) {
  window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
}

function StudentIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
    roadmap: <><path d="M5 4h14v5H5zM5 15h14v5H5z"/><path d="M9 9v6m6-6v6"/></>,
    lessons: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Zm16 0A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"/></>,
    practice: <><path d="M7 4v7a5 5 0 0 0 10 0V4M5 4h4m6 0h4M12 16v5"/></>,
    video: <><rect x="3" y="5" width="14" height="14" rx="3"/><path d="m17 10 4-2v8l-4-2zM8 9l5 3-5 3z"/></>,
    review: <><path d="M20 11a8 8 0 1 1-2.3-5.7L20 8M20 3v5h-5"/></>,
    test: <><path d="M9 4h6l1 2h3v15H5V6h3l1-2Zm0 8 2 2 4-5m-6 9h6"/></>,
    results: <><path d="M4 19V5m0 14h16M8 16v-4m4 4V7m4 9V9"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
    ai: <><path d="M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.2 7.2 2.1 2.1m0-11.4-2.1 2.1m-7.2 7.2-2.1 2.1"/><circle cx="12" cy="12" r="3"/></>,
    upload: <><path d="M12 16V6m-4 4 4-4 4 4"/><path d="M5 14v5h14v-5"/></>,
    target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></>,
    shield: <><path d="M12 3 5 6v5c0 5 3.3 8 7 10 3.7-2 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] ?? paths.home}</svg>;
}

function StudentNavigation({ snapshot }: { snapshot: StudentSnapshot }) {
  const rows = [
    { icon: "home", label: "Trang chủ", active: snapshot.activeSection === "Tổng quan", action: () => clickOriginalNav(ORIGINAL_NAV.home) },
    { icon: "roadmap", label: "Lộ trình học", action: () => { ensureOverview(); scrollStudentTarget("student-learning-roadmap"); } },
    { icon: "lessons", label: "Bài học", active: snapshot.activeSection === "Học tập", action: () => clickOriginalNav(ORIGINAL_NAV.lessons) },
    { icon: "practice", label: "Thực hành", active: snapshot.activeSection === "Thực hành", action: () => clickOriginalNav(ORIGINAL_NAV.practice) },
    { icon: "video", label: "Phân tích video", action: () => window.location.assign("/phan-tich-video") },
    { icon: "review", label: "Ôn tập", active: snapshot.activeSection === "Ôn tập", action: () => clickOriginalNav(ORIGINAL_NAV.review) },
    { icon: "test", label: "Kiểm tra", active: snapshot.activeSection === "Kiểm tra", action: () => clickOriginalNav(ORIGINAL_NAV.test) },
    { icon: "results", label: "Kết quả", active: snapshot.activeSection === "Dữ liệu", action: () => clickOriginalNav(ORIGINAL_NAV.results) },
    { icon: "profile", label: "Hồ sơ", action: () => { ensureOverview(); scrollStudentTarget("student-profile"); } },
  ];

  return (
    <div className="student-role-nav" data-student-role-ui>
      <p>Không gian học viên</p>
      <div className="student-role-nav-list">
        {rows.map((item) => <button key={item.label} className={item.active ? "active" : ""} onClick={item.action}><StudentIcon name={item.icon}/><span>{item.label}</span>{item.label === "Phân tích video" ? <i>Mới</i> : null}</button>)}
      </div>
      <button className="student-ai-shortcut" onClick={() => clickOriginalNav(ORIGINAL_NAV.ai)}><span><StudentIcon name="ai"/></span><div><small>Trợ giảng cá nhân</small><strong>Frog AI</strong></div><b>→</b></button>
      <div className="student-nav-progress">
        <header><span>Tiến độ toàn khóa</span><strong>{snapshot.completedLessons}/{snapshot.totalLessons}</strong></header>
        <div><i style={{ width: `${Math.round((snapshot.completedLessons / Math.max(1, snapshot.totalLessons)) * 100)}%` }}/></div>
        <small>Học đúng · Luyện chăm · Tiến bộ mỗi ngày</small>
      </div>
    </div>
  );
}

function Capability({ icon, title, text, onClick }: { icon: string; title: string; text: string; onClick: () => void }) {
  return <button className="student-capability" onClick={onClick}><span><StudentIcon name={icon}/></span><strong>{title}</strong><small>{text}</small><i>→</i></button>;
}

function StudentDashboard({ snapshot, openLesson }: { snapshot: StudentSnapshot; openLesson: (index: number) => void }) {
  const percent = Math.round((snapshot.completedLessons / Math.max(1, snapshot.totalLessons)) * 100);
  const remaining = Math.max(0, snapshot.totalLessons - snapshot.completedLessons);
  const visibleLessons = snapshot.lessons.slice(0, 8);

  return (
    <div className="student-dashboard" data-student-role-ui>
      <section className="student-hero">
        <div className="student-hero-copy">
          <span>HỌC BƠI ẾCH CÙNG AI</span>
          <h1>Học đúng kỹ thuật,<br/><em>tiến bộ rõ rệt mỗi ngày.</em></h1>
          <p>Đi theo lộ trình 8 bài, luyện đúng thứ tự, gửi video để AI hỗ trợ phân tích và quay lại kiểm chứng sau mỗi lần sửa kỹ thuật.</p>
          <div className="student-hero-actions">
            <button onClick={() => clickOriginalNav(ORIGINAL_NAV.lessons)}>Tiếp tục học <b>→</b></button>
            <button onClick={() => window.location.assign("/phan-tich-video")}><StudentIcon name="video"/> Phân tích video</button>
          </div>
          <div className="student-hero-trust"><StudentIcon name="shield"/><span>Video được xử lý local-first; kết luận mạnh chỉ mở khi chất lượng bằng chứng đủ tốt.</span></div>
        </div>
        <div className="student-hero-visual" aria-hidden="true">
          <div className="pool-orbit orbit-one"/><div className="pool-orbit orbit-two"/>
          <div className="swimmer-mark"><span/><span/><i/></div>
          <div className="hero-water-line"/>
          <blockquote>“Kỹ thuật tốt hơn.<br/>Phiên bản tốt hơn<br/>của chính bạn.”</blockquote>
        </div>
      </section>

      <section className="student-capabilities">
        <header><div><span>QUYỀN CỦA HỌC VIÊN</span><h2>Những gì bạn có thể làm</h2></div><p>Mọi thao tác dưới đây dùng đúng quyền học viên đã đăng ký trên thiết bị này.</p></header>
        <div>
          <Capability icon="roadmap" title="Xem lộ trình học" text="8 bài theo thứ tự mở khóa" onClick={() => { ensureOverview(); scrollStudentTarget("student-learning-roadmap"); }}/>
          <Capability icon="lessons" title="Học từng bài" text="Nội dung, hình và tiêu chí đạt" onClick={() => clickOriginalNav(ORIGINAL_NAV.lessons)}/>
          <Capability icon="practice" title="Thực hành" text="Bài tập riêng theo từng bài" onClick={() => clickOriginalNav(ORIGINAL_NAV.practice)}/>
          <Capability icon="upload" title="Tải video của mình" text="Phân tích kỹ thuật ngay trên máy" onClick={() => window.location.assign("/phan-tich-video")}/>
          <Capability icon="results" title="Xem kết quả" text="Tiến độ và dữ liệu cá nhân" onClick={() => clickOriginalNav(ORIGINAL_NAV.results)}/>
          <Capability icon="ai" title="Hỏi Frog AI" text="Trợ giảng có nguồn dẫn" onClick={() => clickOriginalNav(ORIGINAL_NAV.ai)}/>
          <Capability icon="test" title="Ôn tập & kiểm tra" text="Đủ 8/10 mới hoàn thành bài" onClick={() => clickOriginalNav(ORIGINAL_NAV.test)}/>
        </div>
      </section>

      <div className="student-teacher-inbox-mount" data-student-teacher-inbox-mount />
      <div className="student-adaptive-coach-mount" data-student-adaptive-mount />

      <div className="student-dashboard-grid">
        <section className="student-learning-card" id="student-learning-roadmap">
          <header><div><span>LỘ TRÌNH CÁ NHÂN</span><h2>8 bài học của bạn</h2></div><button onClick={() => clickOriginalNav(ORIGINAL_NAV.lessons)}>Mở bài đang học →</button></header>
          <div className="student-lesson-grid">
            {visibleLessons.length ? visibleLessons.map((lesson) => (
              <button key={`${lesson.number}-${lesson.index}`} className={`${lesson.done ? "done" : ""} ${lesson.current ? "current" : ""} ${lesson.locked ? "locked" : ""}`} disabled={lesson.locked} onClick={() => openLesson(lesson.index)}>
                <div className="lesson-water"><span>{lesson.number}</span><i/></div>
                <small>{lesson.state}</small>
                <strong>{lesson.title}</strong>
                <p>{lesson.detail}</p>
                <footer><span>{lesson.done ? "Hoàn thành" : lesson.locked ? "Chưa mở" : lesson.current ? "Đang học" : "Sẵn sàng"}</span><b>{lesson.done ? "✓" : lesson.locked ? "—" : "→"}</b></footer>
              </button>
            )) : <div className="student-lessons-loading">Đang đồng bộ lộ trình từ khóa học…</div>}
          </div>
        </section>

        <aside className="student-side-stack">
          <section className="student-goals-card">
            <header><div><span>MỤC TIÊU HÔM NAY</span><h3>Giữ nhịp học đều</h3></div><div className="goal-ring" style={{ "--goal": `${Math.min(100, 35 + snapshot.completedLessons * 7)}%` } as React.CSSProperties}><b>{Math.min(5, 2 + Math.floor(snapshot.completedLessons / 2))}/5</b></div></header>
            <ul>
              <li className="done"><i>✓</i><span>Mở đúng bài đang học</span></li>
              <li className={snapshot.lessonProgress >= 60 ? "done" : ""}><i>{snapshot.lessonProgress >= 60 ? "✓" : ""}</i><span>Hoàn thành một phần của Bài {snapshot.selectedLesson}</span></li>
              <li><i/><span>Luyện tập dưới nước có giám sát</span></li>
              <li><i/><span>Gửi một video để phân tích</span></li>
              <li><i/><span>Xem lại gợi ý sửa lỗi</span></li>
            </ul>
          </section>

          <section className="student-progress-card">
            <header><span>TIẾN ĐỘ HỌC TẬP</span><b>{percent}%</b></header>
            <div className="student-progress-bar"><i style={{ width: `${percent}%` }}/></div>
            <p>Đã hoàn thành <strong>{snapshot.completedLessons}/{snapshot.totalLessons} bài</strong>{remaining ? ` · còn ${remaining} bài` : " · đã hoàn thành lộ trình"}</p>
            <div className="student-mini-stats"><div><strong>{snapshot.lessonProgress}%</strong><span>Bài {snapshot.selectedLesson}</span></div><div><strong>{snapshot.network.includes("offline") ? "Offline" : "Online"}</strong><span>Kết nối</span></div></div>
          </section>
        </aside>
      </div>

      <section className="student-video-card">
        <div className="student-video-copy">
          <span>PHÂN TÍCH VIDEO · LOCAL-FIRST</span>
          <h2>Biến mỗi lần quay thành một lần học có bằng chứng.</h2>
          <p>Tải clip bơi của bạn lên workspace phân tích. Camera Guidance kiểm tra góc quay trước; sau đó AI mới đánh giá kỹ thuật, chu kỳ, đối xứng và mức tin cậy.</p>
          <button onClick={() => window.location.assign("/phan-tich-video")}><StudentIcon name="upload"/> Chọn video để phân tích <b>→</b></button>
        </div>
        <div className="student-video-flow">
          <article><span>01</span><div><strong>Kiểm tra góc quay</strong><small>Preflight + View Quality</small></div><i>✓</i></article>
          <article><span>02</span><div><strong>Phân tích kỹ thuật</strong><small>AI v1 + chu kỳ 5 pha</small></div><i>AI</i></article>
          <article><span>03</span><div><strong>Đối chiếu bằng chứng</strong><small>Trust + cross-module</small></div><i>↔</i></article>
          <article><span>04</span><div><strong>Nhận hướng luyện tập</strong><small>Consensus-aware coaching</small></div><i>→</i></article>
        </div>
      </section>

      <section className="student-profile-card" id="student-profile">
        <div className="student-avatar">{snapshot.initial}</div>
        <div><span>HỒ SƠ HỌC VIÊN</span><h3>{snapshot.name}</h3><p>{snapshot.personCode || "Mã học viên được bảo vệ theo thiết bị"}</p></div>
        <dl><div><dt>Vai trò</dt><dd>Học viên</dd></div><div><dt>Quyền truy cập</dt><dd>{snapshot.access || "Đã xác thực"}</dd></div><div><dt>Trạng thái</dt><dd>{snapshot.network}</dd></div><div><dt>Thiết bị</dt><dd>{DEVICE_TYPE_LABELS[snapshot.deviceType]}{snapshot.platform ? ` · ${snapshot.platform}` : ""}{snapshot.browser ? ` · ${snapshot.browser}` : ""}</dd></div></dl>
      </section>
    </div>
  );
}

export default function StudentRoleShell() {
  const [snapshot, setSnapshot] = useState<StudentSnapshot>(EMPTY);
  const [active, setActive] = useState(false);
  const [dashboardMount, setDashboardMount] = useState<HTMLElement | null>(null);
  const [navMount, setNavMount] = useState<HTMLElement | null>(null);
  const signatureRef = useRef("");

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
      const isLearner = Boolean(shell && role === "Học viên");
      setActive(isLearner);
      if (!isLearner || !shell) {
        delete document.body.dataset.studentRoleUi;
        delete document.body.dataset.studentSection;
        return;
      }

      document.body.dataset.studentRoleUi = "active";
      const main = shell.querySelector<HTMLElement>(".main-area");
      const sidebar = shell.querySelector<HTMLElement>(".sidebar");
      const topbar = main?.querySelector<HTMLElement>(":scope > .topbar");
      if (!main || !sidebar || !topbar) return;

      if (!dashboardNode) {
        dashboardNode = document.createElement("div");
        dashboardNode.className = "student-role-dashboard-mount";
        dashboardNode.dataset.studentRoleUi = "mount";
        topbar.insertAdjacentElement("afterend", dashboardNode);
        setDashboardMount(dashboardNode);
      }
      if (!navNode) {
        navNode = document.createElement("div");
        navNode.className = "student-role-nav-mount";
        navNode.dataset.studentRoleUi = "mount";
        sidebar.querySelector(".brand-row")?.insertAdjacentElement("afterend", navNode);
        setNavMount(navNode);
      }

      const activeButton = sidebar.querySelector<HTMLButtonElement>("nav button.active");
      const activeSection = text(activeButton?.querySelector("b")) || "Tổng quan";
      document.body.dataset.studentSection = activeSection === "Tổng quan" ? "overview" : "content";

      const chip = document.querySelector<HTMLElement>(".learner-chip");
      const rawName = text(chip?.querySelector("strong")).replace(/^Chào\s+/i, "") || "Học viên";
      const title = chip?.getAttribute("title") ?? "";
      const personCode = title.includes("·") ? title.split("·").slice(1).join("·").trim() : "";
      const topStatus = text(document.querySelector(".top-status"));
      const lessonMatch = /([0-9]+)\s*\/\s*([0-9]+)\s*bài/i.exec(topStatus);
      const progressText = text(document.querySelector(".sidebar-progress strong"));
      const progressValue = Number.parseInt(progressText, 10) || 0;
      const selectedText = text(document.querySelector(".sidebar-progress span"));
      const selectedMatch = /Bài\s+(\d+)/i.exec(selectedText);
      const originalLessonCards = Array.from(document.querySelectorAll<HTMLButtonElement>(".page-overview .lesson-card"));
      const lessons = originalLessonCards.map((button, index) => ({
        index,
        number: text(button.querySelector(".lesson-number")) || String(index + 1).padStart(2, "0"),
        title: text(button.querySelector(".lesson-content strong")) || `Bài ${index + 1}`,
        state: text(button.querySelector(".lesson-content small")),
        detail: text(button.querySelector(".lesson-content em")),
        locked: button.disabled || button.classList.contains("locked"),
        done: button.classList.contains("done"),
        current: button.classList.contains("current"),
      }));
      const classifiedType = shell.dataset.deviceType;
      const deviceType = classifiedType === "phone" || classifiedType === "tablet" ? classifiedType : "desktop";
      const next: StudentSnapshot = {
        name: rawName,
        initial: rawName.slice(0, 1).toUpperCase() || "H",
        personCode,
        activeSection,
        completedLessons: lessonMatch ? Number(lessonMatch[1]) : lessons.filter((item) => item.done).length,
        totalLessons: lessonMatch ? Number(lessonMatch[2]) : Math.max(8, lessons.length),
        lessonProgress: Math.max(0, Math.min(100, progressValue)),
        selectedLesson: selectedMatch?.[1] ?? lessons.find((item) => item.current)?.number ?? "01",
        network: text(document.querySelector(".network-state")) || "Đã kết nối",
        access: text(document.querySelector(".payment-access-status")),
        deviceType,
        platform: shell.dataset.devicePlatform ?? "",
        browser: shell.dataset.deviceBrowser ?? "",
        lessons,
      };
      const signature = JSON.stringify(next);
      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        setSnapshot(next);
      }
    };

    const schedule = () => {
      if (timer) return;
      timer = window.setTimeout(sync, 0);
    };
    schedule();
    observer = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => mutation.target instanceof Element && mutation.target.closest("[data-student-role-ui]"))) return;
      schedule();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "disabled", "title", "data-device-id", "data-device-type", "data-device-platform", "data-device-browser"],
    });
    return () => {
      if (timer) window.clearTimeout(timer);
      observer?.disconnect();
      dashboardNode?.remove();
      navNode?.remove();
      delete document.body.dataset.studentRoleUi;
      delete document.body.dataset.studentSection;
    };
  }, []);

  const originalLessonButtons = useMemo(() => () => Array.from(document.querySelectorAll<HTMLButtonElement>(".page-overview .lesson-card")), []);
  const openLesson = (index: number) => originalLessonButtons()[index]?.click();

  if (!active) return null;
  return <>{navMount ? createPortal(<StudentNavigation snapshot={snapshot}/>, navMount) : null}{dashboardMount && snapshot.activeSection === "Tổng quan" ? createPortal(<StudentDashboard snapshot={snapshot} openLesson={openLesson}/>, dashboardMount) : null}</>;
}
