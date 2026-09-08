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
    focus: [
      "ăn uống & nước",
      "vận động",
      "giấc ngủ",
      "răng miệng & vệ sinh",
      "mắt, tư thế & học đường",
      "an toàn cá nhân",
      "cảm xúc cơ bản",
      "chuẩn bị kiến thức thay đổi cơ thể",
    ],
  },
  {
    id: "preteen",
    label: "11–12 tuổi · Tiền dậy thì",
    shortLabel: "Tiền dậy thì",
    minMonths: 132,
    maxMonths: 155,
    focus: [
      "thay đổi cơ thể",
      "vệ sinh tuổi dậy thì",
      "dinh dưỡng tăng trưởng",
      "vận động & ngủ",
      "cảm xúc & quan hệ bạn bè",
      "an toàn & bắt nạt",
      "sức khỏe số",
      "ranh giới cá nhân",
    ],
  },
  {
    id: "early-adolescent",
    label: "13–15 tuổi · Vị thành niên sớm",
    shortLabel: "Vị thành niên sớm",
    minMonths: 156,
    maxMonths: 191,
    focus: [
      "tăng trưởng tuổi dậy thì",
      "sức khỏe tinh thần",
      "dinh dưỡng & hình ảnh cơ thể",
      "vận động & giấc ngủ",
      "sức khỏe số",
      "quan hệ & đồng thuận",
      "phòng tránh chất gây nghiện/nguy cơ",
      "tăng dần năng lực tự chăm sóc",
    ],
  },
  {
    id: "late-adolescent",
    label: "16–18 tuổi · Vị thành niên muộn / chuẩn bị đại học",
    shortLabel: "Chuẩn bị đại học",
    minMonths: 192,
    maxMonths: 227,
    focus: [
      "tự quản lý sức khỏe",
      "hồ sơ, thuốc & dị ứng",
      "lịch khám & tài liệu",
      "giấc ngủ & stress học tập",
      "sức khỏe tinh thần",
      "quan hệ an toàn & sức khỏe sinh sản",
      "thông tin khẩn cấp khi sống xa nhà",
      "chuyển tiếp sang chăm sóc người lớn",
    ],
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
