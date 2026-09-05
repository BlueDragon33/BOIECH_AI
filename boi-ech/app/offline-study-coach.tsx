"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

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

type CoachPosition = { x: number; y: number };

const BUBBLE_SIZE = 56;
const EDGE_GAP = 12;
const DEFAULT_BOTTOM_GAP = 88;
const POSITION_STORAGE_KEY = "boi-ech-offline-coach-position-v1";

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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function defaultPosition(): CoachPosition {
  return {
    x: Math.max(EDGE_GAP, window.innerWidth - BUBBLE_SIZE - EDGE_GAP),
    y: Math.max(EDGE_GAP, window.innerHeight - BUBBLE_SIZE - DEFAULT_BOTTOM_GAP),
  };
}

function keepInsideViewport(position: CoachPosition, width: number, height: number): CoachPosition {
  return {
    x: clamp(position.x, EDGE_GAP, window.innerWidth - width - EDGE_GAP),
    y: clamp(position.y, EDGE_GAP, window.innerHeight - height - EDGE_GAP),
  };
}

function validPosition(value: unknown): value is CoachPosition {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CoachPosition>;
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y);
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
  const [position, setPosition] = useState<CoachPosition | null>(null);
  const coachRef = useRef<HTMLElement>(null);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: CoachPosition;
    moved: boolean;
  } | null>(null);

  function savePosition(next: CoachPosition) {
    try {
      window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Vị trí chỉ là tùy chọn giao diện; chế độ riêng tư có thể chặn localStorage.
    }
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let initial = defaultPosition();
      try {
        const stored = JSON.parse(window.localStorage.getItem(POSITION_STORAGE_KEY) ?? "null") as unknown;
        if (validPosition(stored)) initial = stored;
      } catch {
        // Dữ liệu vị trí cũ không hợp lệ thì trở về góc mặc định an toàn.
      }
      setPosition(keepInsideViewport(initial, BUBBLE_SIZE, BUBBLE_SIZE));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = coachRef.current;
        if (!element) return;
        const width = expanded ? element.offsetWidth : BUBBLE_SIZE;
        const height = expanded ? element.offsetHeight : BUBBLE_SIZE;
        setPosition((current) => {
          const next = keepInsideViewport(current ?? defaultPosition(), width, height);
          savePosition(next);
          return next;
        });
      });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", fit);
    };
  }, [expanded]);

  function beginDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!position) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: position,
      moved: false,
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 5) drag.moved = true;
    if (!drag.moved) return;
    event.preventDefault();
    setPosition(keepInsideViewport({ x: drag.origin.x + deltaX, y: drag.origin.y + deltaY }, BUBBLE_SIZE, BUBBLE_SIZE));
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.moved) return;
    suppressClickRef.current = true;
    setPosition((current) => {
      const safe = keepInsideViewport(current ?? drag.origin, BUBBLE_SIZE, BUBBLE_SIZE);
      const snapped = {
        x: safe.x + BUBBLE_SIZE / 2 < window.innerWidth / 2
          ? EDGE_GAP
          : window.innerWidth - BUBBLE_SIZE - EDGE_GAP,
        y: safe.y,
      };
      savePosition(snapped);
      return snapped;
    });
  }

  function openCoach() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setExpanded(true);
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const directions: Record<string, CoachPosition> = {
      ArrowLeft: { x: -16, y: 0 },
      ArrowRight: { x: 16, y: 0 },
      ArrowUp: { x: 0, y: -16 },
      ArrowDown: { x: 0, y: 16 },
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    setPosition((current) => {
      const origin = current ?? defaultPosition();
      const next = keepInsideViewport({ x: origin.x + direction.x, y: origin.y + direction.y }, BUBBLE_SIZE, BUBBLE_SIZE);
      savePosition(next);
      return next;
    });
  }

  const positionStyle = position ? {
    "--coach-x": `${position.x}px`,
    "--coach-y": `${position.y}px`,
  } as CSSProperties : undefined;

  return (
    <aside
      ref={coachRef}
      className={`offline-coach ${online ? "online" : "offline"} ${expanded ? "expanded" : "compact"} ${position ? "positioned" : "position-pending"}`}
      style={positionStyle}
      aria-label="AI offline cục bộ kiểm soát học tập"
    >
      {!expanded ? (
        <button
          type="button"
          className="offline-coach-bubble"
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={moveWithKeyboard}
          onClick={openCoach}
          aria-label="Mở AI cục bộ. Giữ và kéo để đổi vị trí"
          title="AI cục bộ · Giữ và kéo để di chuyển"
        >
          <span aria-hidden="true">✦</span>
          <small aria-hidden="true">AI</small>
          <i className="offline-coach-status" aria-hidden="true" />
        </button>
      ) : (
        <>
          <header>
            <div><i>✦</i><span>AI offline cục bộ</span></div>
            <b>{online ? pendingSyncCount > 0 ? `${pendingSyncCount} mục chờ` : "Đã đồng bộ" : "Hoạt động offline"}</b>
            <button type="button" onClick={() => setExpanded(false)} aria-label="Thu gọn AI thành bong bóng">×</button>
          </header>
          <div className="offline-coach-body">
            <p>{coachMessage(learnerName, completion, stats.todaySeconds, stats.sessionSeconds, online, pendingSyncCount)}</p>
            <dl>
              <div><dt>Phiên này</dt><dd>{minutes(stats.sessionSeconds)} phút</dd></div>
              <div><dt>Hôm nay</dt><dd>{minutes(stats.todaySeconds)} phút</dd></div>
              <div><dt>Học khi offline</dt><dd>{minutes(stats.offlineSeconds)} phút</dd></div>
              <div><dt>Chờ đồng bộ</dt><dd>{pendingSyncCount} mục</dd></div>
            </dl>
            <div className="offline-focus">
              <span>Nhịp tập trung</span><strong>{focusState(stats.sessionSeconds)}</strong>
              <small>Chỉ tính khi trang đang hiển thị và có tương tác gần đây.</small>
            </div>
            <div className="offline-next">
              <span>Gợi ý tiếp theo</span><strong>{nextStep}</strong><small>Lần học gần nhất: {time(stats.lastStudyAt)}</small>
            </div>
            <label className="offline-reminder">
              <input type="checkbox" checked={stats.reminderEnabled} onChange={(event) => void onReminderChange(event.target.checked, stats.reminderMinutes)} />
              <span>Nhắc học khi ứng dụng đang mở</span>
            </label>
            <label className="offline-reminder-time">
              <span>Nhắc sau</span>
              <select value={stats.reminderMinutes} onChange={(event) => void onReminderChange(stats.reminderEnabled, Number(event.target.value))}>
                <option value={30}>30 phút</option><option value={60}>60 phút</option><option value={90}>90 phút</option><option value={120}>120 phút</option>
              </select>
            </label>
            {pendingSyncCount > 0 ? (
              <button className="offline-sync" onClick={onSync} disabled={!online}>{online ? `Đồng bộ ${pendingSyncCount} mục ngay` : "Sẽ tự gửi khi có mạng"}</button>
            ) : <small className="offline-synced">Dữ liệu đã đồng bộ đầy đủ.</small>}
            <footer>Luật thích ứng cục bộ · Không camera · Không gửi bản sửa riêng</footer>
          </div>
        </>
      )}
    </aside>
  );
}
