"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./learner-role-ui.module.css";

type LessonSnapshot = {
  number: string;
  title: string;
  status: string;
  detail: string;
  locked: boolean;
};

type LearnerSnapshot = {
  givenName: string;
  fullName: string;
  personCode: string;
  payment: string;
  completed: number;
  coursePercent: number;
  currentLessonPercent: number;
  nextLessonNumber: string;
  nextLessonTitle: string;
  nextStep: string;
  nextCheckpoint: string;
  activeOriginal: string;
  onlineLabel: string;
  lessons: LessonSnapshot[];
};

type IconName =
  | "home"
  | "route"
  | "book"
  | "practice"
  | "video"
  | "review"
  | "test"
  | "result"
  | "profile"
  | "ai"
  | "upload"
  | "chart"
  | "play"
  | "target"
  | "shield"
  | "spark";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    route: <><path d="M5 5h6l2 3h6v5h-6l-2 3H5V5Z"/><path d="M8 8v8"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Zm16 0A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"/></>,
    practice: <><path d="M7 4v7a5 5 0 0 0 10 0V4M5 4h4m6 0h4M12 16v5"/></>,
    video: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/></>,
    review: <><path d="M20 11a8 8 0 1 1-2.3-5.7L20 8M20 3v5h-5"/></>,
    test: <><path d="M9 4h6l1 2h3v15H5V6h3l1-2Zm0 8 2 2 4-5m-6 9h6"/></>,
    result: <><path d="M4 19V5m0 14h16M8 16v-4m4 4V7m4 9V9"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    ai: <><path d="M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.2 7.2 2.1 2.1m0-11.4-2.1 2.1m-7.2 7.2-2.1 2.1"/><circle cx="12" cy="12" r="3"/></>,
    upload: <><path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M5 14v5h14v-5"/></>,
    chart: <><path d="M4 18V9m5 9V5m5 13v-7m5 7V3"/></>,
    play: <><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    spark: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3ZM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function cleanText(node: Element | null | undefined) {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function parsePercent(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)%/);
  return match ? Math.max(0, Math.min(100, Number(match[1]))) : 0;
}

function originalNavButton(label: string) {
  const nav = document.querySelector<HTMLElement>(".sidebar nav");
  if (!nav) return null;
  return Array.from(nav.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    if (button.closest("[data-learner-role-ui]")) return false;
    return cleanText(button.querySelector("b")) === label;
  }) ?? null;
}

function clickOriginalNav(label: string) {
  originalNavButton(label)?.click();
}

function clickContinue() {
  document.querySelector<HTMLButtonElement>(".page-overview .next-step-card button")?.click();
}

function openLesson(number: string) {
  const cards = Array.from(document.querySelectorAll<HTMLButtonElement>(".page-overview .lesson-card"));
  cards.find((card) => cleanText(card.querySelector(".lesson-number")) === number)?.click();
}

function readSnapshot(): LearnerSnapshot | null {
  const role = cleanText(document.querySelector(".learner-chip small"));
  if (role !== "Học viên") return null;

  const chip = document.querySelector<HTMLElement>(".learner-chip");
  const givenName = cleanText(chip?.querySelector("strong")).replace(/^Chào\s+/i, "") || "Học viên";
  const title = chip?.getAttribute("title") ?? "";
  const titleParts = title.split("·").map((item) => item.trim()).filter(Boolean);
  const fullName = titleParts[0] || givenName;
  const personCode = titleParts[1] || "Chưa có mã";
  const payment = cleanText(document.querySelector(".payment-access-status")) || "Đang xác thực";
  const progressStrong = cleanText(document.querySelector(".course-progress-panel strong"));
  const completed = Number(progressStrong.match(/(\d+)\s*\/\s*8/)?.[1] ?? 0);
  const coursePercent = parsePercent(document.querySelector<HTMLElement>(".course-progress-meter i")?.style.width ?? "0%");
  const currentLessonPercent = parsePercent(cleanText(document.querySelector(".sidebar-progress strong")));
  const nextStepCard = document.querySelector<HTMLElement>(".next-step-card");
  const nextLessonNumber = cleanText(nextStepCard?.querySelector(".next-step-position b")).replace(/^Bài\s+/i, "") || "01";
  const nextLessonTitle = cleanText(nextStepCard?.querySelector("h2")) || "Bài học tiếp theo";
  const nextStep = cleanText(nextStepCard?.querySelector(":scope > strong")) || "Tiếp tục theo lộ trình";
  const nextCheckpoint = cleanText(nextStepCard?.querySelector("p")) || "Hoàn thành đúng thứ tự để mở bước tiếp theo.";
  const activeOriginal = cleanText(document.querySelector(".sidebar nav > button.active b"));
  const onlineLabel = cleanText(document.querySelector(".network-state")) || "Trạng thái kết nối";
  const lessons = Array.from(document.querySelectorAll<HTMLButtonElement>(".page-overview .lesson-card")).map((card) => ({
    number: cleanText(card.querySelector(".lesson-number")),
    title: cleanText(card.querySelector(".lesson-content strong")),
    status: cleanText(card.querySelector(".lesson-content small")),
    detail: cleanText(card.querySelector(".lesson-content em")),
    locked: card.disabled || card.classList.contains("locked"),
  })).filter((lesson) => lesson.number && lesson.title);

  return {
    givenName,
    fullName,
    personCode,
    payment,
    completed,
    coursePercent,
    currentLessonPercent,
    nextLessonNumber,
    nextLessonTitle,
    nextStep,
    nextCheckpoint,
    activeOriginal,
    onlineLabel,
    lessons,
  };
}

function customActive(original: string) {
  if (original === "Tổng quan") return "home";
  if (original === "Học tập" || original === "Phân tích") return "lessons";
  if (original === "Thực hành") return "practice";
  if (original === "Ôn tập") return "review";
  if (original === "Kiểm tra") return "test";
  if (original === "Frog AI") return "ai";
  if (original === "Dữ liệu") return "results";
  return "";
}

const navItems = [
  { id: "home", label: "Trang chủ", sub: "Tổng quan học tập", icon: "home" as IconName, original: "Tổng quan" },
  { id: "roadmap", label: "Lộ trình học", sub: "8 bài · 5 bước", icon: "route" as IconName },
  { id: "lessons", label: "Bài học", sub: "Nội dung cốt lõi", icon: "book" as IconName, original: "Học tập" },
  { id: "practice", label: "Thực hành", sub: "Bài tập theo bài", icon: "practice" as IconName, original: "Thực hành" },
  { id: "video", label: "Phân tích video", sub: "AI chạy trên thiết bị", icon: "video" as IconName, href: "/phan-tich-video" },
  { id: "ai", label: "Trợ giảng AI", sub: "Frog AI có nguồn dẫn", icon: "ai" as IconName, original: "Frog AI" },
  { id: "review", label: "Ôn tập", sub: "Sửa lỗi theo bài", icon: "review" as IconName, original: "Ôn tập" },
  { id: "test", label: "Kiểm tra", sub: "Đạt từ 8/10", icon: "test" as IconName, original: "Kiểm tra" },
  { id: "results", label: "Kết quả", sub: "Tiến độ cá nhân", icon: "result" as IconName, original: "Dữ liệu" },
  { id: "profile", label: "Hồ sơ", sub: "Thông tin học viên", icon: "profile" as IconName },
];

function StudentNavigation({ snapshot }: { snapshot: LearnerSnapshot }) {
  const active = customActive(snapshot.activeOriginal);

  const act = (item: (typeof navItems)[number]) => {
    if (item.href) {
      window.location.assign(item.href);
      return;
    }
    if (item.id === "roadmap" || item.id === "profile") {
      if (snapshot.activeOriginal !== "Tổng quan") {
        clickOriginalNav("Tổng quan");
        window.setTimeout(() => document.getElementById(item.id === "roadmap" ? "learner-roadmap" : "learner-profile")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      } else {
        document.getElementById(item.id === "roadmap" ? "learner-roadmap" : "learner-profile")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    if (item.original) clickOriginalNav(item.original);
  };

  return (
    <div className={styles.studentNav} data-learner-role-ui="navigation">
      <p>Không gian học viên</p>
      <div>
        {navItems.map((item) => (
          <button key={item.id} className={active === item.id ? styles.activeNav : ""} onClick={() => act(item)}>
            <span className={styles.navIcon}><Icon name={item.icon} /></span>
            <span><b>{item.label}</b><small>{item.sub}</small></span>
            {item.id === "video" ? <em>AI</em> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function MetricRing({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.metricRingWrap}>
      <div className={styles.metricRing} style={{ "--ring-value": `${Math.max(0, Math.min(100, value)) * 3.6}deg` } as React.CSSProperties}><strong>{value}%</strong></div>
      <span>{label}</span>
    </div>
  );
}

function LearnerDashboard({ snapshot }: { snapshot: LearnerSnapshot }) {
  const capabilities = [
    { icon: "route" as IconName, title: "Xem lộ trình học", text: "Biết rõ bài nào đang mở và bước tiếp theo cần làm.", action: () => document.getElementById("learner-roadmap")?.scrollIntoView({ behavior: "smooth" }) },
    { icon: "book" as IconName, title: "Học từng bài", text: "Học đúng 5 bước, không bỏ qua điều kiện mở khóa.", action: () => clickOriginalNav("Học tập") },
    { icon: "play" as IconName, title: "Quan sát kỹ thuật", text: "Mở phần phân tích bài học để xem lỗi và tiêu chí kỹ thuật.", action: () => clickOriginalNav("Phân tích") },
    { icon: "upload" as IconName, title: "Tải video của mình", text: "Phân tích video local-first, video gốc ở lại trên thiết bị.", action: () => window.location.assign("/phan-tich-video") },
    { icon: "spark" as IconName, title: "Nhận hướng dẫn AI", text: "Dùng Frog AI để hỏi theo đúng nội dung khóa học.", action: () => clickOriginalNav("Frog AI") },
    { icon: "chart" as IconName, title: "Theo dõi tiến bộ", text: "Xem kết quả từng phần và dữ liệu tiến độ cá nhân.", action: () => clickOriginalNav("Dữ liệu") },
    { icon: "test" as IconName, title: "Ôn tập & kiểm tra", text: "Ôn lỗi trước, sau đó đạt tối thiểu 8/10 để qua bài.", action: () => clickOriginalNav("Ôn tập") },
  ];

  const nextLesson = snapshot.lessons.find((lesson) => lesson.number === snapshot.nextLessonNumber);
  const unlocked = snapshot.lessons.filter((lesson) => !lesson.locked).length;

  return (
    <div className={styles.dashboard} data-learner-role-ui="dashboard">
      <section className={styles.hero}>
        <div className={styles.heroBackdrop} />
        <div className={styles.heroCopy}>
          <span>HỌC BƠI ẾCH CÙNG AI</span>
          <h1>Học đúng kỹ thuật,<br/><em>tiến bộ rõ rệt mỗi ngày.</em></h1>
          <p>Chào {snapshot.givenName}. Lộ trình của bạn được giữ đúng thứ tự: học → thực hành → phân tích → ôn tập → kiểm tra.</p>
          <div className={styles.heroActions}>
            <button className={styles.goldButton} onClick={clickContinue}>Tiếp tục học <span>→</span></button>
            <button className={styles.ghostButton} onClick={() => window.location.assign("/phan-tich-video")}><Icon name="video"/> Phân tích video</button>
          </div>
          <div className={styles.heroMotto}><i/> KỶ LUẬT · KỸ THUẬT · TIẾN BỘ · TỰ TIN</div>
        </div>
        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.swimmerGlow}/>
          <div className={styles.waterLines}><i/><i/><i/><i/></div>
          <div className={styles.heroSeal}><span>Bơi ếch</span><strong>AI</strong><small>HỌC VIÊN</small></div>
        </div>
      </section>

      <div className={styles.dashboardGrid}>
        <main className={styles.primaryColumn}>
          <section className={styles.overviewPanel}>
            <header><div><span>Tổng quan học tập</span><h2>Hành trình của {snapshot.givenName}</h2></div><small>{snapshot.onlineLabel}</small></header>
            <div className={styles.metrics}>
              <article><Icon name="book"/><div><strong>{snapshot.completed}/8</strong><span>Bài đã đạt</span><small>{8 - snapshot.completed > 0 ? `Còn ${8 - snapshot.completed} bài trong lộ trình` : "Đã hoàn thành lộ trình"}</small></div></article>
              <article><MetricRing value={snapshot.coursePercent} label="Toàn khóa"/><div><strong>{snapshot.coursePercent}%</strong><span>Tiến độ toàn khóa</span><small>{unlocked}/8 bài hiện có thể mở</small></div></article>
              <article><Icon name="target"/><div><strong>{snapshot.currentLessonPercent}%</strong><span>Bài đang học</span><small>Bài {snapshot.nextLessonNumber} · {nextLesson?.status ?? "Đang tiếp tục"}</small></div></article>
              <article><Icon name="shield"/><div><strong>8/10</strong><span>Điều kiện qua bài</span><small>Phải hoàn thành đủ 5 phần</small></div></article>
            </div>
          </section>

          <section className={styles.capabilities}>
            <header><div><span>QUYỀN HẠN HỌC VIÊN</span><h2>Những gì bạn có thể làm</h2></div><p>Chỉ hiển thị các công cụ dành cho Học viên; quyền chỉnh sửa và quản trị không xuất hiện ở giao diện này.</p></header>
            <div className={styles.capabilityGrid}>
              {capabilities.map((item) => <button key={item.title} onClick={item.action}><span><Icon name={item.icon}/></span><strong>{item.title}</strong><p>{item.text}</p><em>Mở →</em></button>)}
            </div>
          </section>

          <section className={styles.videoPanel}>
            <div className={styles.videoIntro}>
              <span>PHÂN TÍCH VIDEO · LOCAL-FIRST</span>
              <h2>Đưa video bơi của bạn vào AI — nhưng video gốc vẫn ở trên máy.</h2>
              <p>Camera Guidance kiểm tra góc quay trước; Unified Trust và Evidence Trace giúp bạn hiểu mức tin cậy, mốc bằng chứng và bài tập nên ưu tiên.</p>
              <div className={styles.videoBadges}><b>Preflight</b><b>5 pha</b><b>Đối xứng</b><b>Evidence</b><b>Coaching</b></div>
              <button onClick={() => window.location.assign("/phan-tich-video")}><Icon name="upload"/> Chọn video để phân tích <span>→</span></button>
            </div>
            <div className={styles.videoStatus}>
              <div className={styles.videoWindow}><Icon name="video"/><strong>Sẵn sàng phân tích</strong><small>MP4/MOV · tối đa 30 giây / 50 MB theo engine hiện tại</small></div>
              <div className={styles.videoTrust}>
                <article><Icon name="shield"/><div><span>Mức tin cậy chung</span><strong>Được tính sau khi phân tích</strong></div></article>
                <article><Icon name="target"/><div><span>Gợi ý sửa lỗi</span><strong>Chỉ ưu tiên khi bằng chứng đủ dùng</strong></div></article>
              </div>
            </div>
          </section>

          <section className={styles.roadmap} id="learner-roadmap">
            <header><div><span>LỘ TRÌNH 8 BÀI</span><h2>Học tuần tự, không có đường tắt</h2></div><button onClick={clickContinue}>Tiếp tục Bài {snapshot.nextLessonNumber} →</button></header>
            <div className={styles.lessonGrid}>
              {snapshot.lessons.map((lesson) => (
                <button key={lesson.number} disabled={lesson.locked} className={`${lesson.locked ? styles.lessonLocked : ""} ${lesson.number === snapshot.nextLessonNumber ? styles.lessonCurrent : ""}`} onClick={() => openLesson(lesson.number)}>
                  <div><span>BÀI {lesson.number}</span><small>{lesson.status}</small></div>
                  <strong>{lesson.title}</strong>
                  <p>{lesson.detail}</p>
                  <footer><i className={lesson.locked ? "" : styles.lessonReady}/><span>{lesson.locked ? "Chưa mở" : lesson.number === snapshot.nextLessonNumber ? "Tiếp tục học" : "Mở bài"}</span><b>{lesson.locked ? "—" : "→"}</b></footer>
                </button>
              ))}
            </div>
          </section>
        </main>

        <aside className={styles.rightColumn}>
          <section className={styles.todayCard}>
            <header><div><Icon name="target"/><strong>Mục tiêu hôm nay</strong></div><span>3 bước</span></header>
            <ol>
              <li><i>1</i><div><strong>Tiếp tục {snapshot.nextStep}</strong><span>Bài {snapshot.nextLessonNumber}: {snapshot.nextLessonTitle}</span></div></li>
              <li><i>2</i><div><strong>Thực hành có kiểm soát</strong><span>Chỉ tăng quãng khi cuối quãng vẫn giữ được kỹ thuật.</span></div></li>
              <li><i>3</i><div><strong>Quay một clip ngắn để đối chiếu</strong><span>Dùng Camera Guidance trước khi phân tích đầy đủ.</span></div></li>
            </ol>
            <button onClick={clickContinue}>Bắt đầu bước tiếp theo →</button>
          </section>

          <section className={styles.nextCard}>
            <span>VIỆC HỌC TIẾP THEO</span>
            <div className={styles.nextLessonBadge}>Bài {snapshot.nextLessonNumber}</div>
            <h3>{snapshot.nextLessonTitle}</h3>
            <strong>{snapshot.nextStep}</strong>
            <p>{snapshot.nextCheckpoint}</p>
            <div className={styles.progressLine}><i style={{ width: `${snapshot.currentLessonPercent}%` }}/></div>
            <small>{snapshot.currentLessonPercent}% của bài đang học</small>
          </section>

          <section className={styles.profileCard} id="learner-profile">
            <header><Icon name="profile"/><div><span>HỒ SƠ HỌC VIÊN</span><strong>{snapshot.fullName}</strong></div></header>
            <dl><div><dt>Vai trò</dt><dd>Học viên</dd></div><div><dt>Mã học viên</dt><dd>{snapshot.personCode}</dd></div><div><dt>Quyền truy cập</dt><dd>{snapshot.payment}</dd></div><div><dt>Phạm vi</dt><dd>Học · thực hành · AI · kiểm tra · kết quả</dd></div></dl>
            <p>Quyền chỉnh sửa nội dung, duyệt học viên và quản trị hệ thống không được cấp cho tài khoản Học viên.</p>
          </section>

          <section className={styles.motivationCard}>
            <Icon name="spark"/>
            <blockquote>“Mỗi buổi chỉ cần đúng hơn ở một điểm. Kỹ thuật ổn định trước, tốc độ sẽ đến sau.”</blockquote>
            <small>— Bơi ếch AI</small>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function LearnerRoleUI() {
  const [snapshot, setSnapshot] = useState<LearnerSnapshot | null>(null);
  const [navHost, setNavHost] = useState<HTMLElement | null>(null);
  const [overviewHost, setOverviewHost] = useState<HTMLElement | null>(null);
  const signatureRef = useRef("");
  const navRef = useRef<HTMLElement | null>(null);
  const overviewRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let timer = 0;
    const sync = () => {
      timer = 0;
      const next = readSnapshot();
      const shell = document.querySelector<HTMLElement>(".app-shell");
      const nav = document.querySelector<HTMLElement>(".sidebar nav");
      const overview = document.querySelector<HTMLElement>(".page-overview");

      const learner = Boolean(next);
      shell?.classList.toggle("learner-role-active", learner);

      if (navRef.current && navRef.current !== nav) navRef.current.classList.remove("learner-nav-host");
      if (overviewRef.current && overviewRef.current !== overview) overviewRef.current.classList.remove("learner-overview-host");

      if (learner && nav) nav.classList.add("learner-nav-host");
      else nav?.classList.remove("learner-nav-host");
      if (learner && overview) overview.classList.add("learner-overview-host");
      else overview?.classList.remove("learner-overview-host");

      navRef.current = learner ? nav : null;
      overviewRef.current = learner ? overview : null;
      setNavHost(learner ? nav : null);
      setOverviewHost(learner ? overview : null);

      if (!next) {
        signatureRef.current = "";
        setSnapshot(null);
        return;
      }
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
    const observer = new MutationObserver((mutations) => {
      if (mutations.length && mutations.every((mutation) => mutation.target instanceof Element && mutation.target.closest("[data-learner-role-ui]"))) return;
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "title"] });

    return () => {
      if (timer) window.clearTimeout(timer);
      observer.disconnect();
      document.querySelector(".app-shell")?.classList.remove("learner-role-active");
      navRef.current?.classList.remove("learner-nav-host");
      overviewRef.current?.classList.remove("learner-overview-host");
    };
  }, []);

  if (!snapshot) return null;
  return (
    <>
      {navHost ? createPortal(<StudentNavigation snapshot={snapshot}/>, navHost) : null}
      {overviewHost ? createPortal(<LearnerDashboard snapshot={snapshot}/>, overviewHost) : null}
    </>
  );
}
