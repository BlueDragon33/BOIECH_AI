export type TaskKey = "breakfast" | "water" | "movement" | "teethMorning" | "teethEvening" | "sleep";
export type Feeling = "good" | "normal" | "unwell" | "";
export type ReminderRepeat = "once" | "daily" | "weekdays" | "weekly";

export type HealthProfile = {
  name: string;
  birthDate: string;
  sex: "male" | "female" | "";
  note: string;
};

export type GrowthEntry = {
  id: string;
  date: string;
  heightCm: number;
  weightKg: number;
};

export type MealEntry = {
  id: string;
  meal: "breakfast" | "lunch" | "snack" | "dinner";
  text: string;
  createdAt: string;
};

export type ActivityEntry = {
  id: string;
  type: string;
  minutes: number;
  createdAt: string;
};

export type Reminder = {
  id: string;
  title: string;
  category: "nutrition" | "water" | "activity" | "care" | "growth" | "appointment" | "other";
  date: string;
  time: string;
  repeat: ReminderRepeat;
  enabled: boolean;
  lastNotifiedOccurrence?: string;
};

export type DailyRecord = {
  tasks: Record<TaskKey, boolean>;
  foodGroups: string[];
  waterCups: number;
  meals: MealEntry[];
  activities: ActivityEntry[];
  sleepStart: string;
  sleepEnd: string;
  eyeBreaks: number;
  hygieneDone: boolean;
  feeling: Feeling;
  symptoms: string[];
  journalNote: string;
};

export type HealthLocalState = {
  version: 1;
  profile: HealthProfile;
  growth: GrowthEntry[];
  reminders: Reminder[];
  days: Record<string, DailyRecord>;
  updatedAt: string;
};

export type HealthBackupEnvelope = {
  format: typeof BACKUP_FORMAT;
  exportedAt: string;
  state: HealthLocalState;
};

type LegacyHealthBackupEnvelope = {
  format: typeof LEGACY_BACKUP_FORMAT;
  exportedAt?: string;
  state: HealthLocalState;
};

export const STORAGE_KEY = "suc-khoe-y-te:9-18:v2";
export const LEGACY_STORAGE_KEY = "suc-khoe-y-te:9-10:v1";
export const BACKUP_FORMAT = "suc-khoe-y-te-9-18-backup-v2" as const;
export const LEGACY_BACKUP_FORMAT = "suc-khoe-y-te-9-10-backup-v1" as const;

function cleanString(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function validDateKey(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function todayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDateKey(key: string, days: number) {
  const valid = validDateKey(key);
  if (!valid) return todayKey();
  const date = new Date(`${valid}T12:00:00`);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

export function recentDateKeys(count: number, endKey = todayKey()) {
  const safeCount = Math.max(1, Math.min(31, Math.round(count)));
  return Array.from({ length: safeCount }, (_, index) => shiftDateKey(endKey, index - safeCount + 1));
}

export function createDailyRecord(): DailyRecord {
  return {
    tasks: { breakfast: false, water: false, movement: false, teethMorning: false, teethEvening: false, sleep: false },
    foodGroups: [],
    waterCups: 0,
    meals: [],
    activities: [],
    sleepStart: "",
    sleepEnd: "",
    eyeBreaks: 0,
    hygieneDone: false,
    feeling: "",
    symptoms: [],
    journalNote: "",
  };
}

export function createInitialHealthState(): HealthLocalState {
  return {
    version: 1,
    profile: { name: "", birthDate: "", sex: "", note: "" },
    growth: [],
    reminders: [],
    days: {},
    updatedAt: new Date(0).toISOString(),
  };
}

function safeMeals(value: unknown): MealEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-100).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Partial<MealEntry>;
    const meal = ["breakfast", "lunch", "snack", "dinner"].includes(String(source.meal)) ? source.meal as MealEntry["meal"] : "snack";
    const text = cleanString(source.text, 180).trim();
    if (!text) return [];
    return [{ id: cleanString(source.id, 120) || uid("meal"), meal, text, createdAt: cleanString(source.createdAt, 40) || new Date(0).toISOString() }];
  });
}

function safeActivities(value: unknown): ActivityEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-100).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Partial<ActivityEntry>;
    const type = cleanString(source.type, 80).trim();
    const minutes = Math.max(1, Math.min(600, Math.round(Number(source.minutes) || 0)));
    if (!type || !(minutes > 0)) return [];
    return [{ id: cleanString(source.id, 120) || uid("activity"), type, minutes, createdAt: cleanString(source.createdAt, 40) || new Date(0).toISOString() }];
  });
}

function safeDailyRecord(value: unknown): DailyRecord {
  const fallback = createDailyRecord();
  if (!value || typeof value !== "object") return fallback;
  const source = value as Partial<DailyRecord>;
  const taskSource = source.tasks && typeof source.tasks === "object" ? source.tasks : {};
  return {
    ...fallback,
    tasks: {
      breakfast: taskSource.breakfast === true,
      water: taskSource.water === true,
      movement: taskSource.movement === true,
      teethMorning: taskSource.teethMorning === true,
      teethEvening: taskSource.teethEvening === true,
      sleep: taskSource.sleep === true,
    },
    foodGroups: Array.isArray(source.foodGroups) ? source.foodGroups.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 80)).slice(0, 20) : [],
    waterCups: Math.max(0, Math.min(50, Number(source.waterCups) || 0)),
    meals: safeMeals(source.meals),
    activities: safeActivities(source.activities),
    sleepStart: cleanString(source.sleepStart, 5),
    sleepEnd: cleanString(source.sleepEnd, 5),
    eyeBreaks: Math.max(0, Math.min(100, Number(source.eyeBreaks) || 0)),
    hygieneDone: source.hygieneDone === true,
    feeling: ["good", "normal", "unwell"].includes(String(source.feeling)) ? source.feeling as Feeling : "",
    symptoms: Array.isArray(source.symptoms) ? source.symptoms.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 80)).slice(0, 30) : [],
    journalNote: cleanString(source.journalNote, 1200),
  };
}

function safeGrowth(value: unknown): GrowthEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-500).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Partial<GrowthEntry>;
    const date = validDateKey(source.date);
    const heightCm = Math.round((Number(source.heightCm) || 0) * 10) / 10;
    const weightKg = Math.round((Number(source.weightKg) || 0) * 10) / 10;
    if (!date || !(heightCm > 50 && heightCm < 220) || !(weightKg > 10 && weightKg < 200)) return [];
    return [{ id: cleanString(source.id, 120) || uid("growth"), date, heightCm, weightKg }];
  });
}

function safeReminders(value: unknown): Reminder[] {
  if (!Array.isArray(value)) return [];
  const repeats = ["once", "daily", "weekdays", "weekly"];
  const categories = ["nutrition", "water", "activity", "care", "growth", "appointment", "other"];
  return value.slice(-200).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Partial<Reminder>;
    const title = cleanString(source.title, 100).trim();
    const date = validDateKey(source.date);
    const time = typeof source.time === "string" && /^\d{2}:\d{2}$/.test(source.time) ? source.time : "";
    if (!title || !date || !time) return [];
    return [{
      id: cleanString(source.id, 120) || uid("reminder"),
      title,
      category: categories.includes(String(source.category)) ? source.category as Reminder["category"] : "other",
      date,
      time,
      repeat: repeats.includes(String(source.repeat)) ? source.repeat as ReminderRepeat : "once",
      enabled: source.enabled !== false,
      lastNotifiedOccurrence: cleanString(source.lastNotifiedOccurrence, 50) || undefined,
    }];
  });
}

export function normalizeHealthState(value: unknown): HealthLocalState {
  const fallback = createInitialHealthState();
  if (!value || typeof value !== "object") return fallback;
  const source = value as Partial<HealthLocalState>;
  const profileSource = source.profile && typeof source.profile === "object" ? source.profile as Partial<HealthProfile> : {};
  const days: Record<string, DailyRecord> = {};
  if (source.days && typeof source.days === "object") {
    for (const [key, record] of Object.entries(source.days).slice(-3650)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) days[key] = safeDailyRecord(record);
    }
  }
  return {
    version: 1,
    profile: {
      name: cleanString(profileSource.name, 80),
      birthDate: validDateKey(profileSource.birthDate),
      sex: profileSource.sex === "male" || profileSource.sex === "female" ? profileSource.sex : "",
      note: cleanString(profileSource.note, 800),
    },
    growth: safeGrowth(source.growth),
    reminders: safeReminders(source.reminders),
    days,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt.slice(0, 50) : fallback.updatedAt,
  };
}

function readStoredState(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? normalizeHealthState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function loadHealthState() {
  if (typeof window === "undefined") return createInitialHealthState();
  const current = readStoredState(STORAGE_KEY);
  if (current) return current;

  // One-way, non-destructive migration: copy old 9–10 data to the new 9–18 key.
  // Keep the legacy key untouched so rollback remains possible.
  const legacy = readStoredState(LEGACY_STORAGE_KEY);
  if (legacy) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...legacy, updatedAt: new Date().toISOString() })); } catch { /* localStorage may be blocked */ }
    return legacy;
  }
  return createInitialHealthState();
}

export function saveHealthState(state: HealthLocalState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
  } catch {
    // Giữ ứng dụng hoạt động ngay cả khi trình duyệt chặn localStorage.
  }
}

export function exportHealthBackup(state: HealthLocalState) {
  const envelope: HealthBackupEnvelope = { format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), state: normalizeHealthState(state) };
  return JSON.stringify(envelope, null, 2);
}

export function parseHealthBackup(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Tệp sao lưu không hợp lệ.");
  const source = value as Partial<HealthBackupEnvelope & LegacyHealthBackupEnvelope> & { format?: string; state?: unknown };
  if ((source.format !== BACKUP_FORMAT && source.format !== LEGACY_BACKUP_FORMAT) || !source.state) {
    throw new Error("Không đúng định dạng sao lưu Sức khỏe Y tế được hỗ trợ.");
  }
  return normalizeHealthState(source.state);
}

export function currentDay(state: HealthLocalState, key: string) {
  return state.days[key] ?? createDailyRecord();
}

export function uid(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}
