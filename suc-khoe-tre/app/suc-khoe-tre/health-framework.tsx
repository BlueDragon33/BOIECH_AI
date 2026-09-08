"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  createDailyRecord,
  createInitialHealthState,
  currentDay,
  exportHealthBackup,
  loadHealthState,
  parseHealthBackup,
  recentDateKeys,
  saveHealthState,
  shiftDateKey,
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
import { HEALTH_AGE_STAGES, profileAgeScope, type HealthAgeStage } from "./health-age-scope";
import { assessWhoBmiForAge, calculateBmi, formatAgeMonths, type WhoBmiAssessment } from "./who-bmi-reference";

export type HealthDeviceAccess = {
  deviceCode: string;
  deviceType: "desktop" | "phone" | "tablet";
  editEnabled: boolean;
  calendarEnabled: boolean;
};

type SectionId = "today" | "growth" | "nutrition" | "activity" | "care" | "journal" | "profile";

const navigation: { id: SectionId; label: string; short: string }[] = [
  { id: "today", label: "Hôm nay", short: "01" },
  { id: "growth", label: "Tăng trưởng", short: "02" },
  { id: "nutrition", label: "Dinh dưỡng", short: "03" },
  { id: "activity", label: "Vận động", short: "04" },
  { id: "care", label: "Chăm sóc", short: "05" },
  { id: "journal", label: "Nhật ký", short: "06" },
  { id: "profile", label: "Hồ sơ", short: "07" },
];

const dailySections: SectionId[] = ["today", "nutrition", "activity", "care", "journal"];
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

function formatWeekday(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }).format(date) : value;
}

function formatDateTime(value: Date | null) {
  if (!value) return "Chưa có lịch sắp tới";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(value);
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
  return <header className="hf-section-head"><div><span className="hf-kicker">Sức khỏe Y tế · 9–18 tuổi</span><h2>{title}</h2><p>{description}</p></div>{aside ? <span className="hf-head-aside">{aside}</span> : null}</header>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="hf-empty">{children}</div>;
}

function DayToolbar({ dayKey, today, onChange }: { dayKey: string; today: string; onChange: (value: string) => void }) {
  return <div className="hf-day-toolbar" aria-label="Chọn ngày theo dõi">
    <button type="button" onClick={() => onChange(shiftDateKey(dayKey, -1))} aria-label="Ngày trước">←</button>
    <label><span>Ngày theo dõi</span><input type="date" value={dayKey} max={today} onChange={(event) => event.target.value && onChange(event.target.value <= today ? event.target.value : today)} /></label>
    <button type="button" disabled={dayKey >= today} onClick={() => onChange(shiftDateKey(dayKey, 1))} aria-label="Ngày sau">→</button>
    <button type="button" className={dayKey === today ? "is-current" : ""} onClick={() => onChange(today)}>Hôm nay</button>
  </div>;
}

function StagePanel({ stage }: { stage: HealthAgeStage | null }) {
  return <section className="hf-panel hf-info-panel">
    <span className="hf-kicker">Giai đoạn phát triển</span>
    <h3>{stage?.label ?? "Cần ngày sinh để cá nhân hóa theo tuổi"}</h3>
    <p>{stage ? "Ứng dụng dùng giai đoạn này để tổ chức nội dung phù hợp độ tuổi; đây không phải phân loại bệnh hay mức trưởng thành sinh học." : "Nhập ngày sinh trong Hồ sơ để hệ thống xác định giai đoạn 9–18 tuổi."}</p>
    {stage ? <div className="hf-chip-grid">{stage.focus.map((item) => <span className="hf-chip" key={item}>{item}</span>)}</div> : null}
  </section>;
}

function assessmentLabel(assessment: WhoBmiAssessment | null) {
  if (!assessment) return "Chưa có số đo";
  if (!assessment.available) return assessment.message;
  return `${assessment.categoryLabel} · z ${assessment.zScore >= 0 ? "+" : ""}${assessment.zScore.toFixed(2)}`;
}

export default function HealthFramework({ initialCourse, device }: { initialCourse: unknown; device: HealthDeviceAccess }) {
  const [active, setActive] = useState<SectionId>("today");
  const [state, setState] = useState<HealthLocalState>(() => createInitialHealthState());
  const [hydrated, setHydrated] = useState(false);
  const [dayKey, setDayKey] = useState("today");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [backupNotice, setBackupNotice] = useState("");

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

  const today = todayKey();
  const day = currentDay(state, dayKey);
  const completed = todayTasks.filter((task) => day.tasks[task.key]).length;
  const progress = Math.round((completed / todayTasks.length) * 100);
  const contentReady = initialCourse !== null && initialCourse !== undefined;
  const growth = useMemo(() => [...state.growth].sort((a, b) => b.date.localeCompare(a.date)), [state.growth]);
  const latestGrowth = growth[0] ?? null;
  const profileAge = useMemo(() => profileAgeScope(state.profile.birthDate, today), [state.profile.birthDate, today]);
  const latestAssessment = useMemo(() => latestGrowth ? assessWhoBmiForAge({ birthDate: state.profile.birthDate, measurementDate: latestGrowth.date, sex: state.profile.sex, heightCm: latestGrowth.heightCm, weightKg: latestGrowth.weightKg }) : null, [latestGrowth, state.profile.birthDate, state.profile.sex]);
  const historyKeys = useMemo(() => recentDateKeys(7, dayKey), [dayKey]);
  const nextReminder = useMemo(() => {
    const candidates = state.reminders.map((reminder) => ({ reminder, date: nextReminderOccurrence(reminder) })).filter((item): item is { reminder: Reminder; date: Date } => item.date !== null);
    candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
    return candidates[0] ?? null;
  }, [state.reminders]);

  function assessmentFor(entry: GrowthEntry) {
    return assessWhoBmiForAge({ birthDate: state.profile.birthDate, measurementDate: entry.date, sex: state.profile.sex, heightCm: entry.heightCm, weightKg: entry.weightKg });
  }

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
    setNotificationPermission(await Notification.requestPermission());
  }

  function openGoogleCalendar(reminder: Reminder) {
    if (!device.calendarEnabled) return;
    const url = googleCalendarUrl(reminder);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function downloadBackup() {
    const content = exportHealthBackup(state);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `suc-khoe-y-te-9-18-backup-${today}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setBackupNotice("Đã tạo bản sao dữ liệu cục bộ 9–18 tuổi. Hãy lưu tệp ở nơi an toàn.");
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5_000_000) { setBackupNotice("Tệp sao lưu quá lớn."); return; }
    try {
      const imported = parseHealthBackup(JSON.parse(await file.text()));
      setState(imported);
      setDayKey(today);
      setBackupNotice("Đã khôi phục bản sao. Bản sao 9–10 cũ cũng được hỗ trợ và tự di trú.");
    } catch (error) {
      setBackupNotice(error instanceof Error ? error.message : "Không thể đọc tệp sao lưu.");
    }
  }

  return <main className="hf-shell" data-content-ready={contentReady ? "true" : "false"}>
    <div className="hf-layout">
      <aside className="hf-sidebar" aria-label="Điều hướng Sức khỏe Y tế">
        <div className="hf-brand"><span className="hf-brand-mark">SK</span><div><strong>Sức khỏe Y tế</strong><small>9–18 tuổi · đến giai đoạn đại học</small></div></div>
        <nav className="hf-nav">{navigation.map((item) => <button key={item.id} type="button" className={active === item.id ? "hf-nav-item is-active" : "hf-nav-item"} onClick={() => setActive(item.id)} aria-current={active === item.id ? "page" : undefined}><span>{item.short}</span><strong>{item.label}</strong></button>)}</nav>
        <div className="hf-boundary-card"><span>Ranh giới hệ thống</span><strong>Dữ liệu sức khỏe lưu cục bộ</strong><p>Site Quản trị chỉ điều khiển thiết bị, quyền và policy. Hồ sơ, nhật ký, số đo và bản sao dữ liệu không gửi về Trung tâm.</p></div>
      </aside>

      <section className="hf-content">
        <div className="hf-topbar"><div><span className="hf-kicker">Theo dõi xuyên suốt · 9 đến hết 18 tuổi</span><h1>Sức khỏe Y tế 9–18 tuổi</h1><small>{profileAge.stage?.label ?? "Nhập ngày sinh để xác định giai đoạn phát triển"}</small></div><div className="hf-top-status"><span className="hf-dot" />{contentReady ? `${device.deviceCode} · đã cấp truy cập` : "Đang chờ nội dung"}</div></div>
        {dailySections.includes(active) ? <DayToolbar dayKey={dayKey} today={today} onChange={setDayKey} /> : null}

        {active === "today" ? <section className="hf-section">
          <SectionHeader title={dayKey === today ? "Hôm nay" : "Ngày đã chọn"} description="Checklist, tiến độ và nhắc việc được giữ liên tục khi trẻ lớn dần; nội dung chuyên môn sẽ thay đổi theo giai đoạn tuổi." aside={hydrated ? formatDate(dayKey) : "Đang đọc dữ liệu…"} />
          <StagePanel stage={profileAge.stage} />
          <div className="hf-today-grid">
            <article className="hf-progress-card"><div className="hf-progress-title"><div><span>Tiến độ ngày</span><strong>{completed}/{todayTasks.length}</strong></div><b>{progress}%</b></div><div className="hf-progress-track"><span style={{ width: `${progress}%` }} /></div><p>Dinh dưỡng · vận động · răng miệng · giấc ngủ.</p></article>
            <article className="hf-next-card"><span>Việc tiếp theo</span><strong>{nextReminder?.reminder.title ?? "Chưa có nhắc việc"}</strong><p>{nextReminder ? `${formatDateTime(nextReminder.date)} · ${repeatLabels[nextReminder.reminder.repeat]}` : "Tạo nhắc việc trong Hồ sơ → Lịch & nhắc việc."}</p></article>
          </div>
          <div className="hf-dashboard-grid">
            <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Checklist</span><h3>Việc trong ngày</h3></div><small>{formatDate(dayKey)}</small></div><div className="hf-task-list">{todayTasks.map((task) => <label className={day.tasks[task.key] ? "hf-task is-done" : "hf-task"} key={task.key}><input type="checkbox" checked={day.tasks[task.key]} onChange={() => toggleTask(task.key)} /><span><strong>{task.label}</strong><small>{task.group}</small></span></label>)}</div></section>
            <aside className="hf-quick-column">
              <article className="hf-quick-card"><span>Tăng trưởng</span><strong>{latestGrowth ? `${latestGrowth.heightCm} cm · ${latestGrowth.weightKg} kg` : "Chưa có số đo"}</strong><small>{latestGrowth ? assessmentLabel(latestAssessment) : "Thêm chiều cao và cân nặng để bắt đầu timeline."}</small><button type="button" onClick={() => setActive("growth")}>Mở tăng trưởng</button></article>
              <article className="hf-quick-card"><span>Dinh dưỡng</span><strong>{day.foodGroups.length}/{foodGroups.length} nhóm · {day.waterCups} cốc nước</strong><small>{day.meals.length} bản ghi bữa ăn ngày đã chọn.</small><button type="button" onClick={() => setActive("nutrition")}>Mở dinh dưỡng</button></article>
              <article className="hf-quick-card"><span>Vận động</span><strong>{day.activities.reduce((sum, item) => sum + item.minutes, 0)} phút</strong><small>{day.activities.length ? day.activities.map((item) => item.type).join(" · ") : "Chưa ghi hoạt động."}</small><button type="button" onClick={() => setActive("activity")}>Mở vận động</button></article>
            </aside>
          </div>
          <section className="hf-panel hf-week-panel"><div className="hf-panel-head"><div><span className="hf-kicker">7 ngày</span><h3>Nhìn nhanh thói quen</h3></div><small>Kết thúc tại {formatDate(dayKey)}</small></div><div className="hf-week-strip">{historyKeys.map((key) => { const record = currentDay(state, key); const done = todayTasks.filter((task) => record.tasks[task.key]).length; const minutes = record.activities.reduce((sum, item) => sum + item.minutes, 0); return <button type="button" key={key} className={key === dayKey ? "is-selected" : ""} onClick={() => setDayKey(key)}><span>{formatWeekday(key)}</span><strong>{done}/{todayTasks.length}</strong><small>{record.waterCups} cốc · {minutes} phút</small></button>; })}</div></section>
        </section> : null}

        {active === "growth" ? <section className="hf-section">
          <SectionHeader title="Tăng trưởng 9–18 tuổi" description="BMI-for-age được đối chiếu theo đúng tuổi tính bằng tháng và giới tính với WHO Reference 2007. Kết quả là tham chiếu tăng trưởng, không phải chẩn đoán." aside={profileAge.text} />
          <div className="hf-work-grid">
            <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Ghi số đo</span><h3>Thêm mốc tăng trưởng</h3></div></div><div className="hf-form-grid"><label>Ngày đo<input type="date" max={today} value={growthDate} onChange={(event) => setGrowthDate(event.target.value)} /></label><label>Chiều cao (cm)<input inputMode="decimal" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} placeholder="Ví dụ 156.5" /></label><label>Cân nặng (kg)<input inputMode="decimal" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} placeholder="Ví dụ 48.2" /></label></div><button className="hf-primary" type="button" onClick={addGrowth}>Lưu số đo trên thiết bị</button></section>
            <section className="hf-panel"><span className="hf-kicker">Mốc gần nhất</span><div className="hf-metric-row"><div><strong>{latestGrowth?.heightCm ?? "—"}</strong><small>cm</small></div><div><strong>{latestGrowth?.weightKg ?? "—"}</strong><small>kg</small></div><div><strong>{latestGrowth ? calculateBmi(latestGrowth.heightCm, latestGrowth.weightKg)?.toFixed(1) ?? "—" : "—"}</strong><small>BMI</small></div></div>{latestAssessment?.available ? <><div className="hf-local-badge">{formatAgeMonths(latestAssessment.ageMonths)} · z {latestAssessment.zScore >= 0 ? "+" : ""}{latestAssessment.zScore.toFixed(2)} · {latestAssessment.categoryLabel}</div><p className="hf-muted">Ngưỡng tại tháng tuổi này: gầy &lt; {latestAssessment.cutoffs.thinnessBelow.toFixed(1)} · thừa cân &gt; {latestAssessment.cutoffs.overweightAbove.toFixed(1)} · béo phì &gt; {latestAssessment.cutoffs.obesityAbove.toFixed(1)} kg/m².</p></> : <div className="hf-age-warning">{latestAssessment?.message ?? "Chưa có số đo để đánh giá."}</div>}<p className="hf-muted">Nguồn: WHO Reference 2007 · BMI-for-age 5–19 years. Ứng dụng chủ động giới hạn phạm vi sản phẩm đến hết 18 tuổi 11 tháng.</p></section>
          </div>
          <section className="hf-panel hf-info-panel"><span className="hf-kicker">Ranh giới 18 → 19 tuổi</span><h3>Không đổi sang BMI người lớn ngay khi tròn 18</h3><p>Trong toàn bộ phạm vi 9–18 tuổi, ứng dụng tiếp tục dùng BMI-for-age theo tháng và giới tính. Khi bước sang 19 tuổi, hệ thống dừng đánh giá trẻ/vị thành niên và yêu cầu một chế độ chuyển tiếp người lớn riêng.</p></section>
          <section className="hf-panel hf-list-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Timeline</span><h3>Lịch sử số đo</h3></div><small>{growth.length} mốc</small></div>{growth.length ? <div className="hf-table-list">{growth.map((entry) => { const assessment = assessmentFor(entry); return <article key={entry.id}><strong>{formatDate(entry.date)}</strong><span>{entry.heightCm} cm · {entry.weightKg} kg</span><span>BMI {calculateBmi(entry.heightCm, entry.weightKg)?.toFixed(1) ?? "—"}</span><span>{assessment.available ? `${formatAgeMonths(assessment.ageMonths)} · z ${assessment.zScore >= 0 ? "+" : ""}${assessment.zScore.toFixed(2)} · ${assessment.categoryLabel}` : assessment.message}</span><button type="button" onClick={() => setState((current) => ({ ...current, growth: current.growth.filter((item) => item.id !== entry.id) }))}>Xóa</button></article>; })}</div> : <Empty>Chưa có số đo tăng trưởng.</Empty>}</section>
        </section> : null}

        {active === "nutrition" ? <section className="hf-section">
          <SectionHeader title="Dinh dưỡng" description="Checklist nhóm thực phẩm, nước và nhật ký bữa ăn theo ngày. Mục tiêu sau này được cấu hình theo từng giai đoạn 9–18, không dùng chế độ giảm cân người lớn cho trẻ." aside={formatDate(dayKey)} />
          <StagePanel stage={profileAge.stage} />
          <div className="hf-work-grid">
            <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Nhóm thực phẩm</span><h3>Checklist ngày đã chọn</h3></div><small>{day.foodGroups.length}/{foodGroups.length}</small></div><div className="hf-chip-grid">{foodGroups.map((group) => <button type="button" key={group} className={day.foodGroups.includes(group) ? "hf-chip is-active" : "hf-chip"} onClick={() => toggleFoodGroup(group)}>{group}</button>)}</div></section>
            <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Nước</span><h3>{day.waterCups} cốc</h3></div></div><div className="hf-stepper"><button type="button" onClick={() => updateDay((current) => ({ ...current, waterCups: Math.max(0, current.waterCups - 1) }))}>−</button><strong>{day.waterCups}</strong><button type="button" onClick={() => updateDay((current) => ({ ...current, waterCups: Math.min(50, current.waterCups + 1), tasks: { ...current.tasks, water: true } }))}>+</button></div><p className="hf-muted">Đơn vị “cốc” chỉ để ghi nhanh; chưa tự áp một mục tiêu nước giống nhau cho mọi tuổi/cân nặng.</p></section>
          </div>
          <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Nhật ký bữa ăn</span><h3>Ghi món đã ăn</h3></div></div><div className="hf-inline-form"><select value={mealType} onChange={(event) => setMealType(event.target.value as MealEntry["meal"])}><option value="breakfast">Bữa sáng</option><option value="lunch">Bữa trưa</option><option value="snack">Bữa phụ</option><option value="dinner">Bữa tối</option></select><input value={mealText} onChange={(event) => setMealText(event.target.value)} placeholder="Ví dụ: cơm, cá, rau, cam" maxLength={180} /><button className="hf-primary" type="button" onClick={addMeal}>Thêm</button></div>{day.meals.length ? <div className="hf-entry-list">{[...day.meals].reverse().map((entry) => <article key={entry.id}><span>{entry.meal === "breakfast" ? "Sáng" : entry.meal === "lunch" ? "Trưa" : entry.meal === "snack" ? "Phụ" : "Tối"}</span><strong>{entry.text}</strong><button type="button" onClick={() => updateDay((current) => ({ ...current, meals: current.meals.filter((item) => item.id !== entry.id) }))}>Xóa</button></article>)}</div> : <Empty>Chưa ghi bữa ăn cho ngày này.</Empty>}</section>
        </section> : null}

        {active === "activity" ? <section className="hf-section">
          <SectionHeader title="Vận động" description="Ghi loại hoạt động và số phút trong ngày để theo dõi thói quen xuyên suốt 9–18 tuổi." aside={formatDate(dayKey)} />
          <StagePanel stage={profileAge.stage} />
          <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Hoạt động trong ngày</span><h3>Thêm vận động</h3></div><strong className="hf-big-number">{day.activities.reduce((sum, item) => sum + item.minutes, 0)} phút</strong></div><div className="hf-inline-form"><select value={activityType} onChange={(event) => setActivityType(event.target.value)}>{activityTypes.map((item) => <option key={item}>{item}</option>)}</select><input inputMode="numeric" value={activityMinutes} onChange={(event) => setActivityMinutes(event.target.value)} placeholder="Số phút" /><button type="button" className="hf-primary" onClick={addActivity}>Thêm</button></div>{day.activities.length ? <div className="hf-entry-list">{[...day.activities].reverse().map((entry) => <article key={entry.id}><span>{entry.minutes} phút</span><strong>{entry.type}</strong><button type="button" onClick={() => updateDay((current) => ({ ...current, activities: current.activities.filter((item) => item.id !== entry.id) }))}>Xóa</button></article>)}</div> : <Empty>Chưa có hoạt động cho ngày này.</Empty>}</section>
          <section className="hf-panel hf-info-panel"><span className="hf-kicker">Đúng phạm vi 9–18</span><h3>Theo dõi sức khỏe, không phải app gym</h3><p>Ứng dụng ưu tiên tăng trưởng, thể lực và thói quen. Không tự đặt mục tiêu giảm cân, siết cân hoặc hình thể người lớn cho trẻ/vị thành niên.</p></section>
        </section> : null}

        {active === "care" ? <section className="hf-section">
          <SectionHeader title="Chăm sóc" description="Giấc ngủ, răng miệng, mắt & học tập và vệ sinh cá nhân; lớp nội dung sẽ thay đổi dần đến giai đoạn tự quản lý sức khỏe trước đại học." aside={formatDate(dayKey)} />
          <StagePanel stage={profileAge.stage} />
          <div className="hf-module-grid">
            <article className="hf-module-card"><span className="hf-kicker">Giấc ngủ</span><h3>Giờ ngủ & thức dậy</h3><div className="hf-form-grid two"><label>Đi ngủ<input type="time" value={day.sleepStart} onChange={(event) => updateDay((current) => ({ ...current, sleepStart: event.target.value }))} /></label><label>Thức dậy<input type="time" value={day.sleepEnd} onChange={(event) => updateDay((current) => ({ ...current, sleepEnd: event.target.value, tasks: { ...current.tasks, sleep: Boolean(event.target.value) } }))} /></label></div><strong className="hf-card-value">{sleepDuration(day.sleepStart, day.sleepEnd)?.toFixed(1) ?? "—"} giờ</strong><small>Thời lượng được tính từ giờ nhập; đánh giá mục tiêu ngủ theo tuổi sẽ dùng nguồn hướng dẫn riêng.</small></article>
            <article className="hf-module-card"><span className="hf-kicker">Răng miệng</span><h3>Checklist đánh răng</h3><label className="hf-switch-row"><input type="checkbox" checked={day.tasks.teethMorning} onChange={() => toggleTask("teethMorning")} /><span>Sáng</span></label><label className="hf-switch-row"><input type="checkbox" checked={day.tasks.teethEvening} onChange={() => toggleTask("teethEvening")} /><span>Tối</span></label><small>Lịch nha khoa có thể tạo ở mục Nhắc việc.</small></article>
            <article className="hf-module-card"><span className="hf-kicker">Mắt & học tập</span><h3>Lần nghỉ mắt đã ghi</h3><div className="hf-stepper"><button type="button" onClick={() => updateDay((current) => ({ ...current, eyeBreaks: Math.max(0, current.eyeBreaks - 1) }))}>−</button><strong>{day.eyeBreaks}</strong><button type="button" onClick={() => updateDay((current) => ({ ...current, eyeBreaks: Math.min(100, current.eyeBreaks + 1) }))}>+</button></div><small>Chỉ ghi thói quen; không tự chẩn đoán mỏi mắt hoặc tật khúc xạ.</small></article>
            <article className="hf-module-card"><span className="hf-kicker">Vệ sinh & tự chăm sóc</span><h3>Checklist trong ngày</h3><label className="hf-switch-row"><input type="checkbox" checked={day.hygieneDone} onChange={() => updateDay((current) => ({ ...current, hygieneDone: !current.hygieneDone }))} /><span>Đã hoàn thành vệ sinh / tự chăm sóc</span></label><small>Ở nhóm 16–18 tuổi, module này sẽ phát triển dần sang tự quản lý lịch khám, hồ sơ và thuốc theo chỉ định.</small></article>
          </div>
        </section> : null}

        {active === "journal" ? <section className="hf-section">
          <SectionHeader title="Nhật ký" description="Ghi cảm nhận và triệu chứng theo thời gian. Đây không phải công cụ tự chẩn đoán hoặc tự kê đơn." aside={formatDate(dayKey)} />
          <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Cảm nhận</span><h3>Hôm nay cảm thấy</h3></div></div><div className="hf-choice-row">{([['good','Khỏe'],['normal','Bình thường'],['unwell','Không khỏe']] as const).map(([value, label]) => <button type="button" key={value} className={day.feeling === value ? "hf-choice is-active" : "hf-choice"} onClick={() => updateDay((current) => ({ ...current, feeling: value }))}>{label}</button>)}</div></section>
          <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Triệu chứng</span><h3>Ghi nhanh</h3></div></div><div className="hf-chip-grid">{symptoms.map((item) => <button type="button" key={item} className={day.symptoms.includes(item) ? "hf-chip is-active" : "hf-chip"} onClick={() => updateDay((current) => ({ ...current, symptoms: current.symptoms.includes(item) ? current.symptoms.filter((value) => value !== item) : [...current.symptoms, item] }))}>{item}</button>)}</div><label className="hf-textarea-label">Ghi chú<textarea value={day.journalNote} maxLength={1200} onChange={(event) => updateDay((current) => ({ ...current, journalNote: event.target.value }))} placeholder="Diễn biến, thời điểm xuất hiện hoặc điều cần nhớ…" /></label><div className="hf-safety-note"><strong>Khi có dấu hiệu nghiêm trọng hoặc tình trạng xấu đi rõ rệt:</strong> không dựa vào nhật ký để tự xử trí; cần liên hệ cơ sở y tế phù hợp.</div></section>
        </section> : null}

        {active === "profile" ? <section className="hf-section">
          <SectionHeader title="Hồ sơ & nhắc việc" description="Một hồ sơ đi cùng từ 9 đến hết 18 tuổi. Google Calendar là quyền riêng do Trung tâm cấp cho từng thiết bị." aside={device.calendarEnabled ? "Calendar: được cấp" : "Calendar: đang khóa"} />
          <div className="hf-work-grid">
            <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Hồ sơ</span><h3>Thông tin cơ bản</h3></div><span className={profileAge.inScope === false ? "hf-scope-badge is-warning" : "hf-scope-badge"}>{profileAge.text}</span></div><div className="hf-form-grid"><label>Tên / tên gọi<input value={state.profile.name} maxLength={80} onChange={(event) => setState((current) => ({ ...current, profile: { ...current.profile, name: event.target.value } }))} /></label><label>Ngày sinh<input type="date" max={today} value={state.profile.birthDate} onChange={(event) => setState((current) => ({ ...current, profile: { ...current.profile, birthDate: event.target.value } }))} /></label><label>Giới tính dùng cho biểu đồ tăng trưởng<select value={state.profile.sex} onChange={(event) => setState((current) => ({ ...current, profile: { ...current.profile, sex: event.target.value as "male" | "female" | "" } }))}><option value="">Chưa chọn</option><option value="male">Nam</option><option value="female">Nữ</option></select></label></div>{profileAge.inScope === false ? <div className="hf-age-warning">Hồ sơ hiện nằm ngoài phạm vi 9–18 tuổi. Ứng dụng vẫn bảo toàn dữ liệu, nhưng không tự áp khuyến nghị hoặc đánh giá tăng trưởng ngoài phạm vi đã kiểm định.</div> : null}{profileAge.stage ? <div className="hf-local-badge">{profileAge.stage.label}</div> : null}<label className="hf-textarea-label">Ghi chú cần nhớ<textarea value={state.profile.note} maxLength={800} onChange={(event) => setState((current) => ({ ...current, profile: { ...current.profile, note: event.target.value } }))} /></label><div className="hf-local-badge">Chỉ lưu trong trình duyệt hiện tại · không gửi hồ sơ này sang Site Quản trị.</div></section>
            <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Lộ trình 9–18</span><h3>4 giai đoạn liên tục</h3></div></div><div className="hf-entry-list">{HEALTH_AGE_STAGES.map((stage) => <article key={stage.id}><span>{stage.id === profileAge.stage?.id ? "Hiện tại" : "Giai đoạn"}</span><strong>{stage.label}</strong><small>{stage.focus.join(" · ")}</small></article>)}</div></section>
          </div>
          <div className="hf-work-grid">
            <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Thông báo trình duyệt</span><h3>{notificationPermission === "granted" ? "Đã cho phép" : notificationPermission === "denied" ? "Đã bị trình duyệt chặn" : notificationPermission === "unsupported" ? "Không được hỗ trợ" : "Chưa cho phép"}</h3></div></div><p className="hf-muted">Thông báo lặp được kiểm tra khi Web App đang hoạt động. Để nhắc đáng tin cậy khi ứng dụng đóng, dùng file .ics hoặc Calendar.</p><button className="hf-secondary" type="button" disabled={notificationPermission === "unsupported"} onClick={() => void requestNotifications()}>Yêu cầu quyền thông báo</button></section>
            <section className="hf-panel hf-info-panel"><span className="hf-kicker">Chuyển tiếp 16–18</span><h3>Chuẩn bị tự quản lý sức khỏe khi vào đại học</h3><p>Giai đoạn cuối ưu tiên hiểu hồ sơ cá nhân, biết lịch khám/nhắc việc, duy trì thói quen và nhận biết khi nào cần tìm trợ giúp chuyên môn. Quyền truy cập và dữ liệu vẫn tuân theo kiến trúc thiết bị hiện tại.</p></section>
          </div>
          <section className="hf-panel hf-backup-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Sao lưu local-first</span><h3>Xuất / khôi phục dữ liệu thiết bị</h3><p className="hf-muted">Bản 9–18 đọc được cả tệp sao lưu 9–10 cũ. Việc di trú chỉ sao chép sang khóa lưu trữ mới, không xóa dữ liệu cũ.</p></div></div><div className="hf-backup-actions"><button type="button" className="hf-primary" onClick={downloadBackup}>Xuất bản sao JSON</button><label className="hf-file-button">Khôi phục từ bản sao<input type="file" accept="application/json,.json" onChange={(event) => void importBackup(event)} /></label></div>{backupNotice ? <div className="hf-backup-notice" role="status">{backupNotice}</div> : null}</section>
          <section className="hf-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Reminder Engine</span><h3>Tạo nhắc việc</h3></div></div><div className="hf-reminder-form"><input value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder="Ví dụ: Đánh răng buổi tối" maxLength={100} /><select value={reminderCategory} onChange={(event) => setReminderCategory(event.target.value as Reminder["category"])}>{Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><input type="date" value={reminderDate} onChange={(event) => setReminderDate(event.target.value)} /><input type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} /><select value={reminderRepeat} onChange={(event) => setReminderRepeat(event.target.value as Reminder["repeat"])}>{Object.entries(repeatLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button className="hf-primary" type="button" onClick={addReminder}>Thêm nhắc việc</button></div></section>
          <section className="hf-panel hf-list-panel"><div className="hf-panel-head"><div><span className="hf-kicker">Lịch nhắc</span><h3>{state.reminders.length} nhắc việc</h3></div><small>Browser · .ics · Google Calendar</small></div>{state.reminders.length ? <div className="hf-reminder-list">{state.reminders.map((reminder) => <article key={reminder.id} className={reminder.enabled ? "" : "is-disabled"}><div><span>{categoryLabels[reminder.category]}</span><strong>{reminder.title}</strong><small>{formatDate(reminder.date)} · {reminder.time} · {repeatLabels[reminder.repeat]}</small></div><div className="hf-reminder-actions"><button type="button" onClick={() => setState((current) => ({ ...current, reminders: current.reminders.map((item) => item.id === reminder.id ? { ...item, enabled: !item.enabled } : item) }))}>{reminder.enabled ? "Tắt" : "Bật"}</button><button type="button" onClick={() => downloadReminderIcs(reminder)}>Tải .ics</button><button type="button" className={device.calendarEnabled ? "hf-calendar-enabled" : ""} disabled={!device.calendarEnabled} title={device.calendarEnabled ? "Mở Google Calendar" : "Thiết bị chưa được Trung tâm cấp quyền Google Calendar"} onClick={() => openGoogleCalendar(reminder)}>Google Calendar</button><button type="button" onClick={() => setState((current) => ({ ...current, reminders: current.reminders.filter((item) => item.id !== reminder.id) }))}>Xóa</button></div></article>)}</div> : <Empty>Chưa có nhắc việc.</Empty>} {!device.calendarEnabled ? <div className="hf-calendar-lock"><strong>Google Calendar đang bị khóa trên thiết bị này.</strong><span>Chỉ Trung tâm Quản trị có thể cấp quyền; Web App không tự mở khóa.</span></div> : null}</section>
        </section> : null}
      </section>
    </div>

    <nav className="hf-bottom-nav" aria-label="Điều hướng nhanh trên thiết bị nhỏ">{navigation.map((item) => <button key={item.id} type="button" className={active === item.id ? "is-active" : ""} onClick={() => setActive(item.id)}><span>{item.short}</span><strong>{item.label}</strong></button>)}</nav>
  </main>;
}
