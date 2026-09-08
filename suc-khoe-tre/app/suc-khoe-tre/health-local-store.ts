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

export const STORAGE_KEY = "suc-khoe-y-te:9-10:v1";

export function todayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function safeDailyRecord(value: unknown): DailyRecord {
  const fallback = createDailyRecord();
  if (!value || typeof value !== "object") return fallback;
  const source = value as Partial<DailyRecord>;
  return {
    ...fallback,
    ...source,
    tasks: { ...fallback.tasks, ...(source.tasks ?? {}) },
    foodGroups: Array.isArray(source.foodGroups) ? source.foodGroups.filter((item): item is string => typeof item === "string").slice(0, 20) : [],
    meals: Array.isArray(source.meals) ? source.meals.slice(-100) : [],
    activities: Array.isArray(source.activities) ? source.activities.slice(-100) : [],
    symptoms: Array.isArray(source.symptoms) ? source.symptoms.filter((item): item is string => typeof item === "string").slice(0, 30) : [],
    waterCups: Math.max(0, Math.min(50, Number(source.waterCups) || 0)),
    eyeBreaks: Math.max(0, Math.min(100, Number(source.eyeBreaks) || 0)),
  };
}

export function normalizeHealthState(value: unknown): HealthLocalState {
  const fallback = createInitialHealthState();
  if (!value || typeof value !== "object") return fallback;
  const source = value as Partial<HealthLocalState>;
  const days: Record<string, DailyRecord> = {};
  if (source.days && typeof source.days === "object") {
    for (const [key, record] of Object.entries(source.days).slice(-730)) days[key] = safeDailyRecord(record);
  }
  return {
    version: 1,
    profile: { ...fallback.profile, ...(source.profile ?? {}) },
    growth: Array.isArray(source.growth) ? source.growth.slice(-500) : [],
    reminders: Array.isArray(source.reminders) ? source.reminders.slice(-200) : [],
    days,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : fallback.updatedAt,
  };
}

export function loadHealthState() {
  if (typeof window === "undefined") return createInitialHealthState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeHealthState(JSON.parse(raw)) : createInitialHealthState();
  } catch {
    return createInitialHealthState();
  }
}

export function saveHealthState(state: HealthLocalState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
  } catch {
    // Giữ ứng dụng hoạt động ngay cả khi trình duyệt chặn localStorage.
  }
}

export function currentDay(state: HealthLocalState, key: string) {
  return state.days[key] ?? createDailyRecord();
}

export function uid(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}
