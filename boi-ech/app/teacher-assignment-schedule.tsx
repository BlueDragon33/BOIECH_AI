"use client";

import { useMemo, useState } from "react";

export type TeacherAssignmentScheduleItem = {
  id: number;
  learnerName: string;
  personCode: string;
  className: string;
  lessonNumber: string;
  title: string;
  note: string;
  dueAt: string;
  createdAt: string;
  status: "" | "acknowledged" | "completed" | "needs-help";
  statusAt: string;
  scheduleState: "open" | "upcoming" | "acknowledged" | "completed" | "needs-help" | "overdue";
};

type ScheduleFilter = "all" | "active" | "overdue" | "needs-help" | "completed";

function when(value: string) {
  if (!value) return "Không đặt hạn";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Không đặt hạn" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function stateLabel(value: TeacherAssignmentScheduleItem["scheduleState"]) {
  if (value === "completed") return "Đã hoàn thành";
  if (value === "needs-help") return "Cần hỗ trợ";
  if (value === "overdue") return "Quá hạn";
  if (value === "acknowledged") return "Đã nhận";
  if (value === "upcoming") return "Đang chờ";
  return "Đang mở";
}

function matchesFilter(item: TeacherAssignmentScheduleItem, filter: ScheduleFilter) {
  if (filter === "all") return true;
  if (filter === "active") return item.scheduleState === "open" || item.scheduleState === "upcoming" || item.scheduleState === "acknowledged";
  return item.scheduleState === filter;
}

export default function TeacherAssignmentSchedule({
  assignments,
  onOpen,
}: {
  assignments: TeacherAssignmentScheduleItem[];
  onOpen: (personCode: string) => void;
}) {
  const [filter, setFilter] = useState<ScheduleFilter>("all");
  const [query, setQuery] = useState("");
  const counts = useMemo(() => assignments.reduce((sum, item) => {
    sum[item.scheduleState] = (sum[item.scheduleState] ?? 0) + 1;
    return sum;
  }, {} as Record<string, number>), [assignments]);
  const activeCount = (counts.open ?? 0) + (counts.upcoming ?? 0) + (counts.acknowledged ?? 0);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    return assignments
      .filter((item) => matchesFilter(item, filter))
      .filter((item) => !needle || [item.learnerName, item.personCode, item.className, item.title, item.note, item.lessonNumber].join(" ").toLocaleLowerCase("vi").includes(needle));
  }, [assignments, filter, query]);

  const filters: Array<[ScheduleFilter, string]> = [
    ["all", `Tất cả (${assignments.length})`],
    ["active", `Đang thực hiện (${activeCount})`],
    ["overdue", `Quá hạn (${counts.overdue ?? 0})`],
    ["needs-help", `Cần hỗ trợ (${counts["needs-help"] ?? 0})`],
    ["completed", `Hoàn thành (${counts.completed ?? 0})`],
  ];

  return (
    <section className="teacher-assignment-schedule" aria-label="Lịch bài luyện">
      <header>
        <div><span>LỊCH NHIỆM VỤ</span><h2>Tiến độ bài luyện theo trạng thái thực tế</h2><p>Dữ liệu vẫn lấy từ assignment Giảng viên đã gửi và trạng thái Học viên xác nhận; giao diện mới ưu tiên việc phát hiện việc quá hạn hoặc cần hỗ trợ.</p></div>
        <div><strong>{counts.overdue ?? 0}</strong><span>Quá hạn</span><strong>{counts["needs-help"] ?? 0}</strong><span>Cần hỗ trợ</span></div>
      </header>
      <div className="teacher-schedule-summary-v37">
        <div><strong>{assignments.length}</strong><span>Tổng nhiệm vụ</span></div>
        <div className="danger"><strong>{counts.overdue ?? 0}</strong><span>Quá hạn</span></div>
        <div className="warn"><strong>{counts["needs-help"] ?? 0}</strong><span>Cần hỗ trợ</span></div>
        <div className="good"><strong>{counts.completed ?? 0}</strong><span>Đã hoàn thành</span></div>
      </div>
      <div className="teacher-schedule-toolbar-v37">
        <div className="teacher-schedule-filters-v37" aria-label="Lọc trạng thái nhiệm vụ">
          {filters.map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm học viên, bài hoặc ghi chú…" aria-label="Tìm trong lịch nhiệm vụ" />
      </div>
      <div className="teacher-schedule-items">
        {visible.map((item) => (
          <article key={item.id} className={item.scheduleState}>
            <span className="teacher-schedule-date">{item.dueAt ? when(item.dueAt) : "Không hạn"}</span>
            <div>
              <small>BÀI {item.lessonNumber || "—"} · {item.className}</small>
              <strong>{item.learnerName}</strong>
              <h3>{item.title || "Bài luyện được giao"}</h3>
              <p>{item.note}</p>
            </div>
            <aside>
              <b>{stateLabel(item.scheduleState)}</b>
              <button type="button" onClick={() => onOpen(item.personCode)}>Mở học viên →</button>
            </aside>
          </article>
        ))}
        {!assignments.length ? <div className="teacher-schedule-empty"><strong>Chưa có bài luyện đã giao</strong><p>Khi Giảng viên giao bài, nhiệm vụ sẽ xuất hiện ở đây kể cả khi không đặt hạn.</p></div> : null}
        {assignments.length > 0 && !visible.length ? <div className="teacher-schedule-empty"><strong>Không có nhiệm vụ phù hợp</strong><p>Thử đổi trạng thái hoặc từ khóa để xem các nhiệm vụ khác.</p></div> : null}
      </div>
    </section>
  );
}
