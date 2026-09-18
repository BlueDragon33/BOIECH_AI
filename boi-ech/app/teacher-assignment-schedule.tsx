"use client";

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

export default function TeacherAssignmentSchedule({
  assignments,
  onOpen,
}: {
  assignments: TeacherAssignmentScheduleItem[];
  onOpen: (personCode: string) => void;
}) {
  const counts = assignments.reduce((sum, item) => {
    sum[item.scheduleState] = (sum[item.scheduleState] ?? 0) + 1;
    return sum;
  }, {} as Record<string, number>);

  return (
    <section className="teacher-assignment-schedule" aria-label="Lịch bài luyện">
      <header>
        <div><span>LỊCH NHIỆM VỤ</span><h2>Bài luyện có hạn và trạng thái thực tế</h2><p>Dữ liệu được lấy từ assignment Giảng viên đã gửi và trạng thái do chính Học viên xác nhận.</p></div>
        <div><strong>{counts.overdue ?? 0}</strong><span>Quá hạn</span><strong>{counts["needs-help"] ?? 0}</strong><span>Cần hỗ trợ</span></div>
      </header>
      <div className="teacher-schedule-items">
        {assignments.map((item) => (
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
        {assignments.length === 0 ? <div className="teacher-schedule-empty"><strong>Chưa có bài luyện đã giao</strong><p>Khi Giảng viên giao bài, nhiệm vụ sẽ xuất hiện ở đây kể cả khi không đặt hạn.</p></div> : null}
      </div>
    </section>
  );
}
