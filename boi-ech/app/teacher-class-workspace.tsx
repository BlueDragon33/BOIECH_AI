"use client";

import { useEffect, useMemo, useState } from "react";

type TeacherClassLearner = {
  name: string;
  personCode: string;
  className: string;
  progress: number;
  analysisCount: number;
  needsSupport: boolean;
  inactiveDays: number | null;
  lastActivityAt: string | null;
  lastLesson: string | null;
};

type TeacherClassAssignment = {
  id: number;
  learnerName: string;
  personCode: string;
  className: string;
  lessonNumber: string;
  title: string;
  note: string;
  dueAt: string;
  status: "" | "acknowledged" | "completed" | "needs-help";
  scheduleState: "open" | "upcoming" | "acknowledged" | "completed" | "needs-help" | "overdue";
};

type TeacherClassFilter = "all" | "attention" | "active" | "empty";
type TeacherClassSort = "attention" | "progress" | "recent" | "name";

type TeacherClassWorkspaceProps = {
  classes: string[];
  learners: TeacherClassLearner[];
  assignments: TeacherClassAssignment[];
  selectedClass: string;
  onSelectedClassChange: (className: string) => void;
  onOpenLearners: (className: string) => void;
  onOpenTasks: (className: string) => void;
  onOpenReports: (className: string) => void;
  onOpenAnalysis: (className: string) => void;
  onOpenEditor: (className: string) => void;
};

function shortActivity(value: string | null) {
  if (!value) return "Chưa có hoạt động";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Chưa có hoạt động";
  const days = Math.floor(Math.max(0, Date.now() - time) / 86_400_000);
  if (days === 0) return "Hoạt động hôm nay";
  if (days === 1) return "Hoạt động hôm qua";
  return "Hoạt động " + days + " ngày trước";
}

function shortDue(value: string) {
  if (!value) return "Không đặt hạn";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Không đặt hạn"
    : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function assignmentState(value: TeacherClassAssignment["scheduleState"]) {
  if (value === "completed") return "Đã hoàn thành";
  if (value === "needs-help") return "Cần hỗ trợ";
  if (value === "overdue") return "Quá hạn";
  if (value === "acknowledged") return "Đã nhận";
  if (value === "upcoming") return "Sắp tới";
  return "Đang mở";
}

function classStats(name: string, learners: TeacherClassLearner[]) {
  const rows = learners.filter((item) => item.className.trim().toLocaleLowerCase("vi") === name.trim().toLocaleLowerCase("vi"));
  const active7d = rows.filter((item) => item.inactiveDays !== null && item.inactiveDays < 7).length;
  const averageProgress = rows.length ? Math.round(rows.reduce((sum, item) => sum + item.progress, 0) / rows.length) : 0;
  const support = rows.filter((item) => item.needsSupport).length;
  const analyses = rows.reduce((sum, item) => sum + item.analysisCount, 0);
  const lastActivityAt = rows.map((item) => item.lastActivityAt).filter(Boolean).sort().at(-1) ?? null;
  return { name, learners: rows, active7d, averageProgress, support, analyses, lastActivityAt };
}

export default function TeacherClassWorkspace({
  classes,
  learners,
  assignments,
  selectedClass,
  onSelectedClassChange,
  onOpenLearners,
  onOpenTasks,
  onOpenReports,
  onOpenAnalysis,
  onOpenEditor,
}: TeacherClassWorkspaceProps) {
  const summaries = useMemo(() => {
    const assigned = classes.length ? classes : [...new Set(learners.map((item) => item.className).filter(Boolean))];
    return assigned.map((name) => classStats(name, learners));
  }, [classes, learners]);

  const [classQuery, setClassQuery] = useState("");
  const [classFilter, setClassFilter] = useState<TeacherClassFilter>("all");
  const [classSort, setClassSort] = useState<TeacherClassSort>("attention");

  const attentionCount = summaries.filter((item) => item.support > 0).length;
  const activeCount = summaries.filter((item) => item.learners.length > 0).length;
  const emptyCount = summaries.filter((item) => item.learners.length === 0).length;

  const visibleSummaries = useMemo(() => {
    const needle = classQuery.trim().toLocaleLowerCase("vi");
    const filtered = summaries.filter((item) => {
      if (needle && !item.name.toLocaleLowerCase("vi").includes(needle)) return false;
      if (classFilter === "attention") return item.support > 0;
      if (classFilter === "active") return item.learners.length > 0;
      if (classFilter === "empty") return item.learners.length === 0;
      return true;
    });
    return [...filtered].sort((left, right) => {
      if (classSort === "progress") return left.averageProgress - right.averageProgress || left.name.localeCompare(right.name, "vi");
      if (classSort === "recent") return (Date.parse(right.lastActivityAt ?? "") || 0) - (Date.parse(left.lastActivityAt ?? "") || 0) || left.name.localeCompare(right.name, "vi");
      if (classSort === "name") return left.name.localeCompare(right.name, "vi");
      return right.support - left.support || left.averageProgress - right.averageProgress || left.name.localeCompare(right.name, "vi");
    });
  }, [classFilter, classQuery, classSort, summaries]);

  const selected = summaries.find((item) => item.name === selectedClass) ?? summaries[0] ?? null;
  useEffect(() => {
    if (selected && selected.name !== selectedClass) onSelectedClassChange(selected.name);
  }, [onSelectedClassChange, selected, selectedClass]);

  const totalLearners = summaries.reduce((sum, item) => sum + item.learners.length, 0);
  const totalSupport = summaries.reduce((sum, item) => sum + item.support, 0);
  const supportLearners = selected?.learners.filter((item) => item.needsSupport).slice(0, 4) ?? [];
  const selectedAssignments = useMemo(() => {
    if (!selected) return [];
    const key = selected.name.trim().toLocaleLowerCase("vi");
    return assignments
      .filter((item) => item.className.trim().toLocaleLowerCase("vi") === key)
      .sort((left, right) => {
        const leftTime = Date.parse(left.dueAt || "") || Number.MAX_SAFE_INTEGER;
        const rightTime = Date.parse(right.dueAt || "") || Number.MAX_SAFE_INTEGER;
        return leftTime - rightTime || right.id - left.id;
      })
      .slice(0, 4);
  }, [assignments, selected]);

  return <section className="teacher-class-control-center teacher-reference-v36">
    <header className="teacher-class-control-header">
      <div>
        <span>LỚP HỌC CỦA TÔI</span>
        <h1>Lớp học của tôi</h1>
        <p>Quản lý nhiều lớp học, theo dõi tiến độ và xử lý đúng lớp đang phụ trách.</p>
        <small>{summaries.length} lớp · {totalLearners} học viên · {totalSupport} cần hỗ trợ</small>
        <span data-teacher-sync-mount="class"/>
      </div>
      <div className="teacher-class-header-actions">
        <button type="button" onClick={() => onOpenEditor(selected?.name ?? "")}>Biên tập bài giảng</button>
        <button type="button" onClick={() => onOpenReports(selected?.name ?? "")}>Báo cáo tổng hợp</button>
      </div>
    </header>

    <section className="teacher-class-control-toolbar" aria-label="Tìm kiếm và lọc lớp học">
      <div className="teacher-class-filter-tabs">
        <button type="button" className={classFilter === "all" ? "active" : ""} aria-pressed={classFilter === "all"} onClick={() => setClassFilter("all")}>Tất cả lớp <b>{summaries.length}</b></button>
        <button type="button" className={classFilter === "attention" ? "active" : ""} aria-pressed={classFilter === "attention"} onClick={() => setClassFilter("attention")}>Cần chú ý <b>{attentionCount}</b></button>
        <button type="button" className={classFilter === "active" ? "active" : ""} aria-pressed={classFilter === "active"} onClick={() => setClassFilter("active")}>Có học viên <b>{activeCount}</b></button>
        <button type="button" className={classFilter === "empty" ? "active" : ""} aria-pressed={classFilter === "empty"} onClick={() => setClassFilter("empty")}>Chưa có học viên <b>{emptyCount}</b></button>
      </div>
      <div className="teacher-class-tools">
        <label className="teacher-class-search"><span aria-hidden="true">⌕</span><input value={classQuery} onChange={(event) => setClassQuery(event.target.value.slice(0, 80))} placeholder="Tìm lớp học…" aria-label="Tìm lớp học"/></label>
        <label className="teacher-class-sort"><span>Sắp xếp</span><select value={classSort} onChange={(event) => setClassSort(event.target.value as TeacherClassSort)} aria-label="Sắp xếp lớp học"><option value="attention">Ưu tiên can thiệp</option><option value="progress">Tiến độ thấp trước</option><option value="recent">Hoạt động gần nhất</option><option value="name">Tên A–Z</option></select></label>
      </div>
    </section>

    <div className="teacher-class-stage">
      <main className="teacher-class-stage-main">
        <div className="teacher-class-stage-heading">
          <span>Hiển thị {visibleSummaries.length}/{summaries.length} lớp</span>
          <small>Chọn một lớp để giữ đúng ngữ cảnh khi mở học viên, bài tập, báo cáo hoặc video AI.</small>
        </div>
        <div className="teacher-class-card-grid" role="list" aria-label="Các lớp được phân công">
          {visibleSummaries.map((item) => {
            const active = item.name === selected?.name;
            const status = item.support > 0 ? "Cần chú ý" : item.learners.length === 0 ? "Chưa có học viên" : "Đang theo dõi";
            return <article key={item.name} role="listitem" className={active ? "active" : ""} data-selected={active ? "true" : "false"}>
              <header>
                <em data-tone={item.support > 0 ? "warn" : item.learners.length ? "ok" : "idle"}>{status}</em>
                <small>{shortActivity(item.lastActivityAt)}</small>
              </header>
              <div className="teacher-class-card-title">
                <span className="teacher-class-card-icon">▦</span>
                <div><strong>{item.name}</strong><small>{item.learners.length ? "Lớp đang được giám sát" : "Chờ học viên được duyệt"}</small></div>
              </div>
              <dl>
                <div><dt>Sĩ số</dt><dd>{item.learners.length}</dd></div>
                <div><dt>Hoạt động 7 ngày</dt><dd>{item.active7d}</dd></div>
                <div><dt>Tiến độ TB</dt><dd>{item.averageProgress}%</dd></div>
                <div><dt>Cần hỗ trợ</dt><dd>{item.support}</dd></div>
              </dl>
              <span className="teacher-class-card-progress" aria-label={"Tiến độ trung bình " + item.averageProgress + "%"}><i style={{ width: String(item.averageProgress) + "%" }}/></span>
              <div className="teacher-class-card-actions">
                <button type="button" className="primary" onClick={() => { onSelectedClassChange(item.name); onOpenLearners(item.name); }}>Mở lớp →</button>
                <button type="button" onClick={() => { onSelectedClassChange(item.name); onOpenTasks(item.name); }}>Bài tập</button>
                <button type="button" onClick={() => { onSelectedClassChange(item.name); onOpenReports(item.name); }}>Báo cáo</button>
                <button type="button" onClick={() => { onSelectedClassChange(item.name); onOpenAnalysis(item.name); }}>Video AI</button>
              </div>
              <button type="button" className="teacher-class-card-editor" onClick={() => { onSelectedClassChange(item.name); onOpenEditor(item.name); }}>✎ Biên tập nội dung bài giảng <span>›</span></button>
            </article>;
          })}
          {!summaries.length ? <div className="teacher-class-empty">Chưa có lớp nào được phân. Quản trị cần cập nhật “Lớp Giảng viên phụ trách” trong quản lý thiết bị.</div> : null}
          {summaries.length > 0 && visibleSummaries.length === 0 ? <div className="teacher-class-empty">Không có lớp phù hợp với bộ lọc hiện tại. Hãy đổi trạng thái lọc hoặc từ khóa tìm kiếm.</div> : null}
        </div>
      </main>

      <aside className="teacher-class-reference-rail">
        <section className="teacher-class-rail-card">
          <header><div><span className="rail-icon warn">!</span><strong>Cảnh báo nhanh</strong></div>{selected ? <button type="button" onClick={() => onOpenLearners(selected.name)}>Xem lớp</button> : null}</header>
          {selected ? <p className="rail-context">{selected.name}</p> : null}
          <div className="teacher-class-alert-items">
            {supportLearners.map((learner) => <button key={learner.personCode || learner.name} type="button" onClick={() => onOpenLearners(selected?.name ?? learner.className)}>
              <span>{learner.name.slice(0,1).toUpperCase()}</span>
              <div><strong>{learner.name}</strong><small>{learner.progress}% tiến độ · cần hỗ trợ</small></div>
              <b>›</b>
            </button>)}
            {selected && supportLearners.length === 0 ? <div className="teacher-class-rail-empty">✓ Chưa có học viên vượt ngưỡng cảnh báo trong lớp này.</div> : null}
            {!selected ? <div className="teacher-class-rail-empty">Chưa có lớp để hiển thị cảnh báo.</div> : null}
          </div>
        </section>

        <section className="teacher-class-rail-card">
          <header><div><span className="rail-icon schedule">□</span><strong>Lịch nhiệm vụ</strong></div>{selected ? <button type="button" onClick={() => onOpenTasks(selected.name)}>Xem tất cả</button> : null}</header>
          <div className="teacher-class-assignment-items">
            {selectedAssignments.map((item) => <button key={item.id} type="button" onClick={() => onOpenTasks(selected?.name ?? item.className)}>
              <span>{shortDue(item.dueAt)}</span>
              <div><strong>{item.title || "Bài luyện được giao"}</strong><small>{item.learnerName} · {assignmentState(item.scheduleState)}</small></div>
              <b>›</b>
            </button>)}
            {selected && selectedAssignments.length === 0 ? <div className="teacher-class-rail-empty">Chưa có nhiệm vụ được giao cho lớp đang chọn.</div> : null}
          </div>
        </section>

        <section className="teacher-class-rail-card teacher-class-action-rail">
          <header><div><span className="rail-icon action">✓</span><strong>Việc cần xử lý</strong></div></header>
          {selected ? <div className="teacher-class-action-items">
            <button type="button" onClick={() => onOpenEditor(selected.name)}><span>Biên tập nội dung bài giảng</span><b>›</b></button>
            <button type="button" onClick={() => onOpenLearners(selected.name)}><span>Học viên cần hỗ trợ</span><em>{selected.support}</em></button>
            <button type="button" onClick={() => onOpenAnalysis(selected.name)}><span>Kết quả phân tích video</span><em>{selected.analyses}</em></button>
            <button type="button" onClick={() => onOpenReports(selected.name)}><span>Báo cáo lớp</span><b>›</b></button>
          </div> : <div className="teacher-class-rail-empty">Chọn một lớp để mở tác vụ đúng phạm vi.</div>}
        </section>
      </aside>
    </div>
  </section>;
}
