import { completedAgeMonths, formatAgeMonths } from "./who-bmi-reference";

export type HealthAgeStageId = "foundation" | "preteen" | "early-adolescent" | "late-adolescent";

export type HealthAgeStage = {
  id: HealthAgeStageId;
  label: string;
  shortLabel: string;
  minMonths: number;
  maxMonths: number;
  focus: readonly string[];
};

export const HEALTH_AGE_STAGES: readonly HealthAgeStage[] = [
  {
    id: "foundation",
    label: "9–10 tuổi · Nền tảng thói quen",
    shortLabel: "Nền tảng",
    minMonths: 108,
    maxMonths: 131,
    focus: ["thói quen ăn uống", "vận động", "răng miệng", "giấc ngủ", "tự chăm sóc cơ bản"],
  },
  {
    id: "preteen",
    label: "11–12 tuổi · Tiền dậy thì",
    shortLabel: "Tiền dậy thì",
    minMonths: 132,
    maxMonths: 155,
    focus: ["thay đổi cơ thể", "dinh dưỡng tăng trưởng", "vận động", "giấc ngủ", "vệ sinh cá nhân"],
  },
  {
    id: "early-adolescent",
    label: "13–15 tuổi · Vị thành niên sớm",
    shortLabel: "Vị thành niên sớm",
    minMonths: 156,
    maxMonths: 191,
    focus: ["tăng trưởng tuổi dậy thì", "sức khỏe tinh thần", "dinh dưỡng", "vận động", "thói quen số"],
  },
  {
    id: "late-adolescent",
    label: "16–18 tuổi · Vị thành niên muộn / chuẩn bị đại học",
    shortLabel: "Chuẩn bị đại học",
    minMonths: 192,
    maxMonths: 227,
    focus: ["tự quản lý sức khỏe", "lịch khám và hồ sơ", "giấc ngủ học tập", "sức khỏe tinh thần", "chuyển tiếp sang chăm sóc người lớn"],
  },
] as const;

export function healthAgeStageForMonths(months: number | null) {
  if (months === null) return null;
  return HEALTH_AGE_STAGES.find((stage) => months >= stage.minMonths && months <= stage.maxMonths) ?? null;
}

export function profileAgeScope(birthDate: string, atDate: string) {
  if (!birthDate) return { months: null, text: "Chưa có ngày sinh", inScope: null as boolean | null, stage: null as HealthAgeStage | null };
  const months = completedAgeMonths(birthDate, atDate);
  if (months === null) return { months: null, text: "Ngày sinh chưa hợp lệ", inScope: null as boolean | null, stage: null as HealthAgeStage | null };
  const stage = healthAgeStageForMonths(months);
  return { months, text: formatAgeMonths(months), inScope: stage !== null, stage };
}
