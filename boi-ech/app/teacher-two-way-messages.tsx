"use client";

export type TeacherLearnerReply = {
  id: number;
  learnerName: string;
  personCode: string;
  className: string;
  actionId: number;
  actionType: "feedback" | "assignment" | "review";
  lessonNumber: string;
  message: string;
  actionCreatedAt: string;
  createdAt: string;
};

function when(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function actionLabel(value: TeacherLearnerReply["actionType"]) {
  return value === "assignment" ? "Bài luyện"
    : value === "review" ? "Review AI"
      : "Nhận xét";
}

export default function TeacherTwoWayMessages({
  messages,
  onReply,
}: {
  messages: TeacherLearnerReply[];
  onReply: (personCode: string) => void;
}) {
  return (
    <section className="teacher-two-way-messages" aria-label="Phản hồi hai chiều với học viên">
      <header>
        <div>
          <span>PHẢN HỒI HAI CHIỀU</span>
          <h2>Học viên đã phản hồi hướng dẫn</h2>
          <p>Mỗi phản hồi gắn với một hướng dẫn cụ thể; Giảng viên có thể mở hồ sơ để tiếp tục nhận xét hoặc giao nhiệm vụ mới.</p>
        </div>
        <strong>{messages.length} phản hồi</strong>
      </header>
      <div className="teacher-message-list">
        {messages.slice(0, 50).map((item) => (
          <article key={item.id}>
            <header>
              <div>
                <span>{item.learnerName.slice(0,1).toUpperCase()}</span>
                <div><strong>{item.learnerName}</strong><small>{item.className} · {when(item.createdAt)}</small></div>
              </div>
              <b>{actionLabel(item.actionType)}{item.lessonNumber ? ` · Bài ${item.lessonNumber}` : ""}</b>
            </header>
            <blockquote>{item.message}</blockquote>
            <footer>
              <span>Phản hồi cho hướng dẫn #{item.actionId}</span>
              <button type="button" onClick={() => onReply(item.personCode)}>Trả lời bằng nhận xét →</button>
            </footer>
          </article>
        ))}
        {messages.length === 0 ? <div className="teacher-message-empty"><strong>Chưa có phản hồi mới từ học viên</strong><p>Khi học viên trả lời một nhận xét, bài luyện hoặc review AI, nội dung sẽ xuất hiện ở đây.</p></div> : null}
      </div>
    </section>
  );
}
