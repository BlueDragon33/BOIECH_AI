"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createDailyRecord,
  createInitialHealthState,
  currentDay,
  loadHealthState,
  saveHealthState,
  todayKey,
  uid,
  type ActivityEntry,
  type DailyRecord,
  type GrowthEntry,
  type HealthLocalState,
  type MealEntry,
  type Reminder,
  type TaskKey,
} from "./health-local-store";
import { downloadReminderIcs, googleCalendarUrl, nextReminderOccurrence, occurrenceDueNow } from "./health-reminders";

type SectionId = "today" | "growth" | "nutrition" | "activity" | "care" | "journal" | "profile";

export type HealthDeviceAccess = {
  deviceCode: string;
  deviceType: "desktop" | "phone" | "tablet";
  editEnabled: boolean;
  calendarEnabled: boolean;
};

const navigation: { id: SectionId; label: string; short: string }[] = [
  { id: "today", label: "Hôm nay", short: "01" },
  { id: "growth", label: "Tăng trưởng", short: "02" },
  { id: "nutrition", label: "Dinh dưỡng", short: "03" },
  { id: "activity", label: "Vận động", short: "04" },
  { id: "care", label: "Chăm sóc", short: "05" },
  { id: "journal", label: "Nhật ký", short: "06" },
  { id: "profile", label: "Hồ sơ", short: "07" },
];

const todayTasks: { key: TaskKey; label: string; group: string }[] = [
  { key: "breakfast", label: "Ăn sáng", group: "Dinh dưỡng" },
  { key: "water", label: "Theo dõi nước uống", group: "Dinh dưỡng" },
  { key: "movement", label: "Có vận động trong ngày", group: "Vận động" },
  { key: "teethMorning", label: "Đánh răng buổi sáng", group: "Chăm sóc" },
  { key: "teethEvening", label: "Đánh răng buổi tối", group: "Chăm sóc" },
  { key: "sleep", label: "Chuẩn bị ngủ đúng kế hoạch", group: "Giấc ngủ" },
];

const foodGroups = ["Đạm", "Rau", "Trái cây", "Sữa / tương đương", "Ngũ cốc / tinh bột", "Nước"];
const activityTypes = ["Đi bộ", "Chạy", "Đạp xe", "Bơi", "Bóng đá", "Nhảy dây", "Thể dục", "Khác"];
const symptoms = ["Đau đầu", "Đau bụng", "Ho", "Sổ mũi", "Đau họng", "Sốt", "Mệt", "Khác"];
const repeatLabels: Record<Reminder["repeat"], string> = { once: "Một lần", daily: "Hằng ngày", weekdays: "Thứ 2–6", weekly: "Hằng tuần" };
const categoryLabels: Record<Reminder["category"], string> = { nutrition: "Dinh dưỡng", water: "Nước", activity: "Vận động", care: "Chăm sóc", growth: "Đo tăng trưởng", appointment: "Lịch khám", other: "Khác" };

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date) : value;
}

function formatDateTime(value: Date | null) {
  if (!value) return "Chưa có lịch sắp tới";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(value);
}

function bmi(heightCm: number, weightKg: number) {
  if (!(heightCm > 0) || !(weightKg > 0)) return null;
  const meters = heightCm / 100;
  return weightKg / (meters * meters);
}

function sleepDuration(start: string, end: string) {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
}

function SectionHeader({ title, description, aside }: { title: string; description: string; aside?: string }) {
  return <header className="hf-section-head"><div><span className="hf-kicker">Sức khỏe Y tế · 9–10 tuổi</span><h2>{title}</h2><p>{description}</p></div>{aside ? <span className="hf-head-aside">{aside}</span> : null}</header>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="hf-empty">{children}</div>;
}

export default function HealthFramework({ initialCourse, device }: { initialCourse: unknown; device: HealthDeviceAccess }) {
  const [active, setActive] = useState<SectionId>("today");
  const [state, setState] = useState<HealthLocalState>(() => createInitialHealthState());
  const [hydrated, setHydrated] = useState(false);
  const [dayKey, setDayKey] = useState("today");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");

  const [growthDate, setGrowthDate] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [mealType, setMealType] = useState<MealEntry["meal"]>("breakfast");
  const [mealText, setMealText] = useState("");
  const [activityType, setActivityType] = useState(activityTypes[0]);
  const [activityMinutes, setActivityMinutes] = useState("30");
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderCategory, setReminderCategory] = useState<Reminder["category"]>("care");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("19:30");
  const [reminderRepeat, setReminderRepeat] = useState<Reminder["repeat"]>("daily");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const today = todayKey();
      setState(loadHealthState());
      setDayKey(today);
      setGrowthDate(today);
      setReminderDate(today);
      setNotificationPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveHealthState(state);
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated || notificationPermission !== "granted" || typeof Notification === "undefined") return;
    const check = () => {
      const now = new Date();
      const due = state.reminders.find((reminder) => {
        const occurrence = occurrenceDueNow(reminder, now, 2);
        return occurrence && reminder.lastNotifiedOccurrence !== occurrence.toISOString();
      });
      if (!due) return;
      const occurrence = occurrenceDueNow(due, now, 2);
      if (!occurrence) return;
      new Notification(due.title, { body: `${categoryLabels[due.category]} · ${repeatLabels[due.repeat]}`, tag: `health-reminder-${due.id}` });
      setState((current) => ({ ...current, reminders: current.reminders.map((item) => item.id === due.id ? { ...item, lastNotifiedOccurrence: occurrence.toISOString() } : item) }));
    };
    const warmup = window.setTimeout(check, 1_000);
    const timer = window.setInterval(check, 30_000);
    return () => { window.clearTimeout(warmup); window.clearInterval(timer); };
  }, [hydrated, notificationPermission, state.reminders]);

  const day = currentDay(state, dayKey);
  const completed = todayTasks.filter((task) => day.tasks[task.key]).length;
  const progress = Math.round((completed / todayTasks.length) * 100);
  const contentReady = initialCourse !== null && initialCourse !== undefined;
  const growth = useMemo(() => [...state.growth].sort((a, b) => b.date.localeCompare(a.date)), [state.growth]);
  const latestGrowth = growth[0] ?? null;
  const latestBmi = latestGrowth ? bmi(latestGrowth.heightCm, latestGrowth.weightKg) : null;
  const nextReminder = useMemo(() => {
    const candidates = state.reminders.map((reminder) => ({ reminder, date: nextReminderOccurrence(reminder) })).filter((item): item is { reminder: Reminder; date: Date } => item.date !== null);
    candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
    return candidates[0] ?? null;
  }, [state.reminders]);

  function updateDay(change: (current: DailyRecord) => DailyRecord) {
    setState((current) => {
      const value = current.days[dayKey] ?? createDailyRecord();
      return { ...current, days: { ...current.days, [dayKey]: change(value) } };
    });
  }

  function toggleTask(key: TaskKey) {
    updateDay((current) => ({ ...current, tasks: { ...current.tasks, [key]: !current.tasks[key] } }));
  }

  function toggleFoodGroup(group: string) {
    updateDay((current) => ({ ...current, foodGroups: current.foodGroups.includes(group) ? current.foodGroups.filter((item) => item !== group) : [...current.foodGroups, group] }));
  }

  function addGrowth() {
    const height = Number(heightCm);
    const weight = Number(weightKg);
    if (!growthDate || !(height > 50 && height < 220) || !(weight > 10 && weight < 200)) return;
    const entry: GrowthEntry = { id: uid("growth"), date: growthDate, heightCm: Math.round(height * 10) / 10, weightKg: Math.round(weight * 10) / 10 };
    setState((current) => ({ ...current, growth: [...current.growth, entry].slice(-500) }));
    setHeightCm("");
    setWeightKg("");
  }

  function addMeal() {
    const text = mealText.trim();
    if (!text) return;
    const entry: MealEntry = { id: uid("meal"), meal: mealType, text: text.slice(0, 180), createdAt: new Date().toISOString() };
    updateDay((current) => ({ ...current, meals: [...current.meals, entry].slice(-100), tasks: { ...current.tasks, breakfast: current.tasks.breakfast || mealType === "breakfast" } }));
    setMealText("");
  }

  function addActivity() {
    const minutes = Math.round(Number(activityMinutes));
    if (!(minutes > 0 && minutes <= 600)) return;
    const entry: ActivityEntry = { id: uid("activity"), type: activityType, minutes, createdAt: new Date().toISOString() };
    updateDay((current) => ({ ...current, activities: [...current.activities, entry].slice(-100), tasks: { ...current.tasks, movement: true } }));
  }

  function addReminder() {
    const title = reminderTitle.trim();
    if (!title || !reminderDate || !/^\d{2}:\d{2}$/.test(reminderTime)) return;
    const reminder: Reminder = { id: uid("reminder"), title: title.slice(0, 100), category: reminderCategory, date: reminderDate, time: reminderTime, repeat: reminderRepeat, enabled: true };
    setState((current) => ({ ...current, reminders: [...current.reminders, reminder].slice(-200) }));
    setReminderTitle("");
  }

  async function requestNotifications() {
    if (typeof Notification === "undefined") { setNotificationPermission("unsupported"); return; }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  function openGoogleCalendar(reminder: Reminder) {
    if (!device.calendarEnabled) return;
    const url = googleCalendarUrl(reminder);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return <main className="hf-shell" data-content-ready={contentReady ? "true" : "false"}>
    <div className="hf-layout">
      <aside className="hf-sidebar" aria-label="Điều hướng Sức khỏe Y tế">
        <div className="hf-brand"><span className="hf-brand-mark">SK</span><div><strong>Sức khỏe Y tế</strong><small>Trẻ 9–10 tuổi</small></div></div>
        <nav className="hf-nav">{navigation.map((item) => <button key={item.id} type="button" className={active === item.id ? "hf-nav-item is-active" : "hf-nav-item"} onClick={() => setActive(item.id)} aria-current={active === item.id ? "page" : undefined}><span>{item.short}</span><strong>{item.label}</strong></button>)}</nav>
        <div className="hf-boundary-card"><span>Ranh giới hệ thống</span><strong>Dữ liệu sức khỏe lưu cục bộ</strong><p>Site Quản trị chỉ điều khiển thiết bị, quyền và policy. Hồ sơ, nhật ký và số đo trong lượt này không gửi về Trung tâm.</p></div>
      </aside>

      <section className="hf-content">
        <div className="hf-topbar"><div><span className="hf-kicker">Bộ khung vận hành · local-first</span><h1>Sức khỏe trẻ 9–10 tuổi</h1></div><div className="hf-top-status"><span className="hf-dot" />{contentReady ? `${device.deviceCode} · đã cấp truy cập` : "Đang chờ nội dung"}</div></div>

        {active === "today" ? <section className="hf-section">
          <SectionHeader title="Hôm nay" description="Checklist, tiến độ và nhắc việc được gom vào một màn hình. Dữ liệu ngày tự tách theo ngày trên thiết bị." aside={hydrated ? "Đã bật lưu cục bộ" : "Đang đọc dữ liệu…"} />
          <div className="hf-today-grid">
            <article className="hf-progress-card"><div className="hf-progress-title"><div><span>Tiến độ hôm nay</span><strong>{completed}/{todayTasks.length}</strong></div><b>{progress}%</b></div><div className="hf-progress-track"><span style={{ width: `${progress}%` }} /></div><p>Dinh dưỡng · vận động · răng miệng · giấc ngủ.</p></article>
            <article className="hf-next-card"><span>Việc tiếp theo</span><strong>{nextReminder?.reminder.title ?? "Chưa có nhắc việc"}</strong><p>{nextReminder ? `${formatDateTime(nextReminder.date)} · ${repeatLabels[nextReminder.reminder.repeat]}` : "Tạo nhắc việc trong Hồ sơ → Lịch & nhắc việc."}</p></article>
          </div>
          <div className="hf-dashboard-grid">
            <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Checklist</span><h3>Việc của hôm nay</h3></div><small>{formatDate(dayKey === "today" ? todayKey() : dayKey)}</small></div><div className="hf-task-list">{todayTasks.map((task) => <label className={day.tasks[task.key] ? "hf-task is-done" : "hf-task"} key={task.key}><input type="checkbox" checked={day.tasks[task.key]} onChange={() => toggleTask(task.key)} /><span><strong>{task.label}</strong><small>{task.group}</small></span></label>)}</div></section>
            <aside className="hf-quick-column">
              <article className="hf-quick-card"><span>Tăng trưởng</span><strong>{latestGrowth ? `${latestGrowth.heightCm} cm · ${latestGrowth.weightKg} kg` : "Chưa có số đo"}</strong><small>{latestGrowth ? `Lần gần nhất ${formatDate(latestGrowth.date)}` : "Thêm chiều cao và cân nặng để bắt đầu timeline."}</small><button type="button" onClick={() => setActive("growth")}>Mở tăng trưởng</button></article>
              <article className="hf-quick-card"><span>Dinh dưỡng</span><strong>{day.foodGroups.length}/{foodGroups.length} nhóm · {day.waterCups} cốc nước</strong><small>{day.meals.length} bản ghi bữa ăn hôm nay.</small><button type="button" onClick={() => setActive("nutrition")}>Mở dinh dưỡng</button></article>
              <article className="hf-quick-card"><span>Vận động</span><strong>{day.activities.reduce((sum, item) => sum + item.minutes, 0)} phút</strong><small>{day.activities.length ? day.activities.map((item) => item.type).join(" · ") : "Chưa ghi hoạt động."}</small><button type="button" onClick={() => setActive("activity")}>Mở vận động</button></article>
            </aside>
          </div>
        </section> : null}

        {active === "growth" ? <section className="hf-section">
          <SectionHeader title="Tăng trưởng" description="Lưu từng lần đo chiều cao và cân nặng. BMI hiển thị như giá trị tính toán; chưa tự xếp loại vì đánh giá trẻ cần xét tuổi và giới tính." />
          <div className="hf-work-grid">
            <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Ghi số đo</span><h3>Thêm mốc tăng trưởng</h3></div></div><div className="hf-form-grid"><label>Ngày đo<input type="date" value={growthDate} onChange={(event) => setGrowthDate(event.target.value)} /></label><label>Chiều cao (cm)<input inputMode="decimal" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} placeholder="Ví dụ 136.5" /></label><label>Cân nặng (kg)<input inputMode="decimal" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} placeholder="Ví dụ 31.2" /></label></div><button className="hf-primary" type="button" onClick={addGrowth}>Lưu số đo trên thiết bị</button></section>
            <section className="hf-panel"><span className="hf-kicker">Mốc gần nhất</span><div className="hf-metric-row"><div><strong>{latestGrowth?.heightCm ?? "—"}</strong><small>cm</small></div><div><strong>{latestGrowth?.weightKg ?? "—"}</strong><small>kg</small></div><div><strong>{latestBmi ? latestBmi.toFixed(1) : "—"}</strong><small>BMI tính toán</small></div></div><p className="hf-muted">Không dùng BMI đơn lẻ để kết luận tình trạng dinh dưỡng của trẻ.</p></section>
          </div>
          <section className="hf-panel hf-list-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Timeline</span><h3>Lịch sử số đo</h3></div><small>{growth.length} mốc</small></div>{growth.length ? <div className="hf-table-list">{growth.map((entry) => <article key={entry.id}><strong>{formatDate(entry.date)}</strong><span>{entry.heightCm} cm</span><span>{entry.weightKg} kg</span><span>BMI {bmi(entry.heightCm, entry.weightKg)?.toFixed(1) ?? "—"}</span><button type="button" onClick={() => setState((current) => ({ ...current, growth: current.growth.filter((item) => item.id !== entry.id) }))}>Xóa</button></article>)}</div> : <Empty>Chưa có số đo tăng trưởng.</Empty>}</section>
        </section> : null}

        {active === "nutrition" ? <section className="hf-section">
          <SectionHeader title="Dinh dưỡng" description="Checklist nhóm thực phẩm, nước và nhật ký bữa ăn theo ngày. Không dùng calorie tracker hoặc mục tiêu giảm cân người lớn." />
          <div className="hf-work-grid">
            <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Nhóm thực phẩm</span><h3>Checklist hôm nay</h3></div><small>{day.foodGroups.length}/{foodGroups.length}</small></div><div className="hf-chip-grid">{foodGroups.map((group) => <button type="button" key={group} className={day.foodGroups.includes(group) ? "hf-chip is-active" : "hf-chip"} onClick={() => toggleFoodGroup(group)}>{group}</button>)}</div></section>
            <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Nước</span><h3>{day.waterCups} cốc</h3></div></div><div className="hf-stepper"><button type="button" onClick={() => updateDay((current) => ({ ...current, waterCups: Math.max(0, current.waterCups - 1) }))}>−</button><strong>{day.waterCups}</strong><button type="button" onClick={() => updateDay((current) => ({ ...current, waterCups: Math.min(50, current.waterCups + 1), tasks: { ...current.tasks, water: true } }))}>+</button></div><p className="hf-muted">Đơn vị “cốc” để ghi nhanh. Mục tiêu cụ thể sẽ được cấu hình ở lớp nội dung/khuyến nghị sau.</p></section>
          </div>
          <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Nhật ký bữa ăn</span><h3>Ghi món đã ăn</h3></div></div><div className="hf-inline-form"><select value={mealType} onChange={(event) => setMealType(event.target.value as MealEntry["meal"])}><option value="breakfast">Bữa sáng</option><option value="lunch">Bữa trưa</option><option value="snack">Bữa phụ</option><option value="dinner">Bữa tối</option></select><input value={mealText} onChange={(event) => setMealText(event.target.value)} placeholder="Ví dụ: cơm, cá, rau, cam" maxLength={180} /><button className="hf-primary" type="button" onClick={addMeal}>Thêm</button></div>{day.meals.length ? <div className="hf-entry-list">{[...day.meals].reverse().map((entry) => <article key={entry.id}><span>{entry.meal === "breakfast" ? "Sáng" : entry.meal === "lunch" ? "Trưa" : entry.meal === "snack" ? "Phụ" : "Tối"}</span><strong>{entry.text}</strong><button type="button" onClick={() => updateDay((current) => ({ ...current, meals: current.meals.filter((item) => item.id !== entry.id) }))}>Xóa</button></article>)}</div> : <Empty>Chưa ghi bữa ăn hôm nay.</Empty>}</section>
        </section> : null}

        {active === "activity" ? <section className="hf-section">
          <SectionHeader title="Vận động" description="Ghi loại hoạt động và số phút trong ngày để theo dõi thói quen theo thời gian." />
          <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Hoạt động hôm nay</span><h3>Thêm vận động</h3></div><strong className="hf-big-number">{day.activities.reduce((sum, item) => sum + item.minutes, 0)} phút</strong></div><div className="hf-inline-form"><select value={activityType} onChange={(event) => setActivityType(event.target.value)}>{activityTypes.map((item) => <option key={item}>{item}</option>)}</select><input inputMode="numeric" value={activityMinutes} onChange={(event) => setActivityMinutes(event.target.value)} placeholder="Số phút" /><button type="button" className="hf-primary" onClick={addActivity}>Thêm</button></div>{day.activities.length ? <div className="hf-entry-list">{[...day.activities].reverse().map((entry) => <article key={entry.id}><span>{entry.minutes} phút</span><strong>{entry.type}</strong><button type="button" onClick={() => updateDay((current) => ({ ...current, activities: current.activities.filter((item) => item.id !== entry.id) }))}>Xóa</button></article>)}</div> : <Empty>Chưa có hoạt động hôm nay.</Empty>}</section>
          <section className="hf-panel hf-info-panel"><span className="hf-kicker">Thiết kế đúng phạm vi</span><h3>Không phải module gym/giảm cân</h3><p>Phần này chỉ theo dõi thói quen vận động của trẻ 9–10 tuổi. Các chỉ tiêu chuyên sâu sẽ chỉ được thêm khi có nguồn hướng dẫn phù hợp và qua quy trình duyệt nội dung.</p></section>
        </section> : null}

        {active === "care" ? <section className="hf-section">
          <SectionHeader title="Chăm sóc" description="Giấc ngủ, răng miệng, mắt & học tập và vệ sinh cá nhân được gom trong một khu vực." />
          <div className="hf-module-grid">
            <article className="hf-module-card"><span className="hf-kicker">Giấc ngủ</span><h3>Giờ ngủ & thức dậy</h3><div className="hf-form-grid two"><label>Đi ngủ<input type="time" value={day.sleepStart} onChange={(event) => updateDay((current) => ({ ...current, sleepStart: event.target.value }))} /></label><label>Thức dậy<input type="time" value={day.sleepEnd} onChange={(event) => updateDay((current) => ({ ...current, sleepEnd: event.target.value, tasks: { ...current.tasks, sleep: Boolean(event.target.value) } }))} /></label></div><strong className="hf-card-value">{sleepDuration(day.sleepStart, day.sleepEnd)?.toFixed(1) ?? "—"} giờ</strong><small>Thời lượng được tính từ giờ nhập, chưa tự đánh giá đạt/chưa đạt.</small></article>
            <article className="hf-module-card"><span className="hf-kicker">Răng miệng</span><h3>Checklist đánh răng</h3><label className="hf-switch-row"><input type="checkbox" checked={day.tasks.teethMorning} onChange={() => toggleTask("teethMorning")} /><span>Sáng</span></label><label className="hf-switch-row"><input type="checkbox" checked={day.tasks.teethEvening} onChange={() => toggleTask("teethEvening")} /><span>Tối</span></label><small>Lịch nha khoa có thể tạo ở mục Nhắc việc.</small></article>
            <article className="hf-module-card"><span className="hf-kicker">Mắt & học tập</span><h3>Lần nghỉ mắt đã ghi</h3><div className="hf-stepper"><button type="button" onClick={() => updateDay((current) => ({ ...current, eyeBreaks: Math.max(0, current.eyeBreaks - 1) }))}>−</button><strong>{day.eyeBreaks}</strong><button type="button" onClick={() => updateDay((current) => ({ ...current, eyeBreaks: Math.min(100, current.eyeBreaks + 1) }))}>+</button></div><small>Chỉ ghi thói quen; chưa tự chẩn đoán mỏi mắt hoặc tật khúc xạ.</small></article>
            <article className="hf-module-card"><span className="hf-kicker">Vệ sinh cá nhân</span><h3>Checklist trong ngày</h3><label className="hf-switch-row"><input type="checkbox" checked={day.hygieneDone} onChange={() => updateDay((current) => ({ ...current, hygieneDone: !current.hygieneDone }))} /><span>Đã hoàn thành vệ sinh cá nhân</span></label><small>Có thể mở rộng thành checklist sáng/tối ở lượt nội dung tiếp theo.</small></article>
          </div>
        </section> : null}

        {active === "journal" ? <section className="hf-section">
          <SectionHeader title="Nhật ký" description="Ghi cảm nhận và triệu chứng để theo dõi diễn biến. Đây không phải công cụ tự chẩn đoán hoặc tự kê đơn." />
          <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Cảm nhận</span><h3>Hôm nay em cảm thấy</h3></div></div><div className="hf-choice-row">{([['good','Khỏe'],['normal','Bình thường'],['unwell','Không khỏe']] as const).map(([value, label]) => <button type="button" key={value} className={day.feeling === value ? "hf-choice is-active" : "hf-choice"} onClick={() => updateDay((current) => ({ ...current, feeling: value }))}>{label}</button>)}</div></section>
          <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Triệu chứng</span><h3>Ghi nhanh</h3></div></div><div className="hf-chip-grid">{symptoms.map((item) => <button type="button" key={item} className={day.symptoms.includes(item) ? "hf-chip is-active" : "hf-chip"} onClick={() => updateDay((current) => ({ ...current, symptoms: current.symptoms.includes(item) ? current.symptoms.filter((value) => value !== item) : [...current.symptoms, item] }))}>{item}</button>)}</div><label className="hf-textarea-label">Ghi chú<textarea value={day.journalNote} maxLength={1200} onChange={(event) => updateDay((current) => ({ ...current, journalNote: event.target.value }))} placeholder="Diễn biến, thời điểm xuất hiện hoặc điều cần nhớ…" /></label><div className="hf-safety-note"><strong>Khi có dấu hiệu nghiêm trọng hoặc trẻ xấu đi rõ rệt:</strong> không dựa vào nhật ký để tự xử trí; cần liên hệ cơ sở y tế phù hợp.</div></section>
        </section> : null}

        {active === "profile" ? <section className="hf-section">
          <SectionHeader title="Hồ sơ & nhắc việc" description="Hồ sơ trẻ và lịch nhắc được lưu trên thiết bị. Google Calendar là quyền riêng do Trung tâm cấp cho từng thiết bị." aside={device.calendarEnabled ? "Calendar: được cấp" : "Calendar: đang khóa"} />
          <div className="hf-work-grid">
            <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Hồ sơ trẻ</span><h3>Thông tin cơ bản</h3></div></div><div className="hf-form-grid"><label>Tên / tên gọi<input value={state.profile.name} maxLength={80} onChange={(event) => setState((current) => ({ ...current, profile: { ...current.profile, name: event.target.value } }))} /></label><label>Ngày sinh<input type="date" value={state.profile.birthDate} onChange={(event) => setState((current) => ({ ...current, profile: { ...current.profile, birthDate: event.target.value } }))} /></label><label>Giới tính<select value={state.profile.sex} onChange={(event) => setState((current) => ({ ...current, profile: { ...current.profile, sex: event.target.value as "male" | "female" | "" } }))}><option value="">Chưa chọn</option><option value="male">Nam</option><option value="female">Nữ</option></select></label></div><label className="hf-textarea-label">Ghi chú cần nhớ<textarea value={state.profile.note} maxLength={800} onChange={(event) => setState((current) => ({ ...current, profile: { ...current.profile, note: event.target.value } }))} /></label><div className="hf-local-badge">Chỉ lưu trong trình duyệt hiện tại · không gửi hồ sơ này sang Site Quản trị.</div></section>
            <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Thông báo trình duyệt</span><h3>{notificationPermission === "granted" ? "Đã cho phép" : notificationPermission === "denied" ? "Đã bị trình duyệt chặn" : notificationPermission === "unsupported" ? "Không được hỗ trợ" : "Chưa cho phép"}</h3></div></div><p className="hf-muted">Thông báo lặp được kiểm tra khi Web App đang hoạt động. Để nhắc đáng tin cậy khi ứng dụng đóng, dùng file .ics hoặc Calendar.</p><button className="hf-secondary" type="button" disabled={notificationPermission === "unsupported"} onClick={() => void requestNotifications()}>Yêu cầu quyền thông báo</button></section>
          </div>
          <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Reminder Engine</span><h3>Tạo nhắc việc</h3></div></div><div className="hf-reminder-form"><input value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder="Ví dụ: Đánh răng buổi tối" maxLength={100} /><select value={reminderCategory} onChange={(event) => setReminderCategory(event.target.value as Reminder["category"])}>{Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><input type="date" value={reminderDate} onChange={(event) => setReminderDate(event.target.value)} /><input type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} /><select value={reminderRepeat} onChange={(event) => setReminderRepeat(event.target.value as Reminder["repeat"])}>{Object.entries(repeatLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button className="hf-primary" type="button" onClick={addReminder}>Thêm nhắc việc</button></div></section>
          <section className="hf-panel hf-list-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Lịch nhắc</span><h3>{state.reminders.length} nhắc việc</h3></div><small>Browser · .ics · Google Calendar</small></div>{state.reminders.length ? <div className="hf-reminder-list">{state.reminders.map((reminder) => <article key={reminder.id} className={reminder.enabled ? "" : "is-disabled"}><div><span>{categoryLabels[reminder.category]}</span><strong>{reminder.title}</strong><small>{formatDate(reminder.date)} · {reminder.time} · {repeatLabels[reminder.repeat]}</small></div><div className="hf-reminder-actions"><button type="button" onClick={() => setState((current) => ({ ...current, reminders: current.reminders.map((item) => item.id === reminder.id ? { ...item, enabled: !item.enabled } : item) }))}>{reminder.enabled ? "Tắt" : "Bật"}</button><button type="button" onClick={() => downloadReminderIcs(reminder)}>Tải .ics</button><button type="button" className={device.calendarEnabled ? "hf-calendar-enabled" : ""} disabled={!device.calendarEnabled} title={device.calendarEnabled ? "Mở Google Calendar" : "Thiết bị chưa được Trung tâm cấp quyền Google Calendar"} onClick={() => openGoogleCalendar(reminder)}>Google Calendar</button><button type="button" onClick={() => setState((current) => ({ ...current, reminders: current.reminders.filter((item) => item.id !== reminder.id) }))}>Xóa</button></div></article>)}</div> : <Empty>Chưa có nhắc việc.</Empty>} {!device.calendarEnabled ? <div className="hf-calendar-lock"><strong>Google Calendar đang bị khóa trên thiết bị này.</strong><span>Chỉ Trung tâm Quản trị có thể cấp quyền; Web App không tự mở khóa.</span></div> : null}</section>
        </section> : null}
      </section>
    </div>

    <nav className="hf-bottom-nav" aria-label="Điều hướng nhanh trên thiết bị nhỏ">{navigation.map((item) => <button key={item.id} type="button" className={active === item.id ? "is-active" : ""} onClick={() => setActive(item.id)}><span>{item.short}</span><strong>{item.label}</strong></button>)}</nav>
  </main>;
}
