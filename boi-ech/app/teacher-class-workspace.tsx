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

type TeacherClassWorkspaceProps = {
  classes: string[];
  learners: TeacherClassLearner[];
  onOpenLearner: (learner: TeacherClassLearner) => void;
  onOpenTasks: () => void;
  onOpenReports: () => void;
  onOpenEditor: () => void;
};

function shortActivity(value: string | null) {
  if (!value) return "Chưa có hoạt động";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Chưa có hoạt động";
  const days = Math.floor(Math.max(0, Date.now() - time) / 86_400_000);
  if (days === 0) return "Hoạt động hôm nay";
  if (days === 1) return "Hoạt động hôm qua";
  return `Hoạt động ${days} ngày trước`;
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
  onOpenLearner,
  onOpenTasks,
  onOpenReports,
  onOpenEditor,
}: TeacherClassWorkspaceProps) {
  const summaries = useMemo(() => {
    const assigned = classes.length ? classes : [...new Set(learners.map((item) => item.className).filter(Boolean))];
    return assigned.map((name) => classStats(name, learners));
  }, [classes, learners]);

  const [selectedClass, setSelectedClass] = useState("");
  useEffect(() => {
    if (!summaries.length) {
      setSelectedClass("");
      return;
    }
    if (!summaries.some((item) => item.name === selectedClass)) setSelectedClass(summaries[0].name);
  }, [selectedClass, summaries]);

  const selected = summaries.find((item) => item.name === selectedClass) ?? summaries[0] ?? null;
  const totalLearners = summaries.reduce((sum, item) => sum + item.learners.length, 0);
  const totalSupport = summaries.reduce((sum, item) => sum + item.support, 0);
  const averageProgress = totalLearners
    ? Math.round(summaries.reduce((sum, item) => sum + item.learners.reduce((inside, learner) => inside + learner.progress, 0), 0) / totalLearners)
    : 0;
  const supportLearners = learners.filter((item) => item.needsSupport).slice(0, 5);

  return <section className="teacher-class-control-center">
    <header className="teacher-class-control-header">
      <div><span>LỚP HỌC CỦA TÔI</span><h1>Quản lý nhiều lớp trong một màn hình</h1><p>Chỉ hiển thị các lớp đã được quản trị phân cho Giảng viên. Chọn một lớp để xem học viên, tiến độ, bài tập và cảnh báo.</p></div>
      <div className="teacher-class-header-actions"><button type="button" onClick={onOpenEditor}>Biên tập bài giảng</button><button type="button" onClick={onOpenReports}>Báo cáo tổng hợp</button></div>
    </header>

    <div className="teacher-class-global-metrics">
      <article><span>Lớp phụ trách</span><strong>{summaries.length}</strong><small>Danh sách được phân quyền</small></article>
      <article><span>Học viên</span><strong>{totalLearners}</strong><small>Đã duyệt trong các lớp</small></article>
      <article><span>Tiến độ trung bình</span><strong>{averageProgress}%</strong><small>Theo 8 bài học</small></article>
      <article className={totalSupport ? "warn" : ""}><span>Cần can thiệp</span><strong>{totalSupport}</strong><small>Trên toàn bộ lớp phụ trách</small></article>
    </div>

    <div className="teacher-class-card-grid" role="list" aria-label="Các lớp được phân công">
      {summaries.map((item) => {
        const active = item.name === selected?.name;
        const status = item.support > 0 ? "Cần chú ý" : item.learners.length === 0 ? "Chưa có học viên" : "Đang theo dõi";
        return <button key={item.name} type="button" role="listitem" className={active ? "active" : ""} onClick={() => setSelectedClass(item.name)}>
          <header><div className="teacher-class-card-icon">▦</div><div><strong>{item.name}</strong><small>{shortActivity(item.lastActivityAt)}</small></div><em data-tone={item.support > 0 ? "warn" : "ok"}>{status}</em></header>
          <dl>
            <div><dt>Sĩ số</dt><dd>{item.learners.length}</dd></div>
            <div><dt>7 ngày</dt><dd>{item.active7d}</dd></div>
            <div><dt>Tiến độ</dt><dd>{item.averageProgress}%</dd></div>
            <div><dt>Cần hỗ trợ</dt><dd>{item.support}</dd></div>
          </dl>
          <span className="teacher-class-card-progress"><i style={{ width: `${item.averageProgress}%` }}/></span>
        </button>;
      })}
      {!summaries.length ? <div className="teacher-class-empty">Chưa có lớp nào được phân. Quản trị cần cập nhật “Lớp Giảng viên phụ trách” trong quản lý thiết bị.</div> : null}
    </div>

    {selected ? <div className="teacher-class-detail-grid">
      <section className="teacher-class-detail">
        <header><div><span>LỚP ĐANG CHỌN</span><h2>{selected.name}</h2><p>{selected.learners.length} học viên · {selected.averageProgress}% tiến độ trung bình · {selected.analyses} phân tích AI</p></div><div><button type="button" onClick={onOpenTasks}>Bài tập</button><button type="button" onClick={onOpenReports}>Báo cáo</button></div></header>
        <div className="teacher-class-student-list">
          {selected.learners.map((learner) => <button key={learner.personCode || learner.name} type="button" onClick={() => onOpenLearner(learner)}>
            <span>{learner.name.slice(0,1).toUpperCase()}</span>
            <div><strong>{learner.name}</strong><small>{learner.lastLesson ? `Bài ${learner.lastLesson} · ` : ""}{shortActivity(learner.lastActivityAt)}</small></div>
            <div className="teacher-class-student-progress"><i><b style={{ width: `${learner.progress}%` }}/></i><strong>{learner.progress}%</strong></div>
            <em className={learner.needsSupport ? "warn" : "ok"}>{learner.needsSupport ? "Cần hỗ trợ" : "Ổn"}</em>
          </button>)}
          {!selected.learners.length ? <div className="teacher-class-empty">Lớp này chưa có học viên đã duyệt.</div> : null}
        </div>
      </section>

      <aside className="teacher-class-side">
        <section><header><strong>Cảnh báo nhanh</strong><button type="button" onClick={onOpenTasks}>Xử lý →</button></header>
          {supportLearners.length ? supportLearners.map((learner) => <button key={learner.personCode || learner.name} type="button" onClick={() => onOpenLearner(learner)}><span>!</span><div><strong>{learner.name}</strong><small>{learner.className} · {learner.progress}% tiến độ</small></div></button>) : <p>Không có học viên cần can thiệp trong dữ liệu hiện tại.</p>}
        </section>
        <section className="teacher-class-editor-card"><span>QUẢN LÝ NỘI DUNG</span><strong>Biên tập nội dung bài giảng</strong><p>Mở trình biên tập chuẩn, xin quyền theo bài/phần và quay lại đúng giao diện Giảng viên.</p><button type="button" onClick={onOpenEditor}>Vào trình biên tập →</button></section>
      </aside>
    </div> : null}
  </section>;
}
