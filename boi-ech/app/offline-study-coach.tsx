"use client";

import { useState } from "react";

export type OfflineStudyStats = {
  totalSeconds: number;
  todaySeconds: number;
  offlineSeconds: number;
  sessionSeconds: number;
  lastStudyAt: string | null;
  reminderEnabled: boolean;
  reminderMinutes: number;
  lastReminderAt: string | null;
};

function minutes(seconds: number) {
  return Math.max(0, Math.floor(seconds / 60));
}

function time(value: string | null) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date)
    : "Chưa có";
}

function coachMessage(learnerName: string, completion: number, todaySeconds: number, sessionSeconds: number, online: boolean, pendingSyncCount: number) {
  if (!online && pendingSyncCount > 0) return `${learnerName}, dữ liệu học đang được giữ an toàn trên thiết bị và sẽ tự gửi khi có mạng.`;
  if (completion >= 100) return `${learnerName} đã hoàn tất lộ trình. Hãy duy trì một buổi ôn ngắn mỗi tuần.`;
  if (todaySeconds < 10 * 60) return `${learnerName}, hôm nay hãy học thêm ${Math.max(1, 10 - minutes(todaySeconds))} phút để giữ nhịp.`;
  if (sessionSeconds >= 25 * 60) return `${learnerName} đã tập trung tốt. Nên nghỉ ngắn, uống nước rồi mới tiếp tục.`;
  return `${learnerName} đang giữ nhịp tốt. Hoàn thành đúng phần đang mở trước khi chuyển bài.`;
}

function focusState(sessionSeconds: number) {
  if (sessionSeconds >= 25 * 60) return "Nên nghỉ 3–5 phút";
  if (sessionSeconds >= 10 * 60) return "Nhịp học ổn định";
  return "Đang khởi động";
}

export default function OfflineStudyCoach({ learnerName, online, pendingSyncCount, completion, nextStep, stats, onSync, onReminderChange }: {
  learnerName: string;
  online: boolean;
  pendingSyncCount: number;
  completion: number;
  nextStep: string;
  stats: OfflineStudyStats;
  onSync: () => void;
  onReminderChange: (enabled: boolean, minutes: number) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  return <aside className={`offline-coach ${online ? "online" : "offline"} ${expanded ? "expanded" : "compact"}`} aria-label="AI offline cục bộ kiểm soát học tập"><header><div><i>✦</i><span>AI offline cục bộ</span></div><b>{online ? pendingSyncCount > 0 ? `${pendingSyncCount} mục chờ` : "Đã đồng bộ" : "Hoạt động offline"}</b><button onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={expanded ? "Thu gọn bảng AI offline" : "Mở bảng AI offline"}>{expanded ? "−" : "+"}</button></header>{expanded ? <div className="offline-coach-body"><p>{coachMessage(learnerName, completion, stats.todaySeconds, stats.sessionSeconds, online, pendingSyncCount)}</p><dl><div><dt>Phiên này</dt><dd>{minutes(stats.sessionSeconds)} phút</dd></div><div><dt>Hôm nay</dt><dd>{minutes(stats.todaySeconds)} phút</dd></div><div><dt>Học khi offline</dt><dd>{minutes(stats.offlineSeconds)} phút</dd></div><div><dt>Chờ đồng bộ</dt><dd>{pendingSyncCount} mục</dd></div></dl><div className="offline-focus"><span>Nhịp tập trung</span><strong>{focusState(stats.sessionSeconds)}</strong><small>Chỉ tính khi trang đang hiển thị và có tương tác gần đây.</small></div><div className="offline-next"><span>Gợi ý tiếp theo</span><strong>{nextStep}</strong><small>Lần học gần nhất: {time(stats.lastStudyAt)}</small></div><label className="offline-reminder"><input type="checkbox" checked={stats.reminderEnabled} onChange={(event) => void onReminderChange(event.target.checked, stats.reminderMinutes)} /><span>Nhắc học khi ứng dụng đang mở</span></label><label className="offline-reminder-time"><span>Nhắc sau</span><select value={stats.reminderMinutes} onChange={(event) => void onReminderChange(stats.reminderEnabled, Number(event.target.value))}><option value={30}>30 phút</option><option value={60}>60 phút</option><option value={90}>90 phút</option><option value={120}>120 phút</option></select></label>{pendingSyncCount > 0 ? <button className="offline-sync" onClick={onSync} disabled={!online}>{online ? `Đồng bộ ${pendingSyncCount} mục ngay` : "Sẽ tự gửi khi có mạng"}</button> : <small className="offline-synced">Dữ liệu đã đồng bộ đầy đủ.</small>}<footer>Luật thích ứng cục bộ · Không camera · Không gửi bản sửa riêng</footer></div> : <div className="offline-coach-summary"><span>{minutes(stats.sessionSeconds)} phút phiên này</span><strong>{focusState(stats.sessionSeconds)}</strong></div>}</aside>;
}
