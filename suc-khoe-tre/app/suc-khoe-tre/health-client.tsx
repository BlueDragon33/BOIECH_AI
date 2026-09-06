"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  analyzeHealthSymptoms,
  analyzeHealthTrend,
  HEALTH_SYMPTOMS,
  healthBreathingThreshold,
  type HealthAgeBand,
  type HealthCheckInput,
  type HealthCheckResult,
  type HealthCourseTrend,
  type HealthEpisodeEntry,
  type HealthSymptomKey,
} from "./health-offline-engine";

type Question = {
  q: string;
  options: [string, string, string, string];
  answer: number;
  explain: string;
};
type Lesson = {
  number: string;
  ageBand?: HealthAgeBand;
  title: string;
  summary: string;
  content: { html: string; safety: string[] };
  practice: { steps: string[] };
  analysis: { html: string };
  review: { points: string[] };
  quiz: { questions: Question[] };
};
type Course = {
  schemaVersion: number;
  application: string;
  policyVersion: string;
  reviewedOn: string;
  title: string;
  passScore: number;
  lessons: Record<string, Lesson>;
};
type View =
  "home" | "lesson" | "checker" | "doctor" | "growth" | "care" | "nutrition" | "reminders" | "emergency";
type Tab = "Học" | "Thực hành" | "Phân tích" | "Ôn tập" | "Kiểm tra";
type Profile = {
  id: string;
  nickname: string;
  ageBand: HealthAgeBand;
  ageMonths?: number;
  ageYears?: number;
  sex: "boy" | "girl";
};
type AgeInput = Pick<HealthCheckInput, "ageBand" | "ageMonths" | "ageYears">;
type StoredEpisode = {
  id: string;
  profileId: string;
  name: string;
  createdAt: string;
  entries: HealthEpisodeEntry[];
};
type GrowthRecord = {
  id: string;
  profileId: string;
  date: string;
  weightKg?: number;
  heightCm?: number;
  note: string;
};
type NutritionRecord = {
  id: string;
  profileId: string;
  date: string;
  checks: Record<string, boolean>;
  waterCups: number;
  note: string;
};
type ReminderKind = "nutrition" | "health";
type ReminderRepeat = "none" | "daily" | "weekly";
type ReminderRecord = {
  id: string;
  profileId: string;
  kind: ReminderKind;
  title: string;
  date: string;
  time: string;
  repeat: ReminderRepeat;
  note: string;
};
type DeviceCapabilities = {
  googleCalendar?: boolean;
};
type CapabilityWindow = Window & {
  __CHILD_HEALTH_CAPABILITIES__?: DeviceCapabilities;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const tabs: Tab[] = ["Học", "Thực hành", "Phân tích", "Ôn tập", "Kiểm tra"];
const store = {
  profile: "child-health-profile-v2",
  legacyProfile: "child-health-profile-v1",
  progress: "child-health-progress-v1",
  scores: "child-health-scores-v1",
  episodes: "child-health-episodes-v1",
  growth: "child-health-growth-v1",
  care: "child-health-care-v1",
  nutrition: "child-health-nutrition-v1",
  reminders: "child-health-reminders-v1",
};

function safeJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
function plainRichText(value: string) {
  return value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<[^>]*>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&nbsp;", " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function normalizeProfile(value: Partial<Profile> | null | undefined): Profile {
  if (value?.ageBand === "school5to10")
    return {
      id: value.id || "child-1",
      nickname: value.nickname || "Bé",
      ageBand: "school5to10",
      ageYears: Math.max(5, Math.min(10, Math.round(value.ageYears || 5))),
      sex: value.sex === "girl" ? "girl" : "boy",
    };
  return {
    id: value?.id || "child-1",
    nickname: value?.nickname || "Bé",
    ageBand: "under5",
    ageMonths: Math.max(9, Math.min(60, Math.round(value?.ageMonths || 9))),
    sex: value?.sex === "girl" ? "girl" : "boy",
  };
}
function ageInput(profile: Profile): AgeInput {
  return profile.ageBand === "school5to10"
    ? { ageBand: "school5to10", ageYears: profile.ageYears ?? 5 }
    : { ageBand: "under5", ageMonths: profile.ageMonths ?? 9 };
}
function ageLabel(profile: Profile) {
  return profile.ageBand === "school5to10"
    ? `${profile.ageYears ?? 5} tuổi`
    : `${profile.ageMonths ?? 9} tháng`;
}
function bandLabel(profile: Profile) {
  return profile.ageBand === "school5to10" ? "5–10 tuổi" : "9–60 tháng";
}
function breathThreshold(profile: Profile) {
  return (
    healthBreathingThreshold(profile.ageBand, profile.ageMonths ?? 9) ??
    "Không dùng ngưỡng IMCI 0–5 tuổi; ưu tiên công thở và toàn trạng"
  );
}
function checkerDefault(age: AgeInput): HealthCheckInput {
  return {
    ...age,
    symptoms: [],
    days: 1,
    course: "same",
    intakePercent: 100,
    hoursSinceUrine: 0,
  };
}

function exportLocalBackup(
  profile: Profile,
  progress: Record<string, boolean>,
  scores: Record<string, number>,
  episodes: StoredEpisode[],
  growth: GrowthRecord[],
  care: Record<string, boolean>,
  nutrition: NutritionRecord[],
  reminders: ReminderRecord[],
) {
  const backup = {
    version: 3,
    exportedAt: new Date().toISOString(),
    profile,
    progress,
    scores,
    episodes,
    growth,
    care,
    nutrition,
    reminders,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `suc-khoe-tre-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
function InstallAppButton({ install }: { install: () => void }) {
  return (
    <button
      className="install-fab"
      onClick={install}
      aria-label="Cài ứng dụng Sức khỏe trẻ"
      title="Cài ứng dụng"
    >
      <span aria-hidden="true">⇩</span>
      <b>Cài ứng dụng</b>
    </button>
  );
}
function careItems(profile: Profile) {
  if (profile.ageBand === "school5to10")
    return [
      { id: "school-breakfast", label: "Có bữa sáng và nước lọc phù hợp" },
      {
        id: "school-movement",
        label: "Có thời gian vận động và chơi ngoài màn hình",
      },
      { id: "school-sleep", label: "Giữ giờ ngủ và giờ thức tương đối đều" },
      { id: "school-teeth", label: "Đánh răng buổi sáng và trước khi ngủ" },
      { id: "school-safety", label: "Nhắc lại một quy tắc an toàn hôm nay" },
      { id: "school-feelings", label: "Có thời gian hỏi han cảm xúc của trẻ" },
    ];
  return [
    { id: "young-meal", label: "Bữa ăn có người lớn quan sát và không ép ăn" },
    { id: "young-sleep", label: "Giữ nhịp ngủ và thức phù hợp" },
    { id: "young-play", label: "Có chơi và tương tác trực tiếp" },
    { id: "young-teeth", label: "Vệ sinh răng miệng phù hợp tuổi" },
    {
      id: "young-safety",
      label: "Rà soát nguy cơ hóc, nước, thuốc và hóa chất",
    },
    {
      id: "young-symptoms",
      label: "Ghi lại dấu hiệu sức khỏe bất thường nếu có",
    },
  ];
}


function nutritionItems(profile: Profile) {
  if (profile.ageBand === "school5to10") {
    return [
      { id: "breakfast", label: "Có bữa sáng phù hợp" },
      { id: "water", label: "Ưu tiên nước lọc thay vì đồ uống nhiều đường" },
      { id: "variety", label: "Có rau/quả hoặc thực phẩm đa dạng" },
      { id: "movement", label: "Có vận động phù hợp trong ngày" },
      { id: "teeth", label: "Đánh răng buổi sáng và trước khi ngủ" },
      { id: "no-pressure", label: "Không ép ăn hoặc dùng đồ ăn làm phần thưởng" },
    ];
  }
  const items = [
    { id: "safe-meal", label: "Bữa ăn phù hợp khả năng nhai và có người lớn quan sát" },
    { id: "variety", label: "Có thực phẩm đa dạng phù hợp tuổi" },
    { id: "fluids", label: "Được uống đủ dịch phù hợp tuổi" },
    { id: "no-pressure", label: "Không ép ăn" },
    { id: "teeth", label: "Vệ sinh răng miệng phù hợp tuổi" },
  ];
  if ((profile.ageMonths ?? 9) < 12) {
    items.push({ id: "no-honey", label: "Không dùng mật ong khi trẻ chưa đủ 12 tháng" });
  }
  return items;
}
function localDateInput(value: Date) {
  const pad = (number: number) => String(number).padStart(2, "0");
  return value.getFullYear() + "-" + pad(value.getMonth() + 1) + "-" + pad(value.getDate());
}
function localTimeInput(value: Date) {
  const pad = (number: number) => String(number).padStart(2, "0");
  return pad(value.getHours()) + ":" + pad(value.getMinutes());
}
function calendarCompact(value: Date) {
  const pad = (number: number) => String(number).padStart(2, "0");
  return value.getFullYear() + pad(value.getMonth() + 1) + pad(value.getDate()) + "T" + pad(value.getHours()) + pad(value.getMinutes()) + pad(value.getSeconds());
}
function reminderCalendarParts(reminder: ReminderRecord) {
  const startDate = new Date(reminder.date + "T" + reminder.time + ":00");
  const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
  return { start: calendarCompact(startDate), end: calendarCompact(endDate) };
}
function escapeCalendarText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}
function reminderCalendarUrl(reminder: ReminderRecord) {
  const parts = reminderCalendarParts(reminder);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: reminder.title,
    dates: parts.start + "/" + parts.end,
    details: (reminder.note || "Nhắc chăm sóc sức khỏe cho trẻ.") + "\n\nSức khỏe trẻ · " + (reminder.kind === "nutrition" ? "Dinh dưỡng" : "Chăm sóc sức khỏe"),
  });
  if (reminder.repeat === "daily") params.set("recur", "RRULE:FREQ=DAILY");
  if (reminder.repeat === "weekly") params.set("recur", "RRULE:FREQ=WEEKLY");
  return "https://calendar.google.com/calendar/render?" + params.toString();
}
function downloadReminderIcs(reminder: ReminderRecord) {
  const parts = reminderCalendarParts(reminder);
  const recurrence = reminder.repeat === "daily" ? "RRULE:FREQ=DAILY" : reminder.repeat === "weekly" ? "RRULE:FREQ=WEEKLY" : "";
  const lines = [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Sức khỏe trẻ//Nhắc nhở//VI","BEGIN:VEVENT",
    "UID:" + reminder.id + "@suc-khoe-tre","DTSTAMP:" + calendarCompact(new Date()),
    "DTSTART:" + parts.start,"DTEND:" + parts.end,
    "SUMMARY:" + escapeCalendarText(reminder.title),
    "DESCRIPTION:" + escapeCalendarText(reminder.note || "Nhắc chăm sóc sức khỏe cho trẻ."),
    recurrence,"END:VEVENT","END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const url = URL.createObjectURL(new Blob([lines], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "nhac-suc-khoe-" + reminder.date + ".ics";
  link.click();
  URL.revokeObjectURL(url);
}
function reminderOccursOnDate(reminder: ReminderRecord, date: string) {
  if (date < reminder.date) return false;
  if (reminder.repeat === "none") return date === reminder.date;
  const start = new Date(reminder.date + "T00:00:00").getTime();
  const current = new Date(date + "T00:00:00").getTime();
  const days = Math.round((current - start) / (24 * 60 * 60 * 1000));
  return reminder.repeat === "daily" || days % 7 === 0;
}

export default function HealthClient({
  initialCourse,
}: {
  initialCourse: Course;
}) {
  const [view, setView] = useState<View>("home");
  const [tab, setTab] = useState<Tab>("Học");
  const [profile, setProfile] = useState<Profile>(normalizeProfile(undefined));
  const [lessonNumber, setLessonNumber] = useState("01");
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);
  const [checker, setChecker] = useState<HealthCheckInput>(
    checkerDefault({ ageBand: "under5", ageMonths: 9 }),
  );
  const [checkerResult, setCheckerResult] = useState<HealthCheckResult | null>(
    null,
  );
  const [episodes, setEpisodes] = useState<StoredEpisode[]>([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState("");
  const [growthRecords, setGrowthRecords] = useState<GrowthRecord[]>([]);
  const [care, setCare] = useState<Record<string, boolean>>({});
  const [nutritionRecords, setNutritionRecords] = useState<NutritionRecord[]>([]);
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>({});
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );
  const [episodeEntry, setEpisodeEntry] = useState<HealthEpisodeEntry>({
    ...checkerDefault({ ageBand: "under5", ageMonths: 9 }),
    id: "entry",
    time: new Date().toISOString(),
    coughSeverity: 0,
    energy: 3,
  });
  const allLessons = useMemo(
    () =>
      Object.keys(initialCourse.lessons)
        .sort()
        .map((number) => initialCourse.lessons[number]),
    [initialCourse.lessons],
  );
  const lessons = useMemo(
    () =>
      allLessons.filter(
        (lesson) => (lesson.ageBand ?? "under5") === profile.ageBand,
      ),
    [allLessons, profile.ageBand],
  );
  const currentLesson =
    lessons.find((lesson) => lesson.number === lessonNumber) ?? lessons[0];
  const activeEpisode =
    episodes.find(
      (item) => item.id === activeEpisodeId && item.profileId === profile.id,
    ) ?? null;
  const trend = activeEpisode
    ? analyzeHealthTrend(activeEpisode.entries)
    : { warnings: [], improvements: [] };
  const completion = Math.round(
    (lessons.reduce((sum, lesson) => {
      const completeTabs = tabs.filter((item) =>
        item === "Kiểm tra"
          ? (scores[lesson.number] ?? 0) >= initialCourse.passScore
          : progress[`${lesson.number}:${item}`],
      ).length;
      return sum + completeTabs / tabs.length;
    }, 0) /
      Math.max(1, lessons.length)) *
      100,
  );

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      const loadedProfile = safeJson<Partial<Profile>>(
        localStorage.getItem(store.profile) ??
          localStorage.getItem(store.legacyProfile),
        {},
      );
      const nextProfile = normalizeProfile(loadedProfile);
      const storedEpisodes = safeJson<StoredEpisode[]>(
        localStorage.getItem(store.episodes),
        [],
      );
      setProfile(nextProfile);
      setProgress(
        safeJson<Record<string, boolean>>(
          localStorage.getItem(store.progress),
          {},
        ),
      );
      setScores(
        safeJson<Record<string, number>>(
          localStorage.getItem(store.scores),
          {},
        ),
      );
      setEpisodes(storedEpisodes);
      setGrowthRecords(
        safeJson<GrowthRecord[]>(localStorage.getItem(store.growth), []),
      );
      setCare(
        safeJson<Record<string, boolean>>(localStorage.getItem(store.care), {}),
      );
      setNutritionRecords(
        safeJson<NutritionRecord[]>(localStorage.getItem(store.nutrition), []),
      );
      setReminders(
        safeJson<ReminderRecord[]>(localStorage.getItem(store.reminders), []),
      );
      setCapabilities(
        (window as CapabilityWindow).__CHILD_HEALTH_CAPABILITIES__ ?? {},
      );
      setActiveEpisodeId(
        storedEpisodes.find((item) => item.profileId === nextProfile.id)?.id ??
          "",
      );
      const nextAge = ageInput(nextProfile);
      setChecker(checkerDefault(nextAge));
      setEpisodeEntry({
        ...checkerDefault(nextAge),
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        coughSeverity: 0,
        energy: 3,
      });
      setLessonNumber(
        Object.values(initialCourse.lessons).find(
          (lesson) => (lesson.ageBand ?? "under5") === nextProfile.ageBand,
        )?.number ?? "01",
      );
      setHydrated(true);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [initialCourse.lessons]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(store.profile, JSON.stringify(profile));
  }, [profile, hydrated]);
  useEffect(() => {
    if (hydrated)
      localStorage.setItem(store.progress, JSON.stringify(progress));
  }, [progress, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(store.scores, JSON.stringify(scores));
  }, [scores, hydrated]);
  useEffect(() => {
    if (hydrated)
      localStorage.setItem(store.episodes, JSON.stringify(episodes));
  }, [episodes, hydrated]);
  useEffect(() => {
    if (hydrated)
      localStorage.setItem(store.growth, JSON.stringify(growthRecords));
  }, [growthRecords, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(store.care, JSON.stringify(care));
  }, [care, hydrated]);
  useEffect(() => {
    if (hydrated)
      localStorage.setItem(store.nutrition, JSON.stringify(nutritionRecords));
  }, [nutritionRecords, hydrated]);
  useEffect(() => {
    if (hydrated)
      localStorage.setItem(store.reminders, JSON.stringify(reminders));
  }, [reminders, hydrated]);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    const hadActiveWorker = Boolean(navigator.serviceWorker.controller);
    let reloadingForUpdate = false;
    const onControllerChange = () => {
      if (!hadActiveWorker || reloadingForUpdate) return;
      reloadingForUpdate = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );
    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => undefined);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  function setAge(next: Profile) {
    setProfile(next);
    setLessonNumber(
      Object.values(initialCourse.lessons).find(
        (lesson) => (lesson.ageBand ?? "under5") === next.ageBand,
      )?.number ?? "01",
    );
    const nextAge = ageInput(next);
    setChecker((current) => ({ ...current, ...nextAge }));
    setEpisodeEntry((current) => ({ ...current, ...nextAge }));
    setCheckerResult(null);
    setView("home");
  }
  function changeAgeBand(value: HealthAgeBand) {
    setAge(
      value === "school5to10"
        ? { ...profile, ageBand: value, ageYears: 5, ageMonths: undefined }
        : { ...profile, ageBand: value, ageMonths: 60, ageYears: undefined },
    );
  }
  function changeAge(value: number) {
    if (profile.ageBand === "school5to10")
      setAge({ ...profile, ageYears: Math.max(5, Math.min(10, value || 5)) });
    else
      setAge({ ...profile, ageMonths: Math.max(9, Math.min(60, value || 9)) });
  }
  function selectLesson(number: string) {
    setLessonNumber(number);
    setTab("Học");
    setView("lesson");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function markDone() {
    if (tab !== "Kiểm tra")
      setProgress((current) => ({
        ...current,
        [`${lessonNumber}:${tab}`]: true,
      }));
  }
  function nextTab() {
    const index = tabs.indexOf(tab);
    if (index < tabs.length - 1) setTab(tabs[index + 1]);
  }
  function toggleSymptom(key: HealthSymptomKey, target: "checker" | "episode") {
    const update = (value: HealthCheckInput) => ({
      ...value,
      symptoms: value.symptoms.includes(key)
        ? value.symptoms.filter((item) => item !== key)
        : [...value.symptoms, key],
    });
    if (target === "checker") setChecker(update(checker));
    else setEpisodeEntry((current) => ({ ...current, ...update(current) }));
  }
  function runChecker() {
    setCheckerResult(
      analyzeHealthSymptoms({ ...checker, ...ageInput(profile) }),
    );
  }
  function createEpisode() {
    const created: StoredEpisode = {
      id: crypto.randomUUID(),
      profileId: profile.id,
      name: `Đợt bệnh ${new Date().toLocaleDateString("vi-VN")}`,
      createdAt: new Date().toISOString(),
      entries: [],
    };
    setEpisodes((current) => [created, ...current]);
    setActiveEpisodeId(created.id);
  }
  function saveEpisodeEntry() {
    if (!activeEpisode) return;
    const entry: HealthEpisodeEntry = {
      ...episodeEntry,
      ...ageInput(profile),
      id: crypto.randomUUID(),
      time: new Date().toISOString(),
    };
    setEpisodes((current) =>
      current.map((item) =>
        item.id === activeEpisode.id
          ? { ...item, entries: [...item.entries, entry] }
          : item,
      ),
    );
    setEpisodeEntry({
      ...checkerDefault(ageInput(profile)),
      id: crypto.randomUUID(),
      time: new Date().toISOString(),
      coughSeverity: 0,
      energy: 3,
    });
  }
  function addGrowthRecord(record: Omit<GrowthRecord, "id" | "profileId">) {
    setGrowthRecords((current) => [
      { ...record, id: crypto.randomUUID(), profileId: profile.id },
      ...current,
    ]);
  }
  function addNutritionRecord(
    record: Omit<NutritionRecord, "id" | "profileId">,
  ) {
    setNutritionRecords((current) => [
      { ...record, id: crypto.randomUUID(), profileId: profile.id },
      ...current,
    ]);
  }
  function addReminder(record: Omit<ReminderRecord, "id" | "profileId">) {
    setReminders((current) => [
      { ...record, id: crypto.randomUUID(), profileId: profile.id },
      ...current,
    ]);
  }
  function removeReminder(id: string) {
    setReminders((current) =>
      current.filter((item) => item.id !== id || item.profileId !== profile.id),
    );
  }

  return (
    <main className="health-shell">
      <header className="health-top">
        <div>
          <div className="health-brand">
            <div className="health-logo">SK</div>
            <div>
              <strong>Sức khỏe trẻ 9 tháng–10 tuổi</strong>
              <small>Cẩm nang + theo dõi gia đình Offline</small>
            </div>
          </div>
          <div className="health-top-actions">
            <Link className="health-button" href="/bien-tap-suc-khoe-tre">
              Biên tập
            </Link>
            <button
              className="health-button danger"
              onClick={() => setView("emergency")}
            >
              Cấp cứu
            </button>
          </div>
        </div>
      </header>
      <div className="health-layout">
        <aside className="health-side">
          <section className="health-profile">
            <label>Biệt danh của bé</label>
            <input
              value={profile.nickname}
              maxLength={30}
              onChange={(event) =>
                setProfile({ ...profile, nickname: event.target.value })
              }
            />
            <label>Nhóm tuổi</label>
            <select
              value={profile.ageBand}
              onChange={(event) =>
                changeAgeBand(event.target.value as HealthAgeBand)
              }
            >
              <option value="under5">9 tháng–5 tuổi</option>
              <option value="school5to10">5–10 tuổi</option>
            </select>
            <label>
              {profile.ageBand === "school5to10"
                ? "Tuổi (năm)"
                : "Tuổi (tháng)"}
            </label>
            <input
              type="number"
              min={profile.ageBand === "school5to10" ? 5 : 9}
              max={profile.ageBand === "school5to10" ? 10 : 60}
              value={
                profile.ageBand === "school5to10"
                  ? profile.ageYears
                  : profile.ageMonths
              }
              onChange={(event) => changeAge(Number(event.target.value))}
            />
            <small className="health-muted">
              Đang theo dõi: <strong>{ageLabel(profile)}</strong> · Mốc{" "}
              {bandLabel(profile)}
            </small>
            <label>Giới</label>
            <select
              value={profile.sex}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  sex: event.target.value === "girl" ? "girl" : "boy",
                })
              }
            >
              <option value="boy">Bé trai</option>
              <option value="girl">Bé gái</option>
            </select>
            <div className="health-progress">
              <span style={{ width: `${completion}%` }} />
            </div>
            <small>Tiến độ lộ trình {completion}%</small>
            <button
              className="health-button backup-button"
              onClick={() =>
                exportLocalBackup(
                  profile,
                  progress,
                  scores,
                  episodes,
                  growthRecords,
                  care,
                  nutritionRecords,
                  reminders,
                )
              }
            >
              Tải bản sao lưu
            </button>
          </section>
          <button
            className={"health-button primary pressable " +
              (view === "checker" ? "is-selected" : "")}
            style={{ width: "100%", marginTop: 10 }}
            aria-pressed={view === "checker"}
            onClick={() => setView("checker")}
          >
            AI Offline · Triệu chứng
          </button>
          <button
            className={"health-button pressable " +
              (view === "growth" ? "is-selected" : "")}
            style={{ width: "100%", marginTop: 7 }}
            aria-pressed={view === "growth"}
            onClick={() => setView("growth")}
          >
            Tăng trưởng & hồ sơ
          </button>
          <button
            className={"health-button pressable " +
              (view === "doctor" ? "is-selected" : "")}
            style={{ width: "100%", marginTop: 7 }}
            aria-pressed={view === "doctor"}
            onClick={() => setView("doctor")}
          >
            Nhật ký bệnh & xu hướng
          </button>
          <button
            className={"health-button pressable " +
              (view === "care" ? "is-selected" : "")}
            style={{ width: "100%", marginTop: 7 }}
            aria-pressed={view === "care"}
            onClick={() => setView("care")}
          >
            Chăm sóc sức khỏe
          </button>
          <button
            className={"health-button pressable " +
              (view === "nutrition" ? "is-selected" : "")}
            style={{ width: "100%", marginTop: 7 }}
            aria-pressed={view === "nutrition"}
            onClick={() => setView("nutrition")}
          >
            Dinh dưỡng
          </button>
          <button
            className={"health-button pressable " +
              (view === "reminders" ? "is-selected" : "")}
            style={{ width: "100%", marginTop: 7 }}
            aria-pressed={view === "reminders"}
            onClick={() => setView("reminders")}
          >
            Nhắc nhở
          </button>
          <div className="health-side-title">
            {lessons.length} bài theo nhóm tuổi
          </div>
          <nav className="health-nav">
            {lessons.map((lesson) => (
              <button
                key={lesson.number}
                className={
                  view === "lesson" && lesson.number === lessonNumber
                    ? "active"
                    : ""
                }
                onClick={() => selectLesson(lesson.number)}
              >
                <i>{lesson.number}</i>
                <span>{lesson.title}</span>
                <small>
                  {(scores[lesson.number] ?? 0) >= initialCourse.passScore
                    ? "✓"
                    : ""}
                </small>
              </button>
            ))}
          </nav>
        </aside>
        <section className="health-main">
          {view === "home" ? (
            <Home
              course={initialCourse}
              profile={profile}
              completion={completion}
              lessons={lessons}
              selectLesson={selectLesson}
              openChecker={() => setView("checker")}
              openDoctor={() => setView("doctor")}
              openGrowth={() => setView("growth")}
              openCare={() => setView("care")}
              openNutrition={() => setView("nutrition")}
              openReminders={() => setView("reminders")}
            />
          ) : null}
          {view === "lesson" && currentLesson ? (
            <LessonView
              course={initialCourse}
              lesson={currentLesson}
              tab={tab}
              setTab={setTab}
              markDone={markDone}
              nextTab={nextTab}
              bestScore={scores[currentLesson.number] ?? 0}
              saveScore={(value) =>
                setScores((current) => ({
                  ...current,
                  [currentLesson.number]: Math.max(
                    current[currentLesson.number] ?? 0,
                    value,
                  ),
                }))
              }
            />
          ) : null}
          {view === "checker" ? (
            <Checker
              profile={profile}
              input={checker}
              setInput={setChecker}
              toggle={(key) => toggleSymptom(key, "checker")}
              result={checkerResult}
              run={runChecker}
            />
          ) : null}
          {view === "doctor" ? (
            <Doctor
              profile={profile}
              episodes={episodes.filter(
                (item) => item.profileId === profile.id,
              )}
              active={activeEpisode}
              setActive={setActiveEpisodeId}
              create={createEpisode}
              entry={episodeEntry}
              setEntry={setEpisodeEntry}
              toggle={(key) => toggleSymptom(key, "episode")}
              save={saveEpisodeEntry}
              trend={trend}
            />
          ) : null}
          {view === "growth" ? (
            <Growth
              profile={profile}
              records={growthRecords.filter(
                (item) => item.profileId === profile.id,
              )}
              add={addGrowthRecord}
            />
          ) : null}
          {view === "care" ? (
            <Care
              profile={profile}
              care={care}
              toggle={(id) =>
                setCare((current) => ({
                  ...current,
                  [`${profile.id}:${id}`]: !current[`${profile.id}:${id}`],
                }))
              }
            />
          ) : null}
          {view === "nutrition" ? (
            <Nutrition
              profile={profile}
              records={nutritionRecords.filter(
                (item) => item.profileId === profile.id,
              )}
              add={addNutritionRecord}
            />
          ) : null}
          {view === "reminders" ? (
            <Reminders
              profile={profile}
              reminders={reminders.filter(
                (item) => item.profileId === profile.id,
              )}
              add={addReminder}
              remove={removeReminder}
              googleCalendarEnabled={capabilities.googleCalendar === true}
            />
          ) : null}
          {view === "emergency" ? (
            <Emergency
              profile={profile}
              openChecker={() => setView("checker")}
            />
          ) : null}
        </section>
      </div>
      <nav className="health-mobile">
        <button onClick={() => setView("home")}>Tổng quan</button>
        <button onClick={() => setView("checker")}>Triệu chứng</button>
        <button onClick={() => setView("growth")}>Hồ sơ</button>
        <button onClick={() => setView("care")}>Chăm sóc</button>
        <button onClick={() => setView("nutrition")}>Dinh dưỡng</button>
        <button onClick={() => setView("reminders")}>Nhắc nhở</button>
        <button onClick={() => setView("emergency")}>Cấp cứu</button>
      </nav>
      {installPrompt ? (
        <InstallAppButton
          install={() => {
            void installPrompt.prompt();
            void installPrompt.userChoice.finally(() => setInstallPrompt(null));
          }}
        />
      ) : null}
      <footer className="health-footer">
        Nội dung giáo trình chỉ lấy từ bản đã được Trung tâm quản trị phê duyệt.
        Hồ sơ, triệu chứng, tăng trưởng và nhật ký bệnh của gia đình chỉ lưu
        trong trình duyệt này. Site hỗ trợ ghi nhớ/phân tầng nguy cơ, không thay
        thế khám và chẩn đoán.
      </footer>
    </main>
  );
}

function Home({
  course,
  profile,
  completion,
  lessons,
  selectLesson,
  openChecker,
  openDoctor,
  openGrowth,
  openCare,
  openNutrition,
  openReminders,
}: {
  course: Course;
  profile: Profile;
  completion: number;
  lessons: Lesson[];
  selectLesson: (n: string) => void;
  openChecker: () => void;
  openDoctor: () => void;
  openGrowth: () => void;
  openCare: () => void;
  openNutrition: () => void;
  openReminders: () => void;
}) {
  const memory =
    profile.ageBand === "school5to10"
      ? [
          "Tuổi 5–10 nhập theo năm, không nhập tháng.",
          "Ưu tiên theo dõi công thở, màu môi, tỉnh táo và khả năng nói/uống; không dùng máy móc ngưỡng IMCI 0–5 tuổi.",
          "Giấc ngủ, vận động, màn hình, răng miệng và cảm xúc đều thuộc sức khỏe.",
        ]
      : [
          "Tuổi dưới 5 nhập theo tháng để cá nhân hóa nội dung.",
          profile.ageMonths && profile.ageMonths < 12
            ? "Chưa dùng mật ong, kể cả mật ong hấp quất/chanh."
            : "Từ 12 tháng, mật ong chỉ là thông tin chăm sóc hỗ trợ, không thay khám.",
          "Đếm nhịp thở đủ 60 giây khi trẻ yên và quan sát công thở.",
        ];
  return (
    <>
      <section className="health-hero">
        <span>Nội dung đã kiểm duyệt · {course.reviewedOn}</span>
        <h1>{course.title}</h1>
        <p>
          Chọn đúng nhóm tuổi trước, sau đó dùng lộ trình, sổ theo dõi,
          checklist chăm sóc và công cụ phân tầng nguy cơ phù hợp.
        </p>
        <div className="health-pills">
          <i className="health-pill">{bandLabel(profile)}</i>
          <i className="health-pill">Đang xem: {ageLabel(profile)}</i>
          <i className="health-pill">
            {profile.sex === "boy" ? "Bé trai" : "Bé gái"}
          </i>
          <i className="health-pill">Tiến độ {completion}%</i>
          <i className="health-pill">Policy {course.policyVersion}</i>
        </div>
      </section>
      <div className="health-emergency">
        <strong>Dấu đỏ:</strong> khó thở rõ/rút lõm ngực, tím môi, ngưng thở, co
        giật, li bì/khó đánh thức hoặc không uống được → cần đánh giá y tế khẩn,
        không trì hoãn để thử thuốc tại nhà.
      </div>
      <section className="health-card">
        <h2>Việc cần làm hôm nay</h2>
        <div className="health-grid">
          <button className="health-lesson-card pressable" onClick={openChecker}>
            <small>AI OFFLINE</small>
            <h3>Kiểm tra triệu chứng</h3>
            <p>
              Phân tầng nguy cơ theo nhóm tuổi, dấu đỏ, công thở, SpO₂ nếu có và
              lượng uống.
            </p>
          </button>
          <button className="health-lesson-card pressable" onClick={openGrowth}>
            <small>HỒ SƠ</small>
            <h3>Tăng trưởng & hồ sơ</h3>
            <p>
              Ghi cân nặng, chiều cao, ngày đo và diễn biến để nhìn xu hướng.
            </p>
          </button>
          <button className="health-lesson-card pressable" onClick={openDoctor}>
            <small>NHIỀU NGÀY</small>
            <h3>Nhật ký bệnh</h3>
            <p>
              So sánh diễn biến, phát hiện khi tiếng ho giảm nhưng toàn trạng
              xấu hơn.
            </p>
          </button>
          <button className="health-lesson-card pressable" onClick={openCare}>
            <small>HẰNG NGÀY</small>
            <h3>Checklist chăm sóc</h3>
            <p>
              Đánh dấu các việc về ăn, ngủ, vận động, răng miệng, an toàn và cảm
              xúc.
            </p>
          </button>
          <button className="health-lesson-card pressable" onClick={openNutrition}>
            <small>ĂN UỐNG</small>
            <h3>Dinh dưỡng</h3>
            <p>
              Checklist bữa ăn, nước, đa dạng thực phẩm và răng miệng theo nhóm
              tuổi.
            </p>
          </button>
          <button className="health-lesson-card pressable" onClick={openReminders}>
            <small>NHẮC VIỆC</small>
            <h3>Lịch chăm sóc</h3>
            <p>
              Nhắc dinh dưỡng và chăm sóc sức khỏe, tải lịch hoặc mở Google
              Calendar khi thiết bị được cấp quyền.
            </p>
          </button>
        </div>
      </section>
      <section className="health-card">
        <h2>
          Lộ trình {lessons.length} bài · {bandLabel(profile)}
        </h2>
        <p className="health-muted">
          Nội dung được tách riêng theo nhóm tuổi để không trộn mốc tháng với
          mốc năm.
        </p>
        <div className="health-grid">
          {lessons.map((lesson) => (
            <button
              className="health-lesson-card pressable"
              key={lesson.number}
              onClick={() => selectLesson(lesson.number)}
            >
              <small>Bài {lesson.number}</small>
              <h3>{lesson.title}</h3>
              <p>{lesson.summary}</p>
            </button>
          ))}
        </div>
      </section>
      <section className="health-card">
        <h2>Ghi nhớ theo hồ sơ hiện tại</h2>
        <ul className="health-list">
          {memory.map((item) => (
            <li key={item}>{item}</li>
          ))}
          <li>
            {profile.sex === "boy"
              ? "Bé trai: không cố tuột bao quy đầu chưa tự tách."
              : "Bé gái: vệ sinh nhẹ và dạy lau từ trước ra sau khi đủ tuổi."}
          </li>
        </ul>
      </section>
    </>
  );
}

function LessonView({
  course,
  lesson,
  tab,
  setTab,
  markDone,
  nextTab,
  bestScore,
  saveScore,
}: {
  course: Course;
  lesson: Lesson;
  tab: Tab;
  setTab: (t: Tab) => void;
  markDone: () => void;
  nextTab: () => void;
  bestScore: number;
  saveScore: (n: number) => void;
}) {
  return (
    <section className="health-card">
      <small className="health-muted">
        Bài {lesson.number} ·{" "}
        {lesson.ageBand === "school5to10" ? "5–10 tuổi" : "9 tháng–5 tuổi"}
      </small>
      <h1>{lesson.title}</h1>
      <p className="health-muted">{lesson.summary}</p>
      <div className="health-tabs">
        {tabs.map((item) => (
          <button
            key={item}
            className={item === tab ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "Học" ? (
        <>
          <div className="health-rich">
            {plainRichText(lesson.content.html)}
          </div>
          {lesson.content.safety.map((text) => (
            <div className="health-safety" key={text}>
              {text}
            </div>
          ))}
          <div className="health-action-row">
            <button className="health-button primary" onClick={markDone}>
              Đã học
            </button>
            <button className="health-button" onClick={nextTab}>
              Tiếp: Thực hành
            </button>
          </div>
        </>
      ) : null}
      {tab === "Thực hành" ? (
        <>
          <h3>Checklist thực hành</h3>
          <ol className="health-list">
            {lesson.practice.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="health-action-row">
            <button className="health-button primary" onClick={markDone}>
              Hoàn thành
            </button>
            <button className="health-button" onClick={nextTab}>
              Tiếp: Phân tích
            </button>
          </div>
        </>
      ) : null}
      {tab === "Phân tích" ? (
        <>
          <div className="health-rich">
            {plainRichText(lesson.analysis.html)}
          </div>
          <div className="health-action-row">
            <button className="health-button primary" onClick={markDone}>
              Đã hiểu
            </button>
            <button className="health-button" onClick={nextTab}>
              Tiếp: Ôn tập
            </button>
          </div>
        </>
      ) : null}
      {tab === "Ôn tập" ? (
        <>
          <ul className="health-list">
            {lesson.review.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="health-action-row">
            <button className="health-button primary" onClick={markDone}>
              Hoàn thành ôn tập
            </button>
            <button className="health-button" onClick={nextTab}>
              Làm kiểm tra
            </button>
          </div>
        </>
      ) : null}
      {tab === "Kiểm tra" ? (
        <Quiz
          lesson={lesson}
          passScore={course.passScore}
          bestScore={bestScore}
          saveScore={saveScore}
        />
      ) : null}
    </section>
  );
}

function Quiz({
  lesson,
  passScore,
  bestScore,
  saveScore,
}: {
  lesson: Lesson;
  passScore: number;
  bestScore: number;
  saveScore: (n: number) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<number | null>(null);
  function submit() {
    if (Object.keys(answers).length !== lesson.quiz.questions.length) return;
    const value = lesson.quiz.questions.reduce(
      (sum, q, i) => sum + (answers[i] === q.answer ? 1 : 0),
      0,
    );
    setResult(value);
    saveScore(value);
  }
  return (
    <>
      <h3>Kiểm tra 10 câu · đạt từ {passScore}/10</h3>
      {lesson.quiz.questions.map((q, index) => (
        <article className="health-quiz" key={`${q.q}-${index}`}>
          <strong>
            Câu {index + 1}. {q.q}
          </strong>
          {q.options.map((option, oi) => (
            <label className="health-option" key={option}>
              <input
                type="radio"
                name={`health-q-${lesson.number}-${index}`}
                checked={answers[index] === oi}
                onChange={() => setAnswers({ ...answers, [index]: oi })}
              />{" "}
              {option}
            </label>
          ))}
          {result !== null ? (
            <small className="health-muted">
              {answers[index] === q.answer
                ? "Đúng. "
                : `Đáp án đúng: ${q.options[q.answer]}. `}
              {q.explain}
            </small>
          ) : null}
        </article>
      ))}
      <button
        className="health-button primary"
        onClick={submit}
        disabled={Object.keys(answers).length !== lesson.quiz.questions.length}
      >
        Nộp bài
      </button>
      {result !== null ? (
        <div
          className={`health-score ${result >= passScore ? "pass" : "fail"}`}
        >
          Kết quả {result}/10 · {result >= passScore ? "Đạt" : "Chưa đạt"}. Điểm
          tốt nhất đã lưu: {Math.max(bestScore, result)}/10.
        </div>
      ) : bestScore ? (
        <div
          className={`health-score ${bestScore >= passScore ? "pass" : "fail"}`}
        >
          Điểm tốt nhất: {bestScore}/10.
        </div>
      ) : null}
    </>
  );
}

function Checker({
  profile,
  input,
  setInput,
  toggle,
  result,
  run,
}: {
  profile: Profile;
  input: HealthCheckInput;
  setInput: (v: HealthCheckInput) => void;
  toggle: (k: HealthSymptomKey) => void;
  result: HealthCheckResult | null;
  run: () => void;
}) {
  const groups = [...new Set(HEALTH_SYMPTOMS.map((item) => item.group))];
  return (
    <>
      <section className="health-checker-head">
        <small>AI OFFLINE · DỮ LIỆU KHÔNG GỬI LÊN MÁY CHỦ</small>
        <h1>Kiểm tra triệu chứng</h1>
        <p>
          Hàng rào dấu đỏ chạy trước phần nhận dạng mẫu bệnh. Kết quả là phân
          tầng nguy cơ và định hướng, không phải chẩn đoán chắc chắn.
        </p>
      </section>
      <section className="health-card">
        <h2>Thông tin hiện tại · {ageLabel(profile)}</h2>
        <p className="health-safety">
          {profile.ageBand === "school5to10"
            ? "Nhóm 5–10 tuổi: không dùng ngưỡng thở nhanh IMCI 0–5 tuổi máy móc; quan sát công thở, màu môi, tỉnh táo và khả năng nói/uống."
            : `Nhóm dưới 5 tuổi: ngưỡng tham khảo ${breathThreshold(profile)} khi trẻ ho/khó thở và đang yên.`}
        </p>
        <div className="health-fields">
          <Field label="Ngày bệnh thứ">
            <input
              type="number"
              min={1}
              max={60}
              value={input.days}
              onChange={(e) =>
                setInput({ ...input, days: Number(e.target.value) || 1 })
              }
            />
          </Field>
          <Field label="Diễn biến">
            <select
              value={input.course}
              onChange={(e) =>
                setInput({
                  ...input,
                  course: e.target.value as HealthCourseTrend,
                })
              }
            >
              <option value="same">Không đổi rõ</option>
              <option value="better">Đang đỡ</option>
              <option value="worse">Nặng dần</option>
              <option value="betterThenWorse">Đã đỡ rồi nặng lại</option>
            </select>
          </Field>
          <Field label="Nhiệt độ cao nhất °C">
            <input
              type="number"
              step="0.1"
              placeholder="38.5"
              value={input.temperature || ""}
              onChange={(e) =>
                setInput({
                  ...input,
                  temperature: Number(e.target.value) || undefined,
                })
              }
            />
          </Field>
          <Field label="Nhịp thở/phút">
            <input
              type="number"
              placeholder="Đếm đủ 60 giây lúc yên"
              value={input.respiratoryRate || ""}
              onChange={(e) =>
                setInput({
                  ...input,
                  respiratoryRate: Number(e.target.value) || undefined,
                })
              }
            />
          </Field>
          <Field label="SpO₂ % nếu có">
            <input
              type="number"
              min={50}
              max={100}
              placeholder="Không có thì để trống"
              value={input.spo2 || ""}
              onChange={(e) =>
                setInput({
                  ...input,
                  spo2: Number(e.target.value) || undefined,
                })
              }
            />
          </Field>
          <Field label="Ăn/uống so bình thường %">
            <input
              type="number"
              min={0}
              max={100}
              value={input.intakePercent}
              onChange={(e) =>
                setInput({ ...input, intakePercent: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Số giờ từ lần tiểu cuối">
            <input
              type="number"
              min={0}
              max={48}
              value={input.hoursSinceUrine}
              onChange={(e) =>
                setInput({
                  ...input,
                  hoursSinceUrine: Number(e.target.value) || 0,
                })
              }
            />
          </Field>
        </div>
      </section>
      <section className="health-card">
        <h2>Chọn triệu chứng</h2>
        <div className="health-symptom-groups">
          {groups.map((group) => (
            <div className="health-symptom-group" key={group}>
              <h4>{group}</h4>
              {HEALTH_SYMPTOMS.filter((item) => item.group === group).map(
                (item) => (
                  <label
                    className={`health-symptom ${item.danger ? "danger" : ""}`}
                    key={item.id}
                  >
                    <input
                      type="checkbox"
                      checked={input.symptoms.includes(item.id)}
                      onChange={() => toggle(item.id)}
                    />
                    {item.label}
                  </label>
                ),
              )}
            </div>
          ))}
        </div>
        <button
          className="health-button primary"
          style={{ marginTop: 12 }}
          onClick={run}
        >
          AI offline tổng hợp
        </button>
      </section>
      {result ? <Result result={result} /> : null}
    </>
  );
}

function Result({ result }: { result: HealthCheckResult }) {
  return (
    <section className="health-card">
      <div className={`health-result l${result.level}`}>
        <small>MỨC ƯU TIÊN</small>
        <h2>{result.title}</h2>
        <p>{result.summary}</p>
      </div>
      <div className="health-result-grid">
        <div className="health-result-box">
          <h3>Vì sao?</h3>
          {result.reasons.length ? (
            <ul className="health-list">
              {result.reasons.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>Chưa phát hiện dấu nguy hiểm trong dữ liệu đã nhập.</p>
          )}
        </div>
        <div className="health-result-box">
          <h3>Nên làm gì?</h3>
          <ul className="health-list">
            {result.actions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="health-result-box">
          <h3>Các khả năng cần nghĩ tới</h3>
          {result.patterns.length ? (
            result.patterns.map((item) => (
              <article className="health-rule" key={item.name}>
                <strong>{item.name}</strong>
                <small>{item.strength}</small>
                <ul className="health-list">
                  {item.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </article>
            ))
          ) : (
            <p>Chưa đủ dữ liệu để nhận dạng mẫu bệnh rõ.</p>
          )}
          <small className="health-source-note">Không phải chẩn đoán.</small>
        </div>
        <div className="health-result-box">
          <h3>Không nên tự làm</h3>
          <ul className="health-list">
            {result.avoid.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="health-result-box health-quality-box">
        <strong>Độ đầy đủ dữ liệu: {result.dataQuality}%</strong>
        <div className="health-quality">
          <span style={{ width: `${result.dataQuality}%` }} />
        </div>
        {result.missing.length ? (
          <p className="health-source-note">
            Nên bổ sung: {result.missing.join("; ")}
          </p>
        ) : null}
      </div>
      {result.rules.length ? (
        <div className="health-result-box health-quality-box">
          <h3>Luật an toàn đã kích hoạt</h3>
          {result.rules.map((rule) => (
            <div className="health-rule" key={`${rule.source}-${rule.label}`}>
              <strong>
                {rule.label} · {rule.source}
              </strong>
              <small>{rule.detail}</small>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}


function Nutrition({
  profile,
  records,
  add,
}: {
  profile: Profile;
  records: NutritionRecord[];
  add: (record: Omit<NutritionRecord, "id" | "profileId">) => void;
}) {
  const items = nutritionItems(profile);
  const [date, setDate] = useState(localDateInput(new Date()));
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [water, setWater] = useState("");
  const [note, setNote] = useState("");
  const completed = items.filter((item) => checks[item.id]).length;
  function save() {
    if (!completed && !water && !note.trim()) return;
    add({ date, checks, waterCups: Number(water) || 0, note: note.trim() });
    setChecks({});
    setWater("");
    setNote("");
  }
  return (
    <>
      <section className="health-doctor health-nutrition-hero">
        <small>DINH DƯỠNG · {ageLabel(profile)}</small>
        <h1>Chế độ dinh dưỡng</h1>
        <p>
          Ghi nhanh một ngày ăn uống và thói quen hỗ trợ sức khỏe. Đây là nhật
          ký gia đình, không thay thế tư vấn dinh dưỡng cá nhân.
        </p>
      </section>
      <section className="health-card">
        <h2>Gợi ý theo mốc tuổi</h2>
        <ul className="health-list">
          {profile.ageBand === "school5to10" ? (
            <>
              <li>Ưu tiên bữa ăn đa dạng, nước lọc và giờ ăn tương đối đều.</li>
              <li>Khuyến khích trẻ tự nhận biết đói/no, không ép ăn.</li>
              <li>Đồ ngọt và đồ uống có đường nên là lựa chọn ít thường xuyên.</li>
            </>
          ) : (
            <>
              <li>Điều chỉnh độ thô và kích thước thức ăn theo khả năng của trẻ.</li>
              <li>Luôn có người lớn quan sát khi trẻ ăn, tránh thực phẩm dễ hóc.</li>
              <li>Trẻ dưới 12 tháng không dùng mật ong.</li>
            </>
          )}
        </ul>
      </section>
      <section className="health-card">
        <div className="health-section-heading">
          <div>
            <h2>Ghi hôm nay</h2>
            <p className="health-muted">Đã đánh dấu {completed}/{items.length} mục</p>
          </div>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div className="health-toggle-row">
          {items.map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={Boolean(checks[item.id])}
                onChange={() =>
                  setChecks((current) => ({ ...current, [item.id]: !current[item.id] }))
                }
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        <div className="health-fields" style={{ marginTop: 12 }}>
          <Field label="Nước (cốc, nếu muốn ghi)">
            <input
              type="number"
              min={0}
              step="0.5"
              value={water}
              onChange={(event) => setWater(event.target.value)}
              placeholder="Ví dụ 4"
            />
          </Field>
          <Field label="Ghi chú">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ví dụ: ăn ngon, kém ăn, đau răng, hoạt động bình thường…"
            />
          </Field>
        </div>
        <button
          className="health-button primary pressable"
          style={{ marginTop: 10 }}
          onClick={save}
          disabled={!completed && !water && !note.trim()}
        >
          Lưu nhật ký dinh dưỡng
        </button>
      </section>
      <section className="health-card">
        <h2>Lịch sử dinh dưỡng · {records.length} ngày</h2>
        {records.length ? (
          <div className="health-timeline">
            {records.slice().sort((a, b) => b.date.localeCompare(a.date)).map((record) => (
              <article key={record.id}>
                <strong>
                  {new Date(record.date + "T00:00:00").toLocaleDateString("vi-VN")}
                </strong>
                <p className="health-muted">
                  {record.waterCups ? record.waterCups + " cốc nước · " : ""}
                  {items.filter((item) => record.checks[item.id]).map((item) => item.label).join(" · ") || "Chưa đánh dấu mục nào"}
                  {record.note ? " · " + record.note : ""}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="health-muted">Chưa có nhật ký. Chỉ cần ghi một mục cũng đủ để bắt đầu.</p>
        )}
      </section>
    </>
  );
}
function Reminders({
  profile,
  reminders,
  add,
  remove,
  googleCalendarEnabled,
}: {
  profile: Profile;
  reminders: ReminderRecord[];
  add: (record: Omit<ReminderRecord, "id" | "profileId">) => void;
  remove: (id: string) => void;
  googleCalendarEnabled: boolean;
}) {
  const [kind, setKind] = useState<ReminderKind>("nutrition");
  const [title, setTitle] = useState("Nhắc dinh dưỡng");
  const [date, setDate] = useState(localDateInput(new Date()));
  const [time, setTime] = useState("07:00");
  const [repeat, setRepeat] = useState<ReminderRepeat>("daily");
  const [note, setNote] = useState("");
  const [notificationStatus, setNotificationStatus] = useState<
    "unsupported" | NotificationPermission
  >(() => {
    if (typeof window === "undefined") return "default";
    return "Notification" in window ? Notification.permission : "unsupported";
  });
  const ownReminders = reminders.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  useEffect(() => {
    if (notificationStatus !== "granted") return undefined;
    function notifyDue() {
      const now = new Date();
      const today = localDateInput(now);
      const currentTime = localTimeInput(now);
      ownReminders.forEach((reminder) => {
        if (reminder.time !== currentTime || !reminderOccursOnDate(reminder, today)) return;
        const key = "child-health-notified:" + reminder.id + ":" + today + ":" + currentTime;
        if (sessionStorage.getItem(key)) return;
        new Notification(reminder.title, {
          body: reminder.note || "Đến giờ chăm sóc sức khỏe cho trẻ.",
        });
        sessionStorage.setItem(key, "1");
      });
    }
    notifyDue();
    const timer = window.setInterval(notifyDue, 60000);
    return () => window.clearInterval(timer);
  }, [notificationStatus, ownReminders]);
  function changeKind(next: ReminderKind) {
    setKind(next);
    setTitle(next === "nutrition" ? "Nhắc dinh dưỡng" : "Nhắc chăm sóc sức khỏe");
  }
  async function requestNotification() {
    if (!("Notification" in window)) return;
    setNotificationStatus(await Notification.requestPermission());
  }
  function save() {
    if (!title.trim() || !date || !time) return;
    add({ kind, title: title.trim(), date, time, repeat, note: note.trim() });
    setNote("");
  }
  return (
    <>
      <section className="health-doctor health-reminder-hero">
        <small>NHẮC NHỞ · {ageLabel(profile)}</small>
        <h1>Nhắc dinh dưỡng & chăm sóc sức khỏe</h1>
        <p>
          Tạo nhắc việc trong trình duyệt, tải tệp lịch hoặc mở Google Calendar
          nếu thiết bị đã được Trung tâm quản trị ứng dụng cấp quyền.
        </p>
      </section>
      <section className="health-card">
        <h2>Tạo nhắc mới</h2>
        <div className="health-fields">
          <Field label="Nhóm nhắc">
            <select value={kind} onChange={(event) => changeKind(event.target.value as ReminderKind)}>
              <option value="nutrition">Dinh dưỡng</option>
              <option value="health">Chăm sóc sức khỏe</option>
            </select>
          </Field>
          <Field label="Tiêu đề">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Uống nước, đánh răng, đo nhiệt độ…" />
          </Field>
          <Field label="Ngày bắt đầu">
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Giờ">
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </Field>
          <Field label="Lặp lại">
            <select value={repeat} onChange={(event) => setRepeat(event.target.value as ReminderRepeat)}>
              <option value="none">Không lặp</option>
              <option value="daily">Mỗi ngày</option>
              <option value="weekly">Mỗi tuần</option>
            </select>
          </Field>
        </div>
        <Field label="Ghi chú">
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nội dung sẽ đi kèm thông báo/lịch" />
        </Field>
        <div className="health-calendar-actions">
          <button className="health-button primary pressable" onClick={save}>Thêm nhắc nhở</button>
          {notificationStatus === "granted" ? (
            <span className="health-pill">Thông báo đã bật</span>
          ) : notificationStatus === "unsupported" ? (
            <span className="health-pill">Trình duyệt không hỗ trợ thông báo</span>
          ) : (
            <button className="health-button pressable" onClick={requestNotification}>Bật thông báo trình duyệt</button>
          )}
        </div>
        <div className="health-permission-note">
          {googleCalendarEnabled
            ? "Thiết bị đã được cấp quyền Google Calendar từ Trung tâm quản trị ứng dụng."
            : "Google Calendar đang khóa trên thiết bị này. Bạn vẫn có thể tải .ics; quản trị ứng dụng có thể cấp quyền cho thiết bị được phép."}
        </div>
      </section>
      <section className="health-card">
        <h2>Nhắc đã tạo · {ownReminders.length}</h2>
        {ownReminders.length ? (
          ownReminders.map((reminder) => (
            <article className="health-reminder-item" key={reminder.id}>
              <div>
                <h3>{reminder.title}</h3>
                <p>
                  {reminder.kind === "nutrition" ? "Dinh dưỡng" : "Chăm sóc sức khỏe"}{" "}
                  · {reminder.date} · {reminder.time} ·{" "}
                  {reminder.repeat === "none" ? "một lần" : reminder.repeat === "daily" ? "mỗi ngày" : "mỗi tuần"}
                </p>
                {reminder.note ? <p>{reminder.note}</p> : null}
              </div>
              <div className="health-calendar-actions">
                <button className="health-button pressable" onClick={() => downloadReminderIcs(reminder)}>Tải .ics</button>
                {googleCalendarEnabled ? (
                  <a
                    className="health-button pressable"
                    href={reminderCalendarUrl(reminder)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Calendar
                  </a>
                ) : (
                  <button
                    className="health-button"
                    disabled
                    title="Chỉ thiết bị được Trung tâm quản trị ứng dụng cấp quyền mới dùng Google Calendar"
                  >
                    Google Calendar (khóa)
                  </button>
                )}
                <button className="health-button danger pressable" onClick={() => remove(reminder.id)}>Xóa</button>
              </div>
            </article>
          ))
        ) : (
          <p className="health-muted">
            Chưa có nhắc nhở. Tạo một nhắc cho bữa sáng, uống nước, thuốc đã được kê hoặc lịch chăm sóc.
          </p>
        )}
      </section>
    </>
  );
}

function Emergency({
  profile,
  openChecker,
}: {
  profile: Profile;
  openChecker: () => void;
}) {
  const signs = [
    "Tím môi/mặt hoặc khó thở rõ",
    "Rút lõm ngực mạnh, rên hoặc thở rất gắng sức",
    "Có cơn ngưng thở",
    "Li bì/khó đánh thức",
    "Co giật",
    "Không uống được hoặc nôn mọi thứ kèm dấu mất nước",
    "Ban tím/chấm xuất huyết không mất màu khi ấn",
    "Tình trạng xấu rất nhanh và trẻ khác hẳn thường ngày",
  ];
  return (
    <>
      <section className="health-doctor" style={{ background: "#7d1c14" }}>
        <small>CHẾ ĐỘ KHẨN · {ageLabel(profile)}</small>
        <h1>Dấu hiệu cần xử trí ngay</h1>
        <p>
          Nếu trẻ có dấu đỏ, ưu tiên cấp cứu/đánh giá y tế thay vì tiếp tục thử
          thuốc tại nhà.
        </p>
      </section>
      <section className="health-card">
        <div className="health-grid">
          {signs.map((sign) => (
            <div
              className="health-safety"
              style={{ borderLeftColor: "#b1261b", background: "#fff0ee" }}
              key={sign}
            >
              <strong>{sign}</strong>
            </div>
          ))}
        </div>
        <h3>Khi đang chờ hoặc di chuyển đi khám</h3>
        <ul className="health-list">
          <li>
            Không trì hoãn để tìm thuốc ho, thuốc Đông y, kháng sinh hoặc
            corticoid.
          </li>
          <li>
            Không ép ăn/uống nếu trẻ khó thở nặng, lơ mơ hoặc nôn liên tục.
          </li>
          <li>Mang theo danh sách thuốc đã dùng và thời điểm dùng.</li>
          <li>
            Nếu nghi hóc và trẻ không thể ho/nói/khóc hiệu quả, thực hiện sơ cứu
            đúng lứa tuổi nếu đã được đào tạo và gọi trợ giúp khẩn cấp.
          </li>
        </ul>
        {profile.ageBand === "under5" ? (
          <p>
            <strong>{ageLabel(profile)}:</strong> ngưỡng tham khảo khi ho/khó
            thở là {breathThreshold(profile)}. Một số dấu nguy hiểm có thể xảy
            ra dù SpO₂ máy gia đình trông bình thường.
          </p>
        ) : (
          <p>
            <strong>{bandLabel(profile)}:</strong> không dùng ngưỡng IMCI 0–5
            tuổi máy móc; nhìn công thở, màu môi, tỉnh táo, khả năng nói/uống và
            diễn biến.
          </p>
        )}
        <button className="health-button primary" onClick={openChecker}>
          Mở kiểm tra triệu chứng
        </button>
      </section>
    </>
  );
}

function Growth({
  profile,
  records,
  add,
}: {
  profile: Profile;
  records: GrowthRecord[];
  add: (record: Omit<GrowthRecord, "id" | "profileId">) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [note, setNote] = useState("");
  function save() {
    if (!weight && !height && !note.trim()) return;
    add({
      date,
      weightKg: weight ? Number(weight) : undefined,
      heightCm: height ? Number(height) : undefined,
      note: note.trim(),
    });
    setWeight("");
    setHeight("");
    setNote("");
  }
  return (
    <>
      <section className="health-doctor health-growth-hero">
        <small>HỒ SƠ CỤC BỘ · {bandLabel(profile)}</small>
        <h1>Tăng trưởng & hồ sơ sức khỏe</h1>
        <p>
          Ghi số đo và diễn biến theo ngày để chuẩn bị trao đổi với nhân viên y
          tế. Site không tự chẩn đoán suy dinh dưỡng hay kê sản phẩm tăng
          trưởng.
        </p>
      </section>
      <section className="health-card">
        <h2>Thêm lần ghi</h2>
        <div className="health-fields">
          <Field label="Ngày">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Cân nặng kg">
            <input
              type="number"
              min={0}
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Không bắt buộc"
            />
          </Field>
          <Field label="Chiều cao cm">
            <input
              type="number"
              min={0}
              step="0.1"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="Không bắt buộc"
            />
          </Field>
        </div>
        <Field label="Ghi chú sức khỏe / học tập / vận động">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: ăn kém 2 ngày, ngủ muộn, vận động bình thường…"
          />
        </Field>
        <button
          className="health-button primary"
          style={{ marginTop: 10 }}
          onClick={save}
        >
          Lưu vào hồ sơ
        </button>
      </section>
      <section className="health-card">
        <h2>Diễn biến đã ghi · {records.length} lần</h2>
        {records.length ? (
          <div className="health-timeline">
            {records
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((item) => (
                <article key={item.id}>
                  <strong>
                    {new Date(`${item.date}T00:00:00`).toLocaleDateString(
                      "vi-VN",
                    )}
                  </strong>
                  <p className="health-muted">
                    {item.weightKg ? `${item.weightKg} kg · ` : ""}
                    {item.heightCm ? `${item.heightCm} cm · ` : ""}
                    {item.note || "Không có ghi chú"}
                  </p>
                </article>
              ))}
          </div>
        ) : (
          <p className="health-muted">
            Chưa có số liệu. Bắt đầu bằng một lần ghi đơn giản, không cần đủ mọi
            ô.
          </p>
        )}
      </section>
    </>
  );
}

function Care({
  profile,
  care,
  toggle,
}: {
  profile: Profile;
  care: Record<string, boolean>;
  toggle: (id: string) => void;
}) {
  const items = careItems(profile);
  const completed = items.filter(
    (item) => care[`${profile.id}:${item.id}`],
  ).length;
  return (
    <>
      <section className="health-doctor health-care-hero">
        <small>CHECKLIST HẰNG NGÀY · {ageLabel(profile)}</small>
        <h1>Chăm sóc phù hợp nhóm tuổi</h1>
        <p>
          Đánh dấu những việc đã làm hôm nay. Đây là công cụ nhắc việc, không
          phải bảng chấm điểm cha mẹ.
        </p>
      </section>
      <section className="health-card">
        <div className="health-section-heading">
          <div>
            <h2>Checklist hôm nay</h2>
            <p className="health-muted">
              Đã hoàn thành {completed}/{items.length}
            </p>
          </div>
          <button
            className="health-button"
            onClick={() =>
              items.forEach((item) => {
                if (care[`${profile.id}:${item.id}`]) toggle(item.id);
              })
            }
          >
            Đặt lại
          </button>
        </div>
        <div className="health-checklist">
          {items.map((item) => (
            <label
              className={`health-check-item ${care[`${profile.id}:${item.id}`] ? "done" : ""}`}
              key={item.id}
            >
              <input
                type="checkbox"
                checked={Boolean(care[`${profile.id}:${item.id}`])}
                onChange={() => toggle(item.id)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </section>
      <section className="health-card">
        <h2>Nhắc an toàn</h2>
        <ul className="health-list">
          {profile.ageBand === "school5to10" ? (
            <>
              <li>Biết bơi vẫn không thay thế giám sát gần nước.</li>
              <li>
                Không cho trẻ dùng thuốc của người khác hoặc thuốc còn thừa.
              </li>
              <li>
                Nếu trẻ nói mình không an toàn hoặc có ý nghĩ tự hại, cần ở bên
                và tìm trợ giúp ngay.
              </li>
            </>
          ) : (
            <>
              <li>
                Không để trẻ một mình gần nước, bếp, thuốc, hóa chất hoặc pin
                cúc áo.
              </li>
              <li>
                Không ép ăn; ưu tiên tư thế ăn an toàn và người lớn quan sát.
              </li>
              <li>Mất kỹ năng đã có hoặc khó thở rõ cần được đánh giá y tế.</li>
            </>
          )}
        </ul>
      </section>
    </>
  );
}

function Doctor({
  profile,
  episodes,
  active,
  setActive,
  create,
  entry,
  setEntry,
  toggle,
  save,
  trend,
}: {
  profile: Profile;
  episodes: StoredEpisode[];
  active: StoredEpisode | null;
  setActive: (id: string) => void;
  create: () => void;
  entry: HealthEpisodeEntry;
  setEntry: (v: HealthEpisodeEntry) => void;
  toggle: (k: HealthSymptomKey) => void;
  save: () => void;
  trend: { warnings: string[]; improvements: string[] };
}) {
  const point = active?.entries.length
    ? analyzeHealthSymptoms(active.entries.at(-1)!)
    : null;
  return (
    <>
      <section className="health-doctor">
        <small>100% OFFLINE · {ageLabel(profile)}</small>
        <h1>Nhật ký bệnh & xu hướng</h1>
        <p>
          Ghi cùng một đợt bệnh qua nhiều lần để phát hiện xu hướng thay vì chỉ
          nhìn tiếng ho hoặc sốt ở một thời điểm.
        </p>
      </section>
      <section className="health-card">
        <div className="health-section-heading">
          <div>
            <h2>Đợt bệnh</h2>
            <p className="health-muted">
              Dữ liệu chỉ nằm trên trình duyệt hiện tại.
            </p>
          </div>
          <button className="health-button primary" onClick={create}>
            + Đợt mới
          </button>
        </div>
        {episodes.length ? (
          episodes.map((episode) => (
            <button
              key={episode.id}
              className="health-lesson-card health-wide-button"
              onClick={() => setActive(episode.id)}
            >
              <strong>{episode.name}</strong>
              <p>
                {episode.entries.length} lần theo dõi ·{" "}
                {episode.id === active?.id ? "Đang mở" : "Nhấn để mở"}
              </p>
            </button>
          ))
        ) : (
          <p className="health-muted">
            Chưa có đợt bệnh. Tạo một đợt khi cần ghi diễn biến nhiều ngày.
          </p>
        )}
      </section>
      {active ? (
        <>
          <section className="health-card">
            <h2>Ghi lần theo dõi mới · {profile.nickname}</h2>
            <div className="health-fields">
              <Field label="Ngày bệnh thứ">
                <input
                  type="number"
                  min={1}
                  value={entry.days}
                  onChange={(e) =>
                    setEntry({ ...entry, days: Number(e.target.value) || 1 })
                  }
                />
              </Field>
              <Field label="Nhiệt độ °C">
                <input
                  type="number"
                  step="0.1"
                  value={entry.temperature || ""}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      temperature: Number(e.target.value) || undefined,
                    })
                  }
                />
              </Field>
              <Field label="Nhịp thở/phút">
                <input
                  type="number"
                  value={entry.respiratoryRate || ""}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      respiratoryRate: Number(e.target.value) || undefined,
                    })
                  }
                />
              </Field>
              <Field label="SpO₂ %">
                <input
                  type="number"
                  value={entry.spo2 || ""}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      spo2: Number(e.target.value) || undefined,
                    })
                  }
                />
              </Field>
              <Field label="Ăn/uống %">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={entry.intakePercent}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      intakePercent: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Giờ từ lần tiểu cuối">
                <input
                  type="number"
                  min={0}
                  value={entry.hoursSinceUrine}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      hoursSinceUrine: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <Field label="Mức ho">
                <select
                  value={entry.coughSeverity}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      coughSeverity: Number(e.target.value) as 0 | 1 | 2 | 3,
                    })
                  }
                >
                  <option value={0}>Không ho</option>
                  <option value={1}>Nhẹ</option>
                  <option value={2}>Vừa</option>
                  <option value={3}>Nhiều</option>
                </select>
              </Field>
              <Field label="Toàn trạng">
                <select
                  value={entry.energy}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      energy: Number(e.target.value) as 0 | 1 | 2 | 3,
                    })
                  }
                >
                  <option value={3}>Gần bình thường</option>
                  <option value={2}>Hơi mệt</option>
                  <option value={1}>Mệt rõ</option>
                  <option value={0}>Rất mệt/li bì</option>
                </select>
              </Field>
            </div>
            <details style={{ marginTop: 10 }}>
              <summary>
                <strong>Chọn triệu chứng</strong>
              </summary>
              <div className="health-symptom-groups" style={{ marginTop: 8 }}>
                {[...new Set(HEALTH_SYMPTOMS.map((item) => item.group))].map(
                  (group) => (
                    <div className="health-symptom-group" key={group}>
                      <h4>{group}</h4>
                      {HEALTH_SYMPTOMS.filter(
                        (item) => item.group === group,
                      ).map((item) => (
                        <label
                          className={`health-symptom ${item.danger ? "danger" : ""}`}
                          key={item.id}
                        >
                          <input
                            type="checkbox"
                            checked={entry.symptoms.includes(item.id)}
                            onChange={() => toggle(item.id)}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  ),
                )}
              </div>
            </details>
            <button
              className="health-button primary"
              style={{ marginTop: 10 }}
              onClick={save}
            >
              Lưu và so sánh
            </button>
          </section>
          <section className="health-card">
            <h2>AI xu hướng</h2>
            {trend.warnings.map((warning) => (
              <div className="health-warning" key={warning}>
                {warning}
              </div>
            ))}
            {trend.improvements.length ? (
              <div className="health-result l0">
                <strong>Dấu cải thiện</strong>
                <ul className="health-list">
                  {trend.improvements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {point ? (
              <Result result={point} />
            ) : (
              <p className="health-muted">Chưa có dữ liệu để đánh giá.</p>
            )}
          </section>
          <section className="health-card">
            <h2>Dòng thời gian</h2>
            <div className="health-timeline">
              {[...active.entries].reverse().map((item) => (
                <article key={item.id}>
                  <strong>
                    Ngày bệnh {item.days} ·{" "}
                    {new Date(item.time).toLocaleString("vi-VN")}
                  </strong>
                  <p className="health-muted">
                    {item.temperature ? `${item.temperature}°C · ` : ""}
                    {item.respiratoryRate
                      ? `${item.respiratoryRate} nhịp/phút · `
                      : ""}
                    {item.spo2 ? `SpO₂ ${item.spo2}% · ` : ""}uống{" "}
                    {item.intakePercent}% · mức ho {item.coughSeverity}/3 · năng
                    lượng {item.energy}/3
                  </p>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}

/*
function Emergency({
  profile,
  openChecker,
}: {
  profile: Profile;
  openChecker: () => void;
}) {
  const signs = [
    "Tím môi/mặt hoặc khó thở rõ",
    "Rút lõm ngực mạnh, rên hoặc thở rất gắng sức",
    "Có cơn ngưng thở",
    "Li bì/khó đánh thức",
    "Co giật",
    "Không uống được hoặc nôn mọi thứ kèm dấu mất nước",
    "Ban tím/chấm xuất huyết không mất màu khi ấn",
    "Tình trạng xấu rất nhanh và trẻ khác hẳn thường ngày",
  ];
  return (
    <>
      <section className="health-doctor" style={{ background: "#7d1c14" }}>
        <small>CHẾ ĐỘ KHẨN · {ageLabel(profile)}</small>
        <h1>Dấu hiệu cần xử trí ngay</h1>
        <p>
          Nếu trẻ có dấu đỏ, ưu tiên cấp cứu/đánh giá y tế thay vì tiếp tục thử
          thuốc tại nhà.
        </p>
      </section>
      <section className="health-card">
        <div className="health-grid">
          {signs.map((sign) => (
            <div
              className="health-safety"
              style={{ borderLeftColor: "#b1261b", background: "#fff0ee" }}
              key={sign}
            >
              <strong>{sign}</strong>
            </div>
          ))}
        </div>
        <h3>Khi đang chờ hoặc di chuyển đi khám</h3>
        <ul className="health-list">
          <li>
            Không trì hoãn để tìm thuốc ho, thuốc Đông y, kháng sinh hoặc
            corticoid.
          </li>
          <li>
            Không ép ăn/uống nếu trẻ khó thở nặng, lơ mơ hoặc nôn liên tục.
          </li>
          <li>Mang theo danh sách thuốc đã dùng và thời điểm dùng.</li>
          <li>
            Nếu nghi hóc và trẻ không thể ho/nói/khóc hiệu quả, thực hiện sơ cứu
            đúng lứa tuổi nếu đã được đào tạo và gọi trợ giúp khẩn cấp.
          </li>
        </ul>
        {profile.ageBand === "under5" ? (
          <p>
            <strong>{ageLabel(profile)}:</strong> ngưỡng tham khảo khi ho/khó
            thở là {breathThreshold(profile)}. Một số dấu nguy hiểm có thể xảy
            ra dù SpO₂ máy gia đình trông bình thường.
          </p>
        ) : (
          <p>
            <strong>{bandLabel(profile)}:</strong> không dùng ngưỡng IMCI 0–5
            tuổi máy móc; nhìn công thở, màu môi, tỉnh táo, khả năng nói/uống và
            diễn biến.
          </p>
        )}
        <button className="health-button primary" onClick={openChecker}>
          Mở kiểm tra triệu chứng
        </button>
      </section>
    </>
  );
}
function Growth({
  profile,
  records,
  add,
}: {
  profile: Profile;
  records: GrowthRecord[];
  add: (record: Omit<GrowthRecord, "id" | "profileId">) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [note, setNote] = useState("");
  function save() {
    if (!weight && !height && !note.trim()) return;
    add({
      date,
      weightKg: weight ? Number(weight) : undefined,
      heightCm: height ? Number(height) : undefined,
      note: note.trim(),
    });
    setWeight("");
    setHeight("");
    setNote("");
  }
  return (
    <>
      <section className="health-doctor health-growth-hero">
        <small>HỒ SƠ CỤC BỘ · {bandLabel(profile)}</small>
        <h1>Tăng trưởng & hồ sơ sức khỏe</h1>
        <p>
          Ghi số đo và diễn biến theo ngày để chuẩn bị trao đổi với nhân viên y
          tế. Site không tự chẩn đoán suy dinh dưỡng hay kê sản phẩm tăng
          trưởng.
        </p>
      </section>
      <section className="health-card">
        <h2>Thêm lần ghi</h2>
        <div className="health-fields">
          <Field label="Ngày">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Cân nặng kg">
            <input
              type="number"
              min={0}
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Không bắt buộc"
            />
          </Field>
          <Field label="Chiều cao cm">
            <input
              type="number"
              min={0}
              step="0.1"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="Không bắt buộc"
            />
          </Field>
        </div>
        <Field label="Ghi chú sức khỏe / học tập / vận động">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: ăn kém 2 ngày, ngủ muộn, vận động bình thường…"
          />
        </Field>
        <button
          className="health-button primary"
          style={{ marginTop: 10 }}
          onClick={save}
        >
          Lưu vào hồ sơ
        </button>
      </section>
      <section className="health-card">
        <h2>Diễn biến đã ghi · {records.length} lần</h2>
        {records.length ? (
          <div className="health-timeline">
            {records
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((item) => (
                <article key={item.id}>
                  <strong>
                    {new Date(`${item.date}T00:00:00`).toLocaleDateString(
                      "vi-VN",
                    )}
                  </strong>
                  <p className="health-muted">
                    {item.weightKg ? `${item.weightKg} kg · ` : ""}
                    {item.heightCm ? `${item.heightCm} cm · ` : ""}
                    {item.note || "Không có ghi chú"}
                  </p>
                </article>
              ))}
          </div>
        ) : (
          <p className="health-muted">
            Chưa có số liệu. Bắt đầu bằng một lần ghi đơn giản, không cần đủ mọi
            ô.
          </p>
        )}
      </section>
    </>
  );
}
function Care({
  profile,
  care,
  toggle,
}: {
  profile: Profile;
  care: Record<string, boolean>;
  toggle: (id: string) => void;
}) {
  const items = careItems(profile);
  const completed = items.filter(
    (item) => care[`${profile.id}:${item.id}`],
  ).length;
  return (
    <>
      <section className="health-doctor health-care-hero">
        <small>CHECKLIST HẰNG NGÀY · {ageLabel(profile)}</small>
        <h1>Chăm sóc phù hợp nhóm tuổi</h1>
        <p>
          Đánh dấu những việc đã làm hôm nay. Đây là công cụ nhắc việc, không
          phải bảng chấm điểm cha mẹ.
        </p>
      </section>
      <section className="health-card">
        <div className="health-section-heading">
          <div>
            <h2>Checklist hôm nay</h2>
            <p className="health-muted">
              Đã hoàn thành {completed}/{items.length}
            </p>
          </div>
          <button
            className="health-button"
            onClick={() =>
              items.forEach((item) => {
                if (care[`${profile.id}:${item.id}`]) toggle(item.id);
              })
            }
          >
            Đặt lại
          </button>
        </div>
        <div className="health-checklist">
          {items.map((item) => (
            <label
              className={`health-check-item ${care[`${profile.id}:${item.id}`] ? "done" : ""}`}
              key={item.id}
            >
              <input
                type="checkbox"
                checked={Boolean(care[`${profile.id}:${item.id}`])}
                onChange={() => toggle(item.id)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </section>
      <section className="health-card">
        <h2>Nhắc an toàn</h2>
        <ul className="health-list">
          {profile.ageBand === "school5to10" ? (
            <>
              <li>Biết bơi vẫn không thay thế giám sát gần nước.</li>
              <li>
                Không cho trẻ dùng thuốc của người khác hoặc thuốc còn thừa.
              </li>
              <li>
                Nếu trẻ nói mình không an toàn hoặc có ý nghĩ tự hại, cần ở bên
                và tìm trợ giúp ngay.
              </li>
            </>
          ) : (
            <>
              <li>
                Không để trẻ một mình gần nước, bếp, thuốc, hóa chất hoặc pin
                cúc áo.
              </li>
              <li>
                Không ép ăn; ưu tiên tư thế ăn an toàn và người lớn quan sát.
              </li>
              <li>Mất kỹ năng đã có hoặc khó thở rõ cần được đánh giá y tế.</li>
            </>
          )}
        </ul>
      </section>
    </>
  );
}

function Doctor({
  profile,
  episodes,
  active,
  setActive,
  create,
  entry,
  setEntry,
  toggle,
  save,
  trend,
}: {
  profile: Profile;
  episodes: StoredEpisode[];
  active: StoredEpisode | null;
  setActive: (id: string) => void;
  create: () => void;
  entry: HealthEpisodeEntry;
  setEntry: (v: HealthEpisodeEntry) => void;
  toggle: (k: HealthSymptomKey) => void;
  save: () => void;
  trend: { warnings: string[]; improvements: string[] };
}) {
  const point = active?.entries.length
    ? analyzeHealthSymptoms(active.entries.at(-1)!)
    : null;
  return (
    <>
      <section className="health-doctor">
        <small>100% OFFLINE · {ageLabel(profile)}</small>
        <h1>Nhật ký bệnh & xu hướng</h1>
        <p>
          Ghi cùng một đợt bệnh qua nhiều lần để phát hiện xu hướng thay vì chỉ
          nhìn tiếng ho hoặc sốt ở một thời điểm.
        </p>
      </section>
      <section className="health-card">
        <div className="health-section-heading">
          <div>
            <h2>Đợt bệnh</h2>
            <p className="health-muted">
              Dữ liệu chỉ nằm trên trình duyệt hiện tại.
            </p>
          </div>
          <button className="health-button primary" onClick={create}>
            + Đợt mới
          </button>
        </div>
        {episodes.length ? (
          episodes.map((episode) => (
            <button
              key={episode.id}
              className="health-lesson-card health-wide-button"
              onClick={() => setActive(episode.id)}
            >
              <strong>{episode.name}</strong>
              <p>
                {episode.entries.length} lần theo dõi ·{" "}
                {episode.id === active?.id ? "Đang mở" : "Nhấn để mở"}
              </p>
            </button>
          ))
        ) : (
          <p className="health-muted">
            Chưa có đợt bệnh. Tạo một đợt khi cần ghi diễn biến nhiều ngày.
          </p>
        )}
      </section>
      {active ? (
        <>
          <section className="health-card">
            <h2>Ghi lần theo dõi mới · {profile.nickname}</h2>
            <div className="health-fields">
              <Field label="Ngày bệnh thứ">
                <input
                  type="number"
                  min={1}
                  value={entry.days}
                  onChange={(e) =>
                    setEntry({ ...entry, days: Number(e.target.value) || 1 })
                  }
                />
              </Field>
              <Field label="Nhiệt độ °C">
                <input
                  type="number"
                  step="0.1"
                  value={entry.temperature || ""}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      temperature: Number(e.target.value) || undefined,
                    })
                  }
                />
              </Field>
              <Field label="Nhịp thở/phút">
                <input
                  type="number"
                  value={entry.respiratoryRate || ""}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      respiratoryRate: Number(e.target.value) || undefined,
                    })
                  }
                />
              </Field>
              <Field label="SpO₂ %">
                <input
                  type="number"
                  value={entry.spo2 || ""}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      spo2: Number(e.target.value) || undefined,
                    })
                  }
                />
              </Field>
              <Field label="Ăn/uống %">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={entry.intakePercent}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      intakePercent: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Giờ từ lần tiểu cuối">
                <input
                  type="number"
                  min={0}
                  value={entry.hoursSinceUrine}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      hoursSinceUrine: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <Field label="Mức ho">
                <select
                  value={entry.coughSeverity}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      coughSeverity: Number(e.target.value) as 0 | 1 | 2 | 3,
                    })
                  }
                >
                  <option value={0}>Không ho</option>
                  <option value={1}>Nhẹ</option>
                  <option value={2}>Vừa</option>
                  <option value={3}>Nhiều</option>
                </select>
              </Field>
              <Field label="Toàn trạng">
                <select
                  value={entry.energy}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      energy: Number(e.target.value) as 0 | 1 | 2 | 3,
                    })
                  }
                >
                  <option value={3}>Gần bình thường</option>
                  <option value={2}>Hơi mệt</option>
                  <option value={1}>Mệt rõ</option>
                  <option value={0}>Rất mệt/li bì</option>
                </select>
              </Field>
            </div>
            <details style={{ marginTop: 10 }}>
              <summary>
                <strong>Chọn triệu chứng</strong>
              </summary>
              <div className="health-symptom-groups" style={{ marginTop: 8 }}>
                {[...new Set(HEALTH_SYMPTOMS.map((item) => item.group))].map(
                  (group) => (
                    <div className="health-symptom-group" key={group}>
                      <h4>{group}</h4>
                      {HEALTH_SYMPTOMS.filter(
                        (item) => item.group === group,
                      ).map((item) => (
                        <label
                          className={`health-symptom ${item.danger ? "danger" : ""}`}
                          key={item.id}
                        >
                          <input
                            type="checkbox"
                            checked={entry.symptoms.includes(item.id)}
                            onChange={() => toggle(item.id)}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  ),
                )}
              </div>
            </details>
            <button
              className="health-button primary"
              style={{ marginTop: 10 }}
              onClick={save}
            >
              Lưu và so sánh
            </button>
          </section>
          <section className="health-card">
            <h2>AI xu hướng</h2>
            {trend.warnings.map((warning) => (
              <div className="health-warning" key={warning}>
                {warning}
              </div>
            ))}
            {trend.improvements.length ? (
              <div className="health-result l0">
                <strong>Dấu cải thiện</strong>
                <ul className="health-list">
                  {trend.improvements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {point ? (
              <Result result={point} />
            ) : (
              <p className="health-muted">Chưa có dữ liệu để đánh giá.</p>
            )}
          </section>
          <section className="health-card">
            <h2>Dòng thời gian</h2>
            <div className="health-timeline">
              {[...active.entries].reverse().map((item) => (
                <article key={item.id}>
                  <strong>
                    Ngày bệnh {item.days} ·{" "}
                    {new Date(item.time).toLocaleString("vi-VN")}
                  </strong>
                  <p className="health-muted">
                    {item.temperature ? `${item.temperature}°C · ` : ""}
                    {item.respiratoryRate
                      ? `${item.respiratoryRate} nhịp/phút · `
                      : ""}
                    {item.spo2 ? `SpO₂ ${item.spo2}% · ` : ""}uống{" "}
                    {item.intakePercent}% · mức ho {item.coughSeverity}/3 · năng
                    lượng {item.energy}/3
                  </p>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
function Emergency({
  profile,
  openChecker,
}: {
  profile: Profile;
  openChecker: () => void;
}) {
  const signs = [
    "Tím môi/mặt hoặc khó thở rõ",
    "Rút lõm ngực mạnh, rên hoặc thở rất gắng sức",
    "Có cơn ngưng thở",
    "Li bì/khó đánh thức",
    "Co giật",
    "Không uống được hoặc nôn mọi thứ kèm dấu mất nước",
    "Ban tím/chấm xuất huyết không mất màu khi ấn",
    "Tình trạng xấu rất nhanh và trẻ khác hẳn thường ngày",
  ];
  return (
    <>
      <section className="health-doctor" style={{ background: "#7d1c14" }}>
        <small>CHẾ ĐỘ KHẨN · {ageLabel(profile)}</small>
        <h1>Dấu hiệu cần xử trí ngay</h1>
        <p>
          Nếu trẻ có dấu đỏ, ưu tiên cấp cứu/đánh giá y tế thay vì tiếp tục thử
          thuốc tại nhà.
        </p>
      </section>
      <section className="health-card">
        <div className="health-grid">
          {signs.map((sign) => (
            <div
              className="health-safety"
              style={{ borderLeftColor: "#b1261b", background: "#fff0ee" }}
              key={sign}
            >
              <strong>{sign}</strong>
            </div>
          ))}
        </div>
        <h3>Khi đang chờ hoặc di chuyển đi khám</h3>
        <ul className="health-list">
          <li>
            Không trì hoãn để tìm thuốc ho, thuốc Đông y, kháng sinh hoặc
            corticoid.
          </li>
          <li>
            Không ép ăn/uống nếu trẻ khó thở nặng, lơ mơ hoặc nôn liên tục.
          </li>
          <li>Mang theo danh sách thuốc đã dùng và thời điểm dùng.</li>
          <li>
            Nếu nghi hóc và trẻ không thể ho/nói/khóc hiệu quả, thực hiện sơ cứu
            đúng lứa tuổi nếu đã được đào tạo và gọi trợ giúp khẩn cấp.
          </li>
        </ul>
        {profile.ageBand === "under5" ? (
          <p>
            <strong>{ageLabel(profile)}:</strong> ngưỡng tham khảo khi ho/khó
            thở là {breathThreshold(profile)}. Một số dấu nguy hiểm có thể xảy
            ra dù SpO₂ máy gia đình trông bình thường.
          </p>
        ) : (
          <p>
            <strong>{bandLabel(profile)}:</strong> không dùng ngưỡng IMCI 0–5
            tuổi máy móc; nhìn công thở, màu môi, tỉnh táo, khả năng nói/uống và
            diễn biến.
          </p>
        )}
        <button className="health-button primary" onClick={openChecker}>
          Mở kiểm tra triệu chứng
        </button>
      </section>
    </>
  );
}
function Growth({
  profile,
  records,
  add,
}: {
  profile: Profile;
  records: GrowthRecord[];
  add: (record: Omit<GrowthRecord, "id" | "profileId">) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [note, setNote] = useState("");
  function save() {
    if (!weight && !height && !note.trim()) return;
    add({
      date,
      weightKg: weight ? Number(weight) : undefined,
      heightCm: height ? Number(height) : undefined,
      note: note.trim(),
    });
    setWeight("");
    setHeight("");
    setNote("");
  }
  return (
    <>
      <section className="health-doctor health-growth-hero">
        <small>HỒ SƠ CỤC BỘ · {bandLabel(profile)}</small>
        <h1>Tăng trưởng & hồ sơ sức khỏe</h1>
        <p>
          Ghi số đo và diễn biến theo ngày để chuẩn bị trao đổi với nhân viên y
          tế. Site không tự chẩn đoán suy dinh dưỡng hay kê sản phẩm tăng
          trưởng.
        </p>
      </section>
      <section className="health-card">
        <h2>Thêm lần ghi</h2>
        <div className="health-fields">
          <Field label="Ngày">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Cân nặng kg">
            <input
              type="number"
              min={0}
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Không bắt buộc"
            />
          </Field>
          <Field label="Chiều cao cm">
            <input
              type="number"
              min={0}
              step="0.1"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="Không bắt buộc"
            />
          </Field>
        </div>
        <Field label="Ghi chú sức khỏe / học tập / vận động">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: ăn kém 2 ngày, ngủ muộn, vận động bình thường…"
          />
        </Field>
        <button
          className="health-button primary"
          style={{ marginTop: 10 }}
          onClick={save}
        >
          Lưu vào hồ sơ
        </button>
      </section>
      <section className="health-card">
        <h2>Diễn biến đã ghi · {records.length} lần</h2>
        {records.length ? (
          <div className="health-timeline">
            {records
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((item) => (
                <article key={item.id}>
                  <strong>
                    {new Date(`${item.date}T00:00:00`).toLocaleDateString(
                      "vi-VN",
                    )}
                  </strong>
                  <p className="health-muted">
                    {item.weightKg ? `${item.weightKg} kg · ` : ""}
                    {item.heightCm ? `${item.heightCm} cm · ` : ""}
                    {item.note || "Không có ghi chú"}
                  </p>
                </article>
              ))}
          </div>
        ) : (
          <p className="health-muted">
            Chưa có số liệu. Bắt đầu bằng một lần ghi đơn giản, không cần đủ mọi
            ô.
          </p>
        )}
      </section>
    </>
  );
}
function Care({
  profile,
  care,
  toggle,
}: {
  profile: Profile;
  care: Record<string, boolean>;
  toggle: (id: string) => void;
}) {
  const items = careItems(profile);
  const completed = items.filter(
    (item) => care[`${profile.id}:${item.id}`],
  ).length;
  return (
    <>
      <section className="health-doctor health-care-hero">
        <small>CHECKLIST HẰNG NGÀY · {ageLabel(profile)}</small>
        <h1>Chăm sóc phù hợp nhóm tuổi</h1>
        <p>
          Đánh dấu những việc đã làm hôm nay. Đây là công cụ nhắc việc, không
          phải bảng chấm điểm cha mẹ.
        </p>
      </section>
      <section className="health-card">
        <div className="health-section-heading">
          <div>
            <h2>Checklist hôm nay</h2>
            <p className="health-muted">
              Đã hoàn thành {completed}/{items.length}
            </p>
          </div>
          <button
            className="health-button"
            onClick={() =>
              items.forEach((item) => {
                if (care[`${profile.id}:${item.id}`]) toggle(item.id);
              })
            }
          >
            Đặt lại
          </button>
        </div>
        <div className="health-checklist">
          {items.map((item) => (
            <label
              className={`health-check-item ${care[`${profile.id}:${item.id}`] ? "done" : ""}`}
              key={item.id}
            >
              <input
                type="checkbox"
                checked={Boolean(care[`${profile.id}:${item.id}`])}
                onChange={() => toggle(item.id)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </section>
      <section className="health-card">
        <h2>Nhắc an toàn</h2>
        <ul className="health-list">
          {profile.ageBand === "school5to10" ? (
            <>
              <li>Biết bơi vẫn không thay thế giám sát gần nước.</li>
              <li>
                Không cho trẻ dùng thuốc của người khác hoặc thuốc còn thừa.
              </li>
              <li>
                Nếu trẻ nói mình không an toàn hoặc có ý nghĩ tự hại, cần ở bên
                và tìm trợ giúp ngay.
              </li>
            </>
          ) : (
            <>
              <li>
                Không để trẻ một mình gần nước, bếp, thuốc, hóa chất hoặc pin
                cúc áo.
              </li>
              <li>
                Không ép ăn; ưu tiên tư thế ăn an toàn và người lớn quan sát.
              </li>
              <li>Mất kỹ năng đã có hoặc khó thở rõ cần được đánh giá y tế.</li>
            </>
          )}
        </ul>
      </section>
    </>
  );
}
function Doctor({
  profile,
  episodes,
  active,
  setActive,
  create,
  entry,
  setEntry,
  toggle,
  save,
  trend,
}: {
  profile: Profile;
  episodes: StoredEpisode[];
  active: StoredEpisode | null;
  setActive: (id: string) => void;
  create: () => void;
  entry: HealthEpisodeEntry;
  setEntry: (v: HealthEpisodeEntry) => void;
  toggle: (k: HealthSymptomKey) => void;
  save: () => void;
  trend: { warnings: string[]; improvements: string[] };
}) {
  const point = active?.entries.length
    ? analyzeHealthSymptoms(active.entries.at(-1)!)
    : null;
  return (
    <>
      <section className="health-doctor">
        <small>100% OFFLINE · {ageLabel(profile)}</small>
        <h1>Nhật ký bệnh & xu hướng</h1>
        <p>
          Ghi cùng một đợt bệnh qua nhiều lần để phát hiện xu hướng thay vì chỉ
          nhìn tiếng ho hoặc sốt ở một thời điểm.
        </p>
      </section>
      <section className="health-card">
        <div className="health-section-heading">
          <div>
            <h2>Đợt bệnh</h2>
            <p className="health-muted">
              Dữ liệu chỉ nằm trên trình duyệt hiện tại.
            </p>
          </div>
          <button className="health-button primary" onClick={create}>
            + Đợt mới
          </button>
        </div>
        {episodes.length ? (
          episodes.map((episode) => (
            <button
              key={episode.id}
              className="health-lesson-card health-wide-button"
              onClick={() => setActive(episode.id)}
            >
              <strong>{episode.name}</strong>
              <p>
                {episode.entries.length} lần theo dõi ·{" "}
                {episode.id === active?.id ? "Đang mở" : "Nhấn để mở"}
              </p>
            </button>
          ))
        ) : (
          <p className="health-muted">
            Chưa có đợt bệnh. Tạo một đợt khi cần ghi diễn biến nhiều ngày.
          </p>
        )}
      </section>
      {active ? (
        <>
          <section className="health-card">
            <h2>Ghi lần theo dõi mới · {profile.nickname}</h2>
            <div className="health-fields">
              <Field label="Ngày bệnh thứ">
                <input
                  type="number"
                  min={1}
                  value={entry.days}
                  onChange={(e) =>
                    setEntry({ ...entry, days: Number(e.target.value) || 1 })
                  }
                />
              </Field>
              <Field label="Nhiệt độ °C">
                <input
                  type="number"
                  step="0.1"
                  value={entry.temperature || ""}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      temperature: Number(e.target.value) || undefined,
                    })
                  }
                />
              </Field>
              <Field label="Nhịp thở/phút">
                <input
                  type="number"
                  value={entry.respiratoryRate || ""}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      respiratoryRate: Number(e.target.value) || undefined,
                    })
                  }
                />
              </Field>
              <Field label="SpO₂ %">
                <input
                  type="number"
                  value={entry.spo2 || ""}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      spo2: Number(e.target.value) || undefined,
                    })
                  }
                />
              </Field>
              <Field label="Ăn/uống %">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={entry.intakePercent}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      intakePercent: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Giờ từ lần tiểu cuối">
                <input
                  type="number"
                  min={0}
                  value={entry.hoursSinceUrine}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      hoursSinceUrine: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <Field label="Mức ho">
                <select
                  value={entry.coughSeverity}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      coughSeverity: Number(e.target.value) as 0 | 1 | 2 | 3,
                    })
                  }
                >
                  <option value={0}>Không ho</option>
                  <option value={1}>Nhẹ</option>
                  <option value={2}>Vừa</option>
                  <option value={3}>Nhiều</option>
                </select>
              </Field>
              <Field label="Toàn trạng">
                <select
                  value={entry.energy}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      energy: Number(e.target.value) as 0 | 1 | 2 | 3,
                    })
                  }
                >
                  <option value={3}>Gần bình thường</option>
                  <option value={2}>Hơi mệt</option>
                  <option value={1}>Mệt rõ</option>
                  <option value={0}>Rất mệt/li bì</option>
                </select>
              </Field>
            </div>
            <details style={{ marginTop: 10 }}>
              <summary>
                <strong>Chọn triệu chứng</strong>
              </summary>
              <div className="health-symptom-groups" style={{ marginTop: 8 }}>
                {[...new Set(HEALTH_SYMPTOMS.map((item) => item.group))].map(
                  (group) => (
                    <div className="health-symptom-group" key={group}>
                      <h4>{group}</h4>
                      {HEALTH_SYMPTOMS.filter(
                        (item) => item.group === group,
                      ).map((item) => (
                        <label
                          className={`health-symptom ${item.danger ? "danger" : ""}`}
                          key={item.id}
                        >
                          <input
                            type="checkbox"
                            checked={entry.symptoms.includes(item.id)}
                            onChange={() => toggle(item.id)}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  ),
                )}
              </div>
            </details>
            <button
              className="health-button primary"
              style={{ marginTop: 10 }}
              onClick={save}
            >
              Lưu và so sánh
            </button>
          </section>
          <section className="health-card">
            <h2>AI xu hướng</h2>
            {trend.warnings.map((warning) => (
              <div className="health-warning" key={warning}>
                {warning}
              </div>
            ))}
            {trend.improvements.length ? (
              <div className="health-result l0">
                <strong>Dấu cải thiện</strong>
                <ul className="health-list">
                  {trend.improvements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {point ? (
              <Result result={point} />
            ) : (
              <p className="health-muted">Chưa có dữ liệu để đánh giá.</p>
            )}
          </section>
          <section className="health-card">
            <h2>Dòng thời gian</h2>
            <div className="health-timeline">
              {[...active.entries].reverse().map((item) => (
                <article key={item.id}>
                  <strong>
                    Ngày bệnh {item.days} ·{" "}
                    {new Date(item.time).toLocaleString("vi-VN")}
                  </strong>
                  <p className="health-muted">
                    {item.temperature ? `${item.temperature}°C · ` : ""}
                    {item.respiratoryRate
                      ? `${item.respiratoryRate} nhịp/phút · `
                      : ""}
                    {item.spo2 ? `SpO₂ ${item.spo2}% · ` : ""}uống{" "}
                    {item.intakePercent}% · mức ho {item.coughSeverity}/3 · năng
                    lượng {item.energy}/3
                  </p>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
*/
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="health-field">
      <label>{label}</label>
      {children}
    </div>
  );
}
