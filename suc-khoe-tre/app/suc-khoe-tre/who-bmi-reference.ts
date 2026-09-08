import { HEALTH_EVIDENCE, WHO_BMI_REFERENCE_NOTE } from "./health-evidence";
import {
  WHO_BMI_BOYS_9_18,
  WHO_BMI_GIRLS_9_18,
  WHO_PRODUCT_MAX_MONTH,
  WHO_PRODUCT_MIN_MONTH,
  type WhoLmsRow,
} from "./who-bmi-lms-9-18";

export type ChildSex = "male" | "female";
export type WhoBmiCategory = "severe-thinness" | "thinness" | "reference-range" | "overweight" | "obesity";
export type WhoBmiTone = "critical" | "warning" | "neutral";

const TABLES: Record<ChildSex, Map<number, WhoLmsRow>> = {
  male: new Map(WHO_BMI_BOYS_9_18.map((row) => [row[0], row])),
  female: new Map(WHO_BMI_GIRLS_9_18.map((row) => [row[0], row])),
};

function ymd(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function completedAgeMonths(birthDate: string, measurementDate: string) {
  const birth = ymd(birthDate);
  const measure = ymd(measurementDate);
  if (!birth || !measure) return null;
  const birthOrdinal = Date.UTC(birth.year, birth.month - 1, birth.day);
  const measureOrdinal = Date.UTC(measure.year, measure.month - 1, measure.day);
  if (measureOrdinal < birthOrdinal) return null;
  let months = (measure.year - birth.year) * 12 + measure.month - birth.month;
  if (measure.day < birth.day) months -= 1;
  return Math.max(0, months);
}

export function calculateBmi(heightCm: number, weightKg: number) {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm <= 0 || weightKg <= 0) return null;
  const meters = heightCm / 100;
  return weightKg / (meters * meters);
}

function lmsValueAtZ(row: WhoLmsRow, z: number) {
  const [, l, m, s] = row;
  if (!(m > 0) || !(s > 0)) return null;
  if (Math.abs(l) < 1e-12) return m * Math.exp(s * z);
  const base = 1 + l * s * z;
  if (!(base > 0)) return null;
  return m * Math.pow(base, 1 / l);
}

function lmsRawZ(row: WhoLmsRow, measurement: number) {
  const [, l, m, s] = row;
  if (!(measurement > 0) || !(m > 0) || !(s > 0)) return null;
  if (Math.abs(l) < 1e-12) return Math.log(measurement / m) / s;
  return (Math.pow(measurement / m, l) - 1) / (l * s);
}

// WHO 2007 computation guidance fixes the SD distance beyond ±3 SD to the
// distance between 2 SD and 3 SD instead of extrapolating the LMS tails.
function whoAdjustedZ(row: WhoLmsRow, measurement: number) {
  const raw = lmsRawZ(row, measurement);
  if (raw === null) return null;
  if (raw >= -3 && raw <= 3) return raw;
  if (raw > 3) {
    const at2 = lmsValueAtZ(row, 2);
    const at3 = lmsValueAtZ(row, 3);
    if (at2 === null || at3 === null || at3 <= at2) return raw;
    return 3 + (measurement - at3) / (at3 - at2);
  }
  const atMinus2 = lmsValueAtZ(row, -2);
  const atMinus3 = lmsValueAtZ(row, -3);
  if (atMinus2 === null || atMinus3 === null || atMinus2 <= atMinus3) return raw;
  return -3 + (measurement - atMinus3) / (atMinus2 - atMinus3);
}

function categoryFor(z: number): { category: WhoBmiCategory; label: string; tone: WhoBmiTone } {
  if (z < -3) return { category: "severe-thinness", label: "Dưới ngưỡng gầy nghiêm trọng BMI-for-age WHO", tone: "critical" };
  if (z < -2) return { category: "thinness", label: "Dưới ngưỡng gầy BMI-for-age WHO", tone: "warning" };
  if (z > 2) return { category: "obesity", label: "Vượt ngưỡng béo phì BMI-for-age WHO", tone: "critical" };
  if (z > 1) return { category: "overweight", label: "Vượt ngưỡng thừa cân BMI-for-age WHO", tone: "warning" };
  return { category: "reference-range", label: "Không vượt các ngưỡng gầy/thừa cân WHO", tone: "neutral" };
}

export type WhoBmiAssessment = {
  available: true;
  source: typeof WHO_BMI_REFERENCE_NOTE;
  sourceUrl: string;
  computationUrl: string;
  ageMonths: number;
  bmi: number;
  zScore: number;
  category: WhoBmiCategory;
  categoryLabel: string;
  tone: WhoBmiTone;
  cutoffs: {
    severeThinnessBelow: number;
    thinnessBelow: number;
    overweightAbove: number;
    obesityAbove: number;
  };
} | {
  available: false;
  reason: "missing-birth-date" | "missing-sex" | "invalid-measurement-date" | "outside-9-18-scope" | "invalid-measurement" | "reference-row-missing";
  message: string;
  ageMonths?: number;
};

export function assessWhoBmiForAge(input: {
  birthDate: string;
  measurementDate: string;
  sex: ChildSex | "";
  heightCm: number;
  weightKg: number;
}): WhoBmiAssessment {
  if (!input.birthDate) return { available: false, reason: "missing-birth-date", message: "Cần ngày sinh để tính đúng tuổi theo tháng tại ngày đo." };
  if (!input.sex) return { available: false, reason: "missing-sex", message: "Cần giới tính để chọn đúng bảng BMI-for-age WHO 2007." };
  const ageMonths = completedAgeMonths(input.birthDate, input.measurementDate);
  if (ageMonths === null) return { available: false, reason: "invalid-measurement-date", message: "Ngày sinh hoặc ngày đo chưa hợp lệ." };
  if (ageMonths < WHO_PRODUCT_MIN_MONTH || ageMonths > WHO_PRODUCT_MAX_MONTH) {
    return {
      available: false,
      reason: "outside-9-18-scope",
      ageMonths,
      message: ageMonths < WHO_PRODUCT_MIN_MONTH
        ? `Mốc đo ở ${formatAgeMonths(ageMonths)}, chưa tới phạm vi 9–18 tuổi của ứng dụng.`
        : `Mốc đo ở ${formatAgeMonths(ageMonths)}, đã qua phạm vi đến hết 18 tuổi của ứng dụng. Không tự chuyển sang ngưỡng BMI người lớn.`,
    };
  }
  const bmi = calculateBmi(input.heightCm, input.weightKg);
  if (bmi === null) return { available: false, reason: "invalid-measurement", ageMonths, message: "Chiều cao hoặc cân nặng chưa hợp lệ để tính BMI." };
  const row = TABLES[input.sex].get(ageMonths);
  if (!row) return { available: false, reason: "reference-row-missing", ageMonths, message: "Thiếu dòng tham chiếu WHO tương ứng; ứng dụng không tự nội suy hoặc đoán." };
  const zScore = whoAdjustedZ(row, bmi);
  if (zScore === null || !Number.isFinite(zScore)) return { available: false, reason: "invalid-measurement", ageMonths, message: "Không thể tính z-score từ số đo hiện tại." };
  const classification = categoryFor(zScore);
  const severeThinnessBelow = lmsValueAtZ(row, -3);
  const thinnessBelow = lmsValueAtZ(row, -2);
  const overweightAbove = lmsValueAtZ(row, 1);
  const obesityAbove = lmsValueAtZ(row, 2);
  if ([severeThinnessBelow, thinnessBelow, overweightAbove, obesityAbove].some((value) => value === null)) {
    return { available: false, reason: "invalid-measurement", ageMonths, message: "Không thể dựng ngưỡng tham chiếu cho mốc đo này." };
  }
  return {
    available: true,
    source: WHO_BMI_REFERENCE_NOTE,
    sourceUrl: HEALTH_EVIDENCE.whoBmiForAge.url,
    computationUrl: HEALTH_EVIDENCE.whoZScoreComputation.url,
    ageMonths,
    bmi,
    zScore,
    category: classification.category,
    categoryLabel: classification.label,
    tone: classification.tone,
    cutoffs: {
      severeThinnessBelow: severeThinnessBelow!,
      thinnessBelow: thinnessBelow!,
      overweightAbove: overweightAbove!,
      obesityAbove: obesityAbove!,
    },
  };
}

export function formatAgeMonths(months: number) {
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return `${years} tuổi${remainder ? ` ${remainder} tháng` : ""}`;
}

export function assertWhoBmiReferenceIntegrity() {
  const issues: string[] = [];
  for (const [sex, rows] of Object.entries({ male: WHO_BMI_BOYS_9_18, female: WHO_BMI_GIRLS_9_18 })) {
    if (rows.length !== WHO_PRODUCT_MAX_MONTH - WHO_PRODUCT_MIN_MONTH + 1) issues.push(`${sex}: số dòng không đủ`);
    rows.forEach((row, index) => {
      const expectedMonth = WHO_PRODUCT_MIN_MONTH + index;
      if (row[0] !== expectedMonth) issues.push(`${sex}: thiếu/sai tháng ${expectedMonth}`);
      if (!Number.isFinite(row[1]) || !(row[2] > 0) || !(row[3] > 0)) issues.push(`${sex}: LMS không hợp lệ tại ${row[0]}`);
    });
  }
  return issues;
}
