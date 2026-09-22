"use client";

import { useMemo, useState } from "react";

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

type MessageFilter = "all" | TeacherLearnerReply["actionType"];

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
  const [filter, setFilter] = useState<MessageFilter>("all");
  const [query, setQuery] = useState("");
  const counts = useMemo(() => messages.reduce((sum, item) => {
    sum[item.actionType] = (sum[item.actionType] ?? 0) + 1;
    return sum;
  }, {} as Record<TeacherLearnerReply["actionType"], number>), [messages]);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    return messages
      .filter((item) => filter === "all" || item.actionType === filter)
      .filter((item) => !needle || [item.learnerName, item.personCode, item.className, item.message, item.lessonNumber].join(" ").toLocaleLowerCase("vi").includes(needle))
      .slice(0, 50);
  }, [filter, messages, query]);

  const filters: Array<[MessageFilter, string]> = [
    ["all", `Tất cả (${messages.length})`],
    ["feedback", `Nhận xét (${counts.feedback ?? 0})`],
    ["assignment", `Bài luyện (${counts.assignment ?? 0})`],
    ["review", `Review AI (${counts.review ?? 0})`],
  ];

  return (
    <section className="teacher-two-way-messages" aria-label="Phản hồi hai chiều với học viên">
      <header>
        <div>
          <span>PHẢN HỒI HAI CHIỀU</span>
          <h2>Hộp thư phản hồi của lớp</h2>
          <p>Mỗi phản hồi vẫn gắn với đúng hướng dẫn gốc; bộ lọc mới chỉ tổ chức dữ liệu để Giảng viên xử lý nhanh hơn.</p>
        </div>
        <strong>{messages.length} phản hồi</strong>
      </header>
      <div className="teacher-message-toolbar-v37">
        <div className="teacher-message-filters-v37" aria-label="Lọc loại phản hồi">
          {filters.map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm học viên hoặc nội dung phản hồi…" aria-label="Tìm trong phản hồi học viên" />
      </div>
      <div className="teacher-message-list">
        {visible.map((item) => (
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
        {!messages.length ? <div className="teacher-message-empty"><strong>Chưa có phản hồi mới từ học viên</strong><p>Khi học viên trả lời một nhận xét, bài luyện hoặc review AI, nội dung sẽ xuất hiện ở đây.</p></div> : null}
        {messages.length > 0 && !visible.length ? <div className="teacher-message-empty"><strong>Không có phản hồi phù hợp</strong><p>Thử đổi bộ lọc hoặc từ khóa để xem các phản hồi khác trong lớp.</p></div> : null}
      </div>
    </section>
  );
}
