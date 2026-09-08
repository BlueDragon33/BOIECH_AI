import { HEALTH_EVIDENCE, WHO_BMI_REFERENCE_NOTE } from "./health-evidence";

export type ChildSex = "male" | "female";
export type WhoBmiCategory = "severe-thinness" | "thinness" | "reference-range" | "overweight" | "obesity";
export type WhoBmiTone = "critical" | "warning" | "neutral";

type LmsRow = readonly [month: number, l: number, m: number, s: number];

// WHO Reference 2007, BMI-for-age, monthly LMS values.
// Deliberately scoped to 108–131 completed months because this Web App currently targets ages 9–10.
// Source tables are linked in HEALTH_EVIDENCE.whoBmiForAge.
const BOYS_9_10: readonly LmsRow[] = [
  [108,-1.6318,16.0490,0.10038],[109,-1.6433,16.0781,0.10082],[110,-1.6544,16.1078,0.10126],[111,-1.6651,16.1381,0.10170],
  [112,-1.6753,16.1692,0.10214],[113,-1.6851,16.2009,0.10259],[114,-1.6944,16.2333,0.10303],[115,-1.7032,16.2665,0.10347],
  [116,-1.7116,16.3004,0.10391],[117,-1.7196,16.3351,0.10435],[118,-1.7271,16.3704,0.10478],[119,-1.7341,16.4065,0.10522],
  [120,-1.7407,16.4433,0.10566],[121,-1.7468,16.4807,0.10609],[122,-1.7525,16.5189,0.10652],[123,-1.7578,16.5578,0.10695],
  [124,-1.7626,16.5974,0.10738],[125,-1.7670,16.6376,0.10780],[126,-1.7710,16.6786,0.10823],[127,-1.7745,16.7203,0.10865],
  [128,-1.7777,16.7628,0.10906],[129,-1.7804,16.8059,0.10948],[130,-1.7828,16.8497,0.10989],[131,-1.7847,16.8941,0.11030],
] as const;

const GIRLS_9_10: readonly LmsRow[] = [
  [108,-1.4650,16.0964,0.11816],[109,-1.4688,16.1358,0.11859],[110,-1.4723,16.1759,0.11901],[111,-1.4753,16.2166,0.11943],
  [112,-1.4780,16.2580,0.11985],[113,-1.4803,16.2999,0.12026],[114,-1.4823,16.3425,0.12067],[115,-1.4838,16.3858,0.12108],
  [116,-1.4850,16.4298,0.12148],[117,-1.4859,16.4746,0.12188],[118,-1.4864,16.5200,0.12228],[119,-1.4866,16.5663,0.12268],
  [120,-1.4864,16.6133,0.12307],[121,-1.4859,16.6612,0.12346],[122,-1.4851,16.7100,0.12384],[123,-1.4839,16.7595,0.12422],
  [124,-1.4825,16.8100,0.12460],[125,-1.4807,16.8614,0.12497],[126,-1.4787,16.9136,0.12534],[127,-1.4763,16.9667,0.12571],
  [128,-1.4737,17.0208,0.12607],[129,-1.4708,17.0757,0.12643],[130,-1.4677,17.1316,0.12678],[131,-1.4642,17.1883,0.12713],
] as const;

const TABLES: Record<ChildSex, Map<number, LmsRow>> = {
  male: new Map(BOYS_9_10.map((row) => [row[0], row])),
  female: new Map(GIRLS_9_10.map((row) => [row[0], row])),
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

function lmsValueAtZ(row: LmsRow, z: number) {
  const [, l, m, s] = row;
  const base = 1 + l * s * z;
  if (!(base > 0) || l === 0) return null;
  return m * Math.pow(base, 1 / l);
}

function lmsRawZ(row: LmsRow, measurement: number) {
  const [, l, m, s] = row;
  if (!(measurement > 0) || l === 0 || !(m > 0) || !(s > 0)) return null;
  return (Math.pow(measurement / m, l) - 1) / (l * s);
}

// WHO 2007 computation guidance fixes the SD distance beyond ±3 SD to the
// distance between 2 SD and 3 SD instead of extrapolating the LMS tails.
function whoAdjustedZ(row: LmsRow, measurement: number) {
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
  if (z < -3) return { category: "severe-thinness", label: "Gầy nghiêm trọng theo ngưỡng BMI-for-age WHO", tone: "critical" };
  if (z < -2) return { category: "thinness", label: "Gầy theo ngưỡng BMI-for-age WHO", tone: "warning" };
  if (z > 2) return { category: "obesity", label: "Béo phì theo ngưỡng BMI-for-age WHO", tone: "critical" };
  if (z > 1) return { category: "overweight", label: "Thừa cân theo ngưỡng BMI-for-age WHO", tone: "warning" };
  return { category: "reference-range", label: "Không vượt ngưỡng gầy/thừa cân WHO", tone: "neutral" };
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
  reason: "missing-birth-date" | "missing-sex" | "invalid-measurement-date" | "outside-9-10-reference" | "invalid-measurement";
  message: string;
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
  if (ageMonths < 108 || ageMonths > 131) return { available: false, reason: "outside-9-10-reference", message: `Mốc đo ở ${ageMonths} tháng, ngoài phạm vi 108–131 tháng đã được kiểm định cho phiên bản 9–10 tuổi.` };
  const bmi = calculateBmi(input.heightCm, input.weightKg);
  if (bmi === null) return { available: false, reason: "invalid-measurement", message: "Chiều cao hoặc cân nặng chưa hợp lệ để tính BMI." };
  const row = TABLES[input.sex].get(ageMonths);
  if (!row) return { available: false, reason: "outside-9-10-reference", message: "Chưa có dòng tham chiếu WHO tương ứng với tháng tuổi này." };
  const zScore = whoAdjustedZ(row, bmi);
  if (zScore === null || !Number.isFinite(zScore)) return { available: false, reason: "invalid-measurement", message: "Không thể tính z-score từ số đo hiện tại." };
  const classification = categoryFor(zScore);
  const severeThinnessBelow = lmsValueAtZ(row, -3);
  const thinnessBelow = lmsValueAtZ(row, -2);
  const overweightAbove = lmsValueAtZ(row, 1);
  const obesityAbove = lmsValueAtZ(row, 2);
  if ([severeThinnessBelow, thinnessBelow, overweightAbove, obesityAbove].some((value) => value === null)) {
    return { available: false, reason: "invalid-measurement", message: "Không thể dựng ngưỡng tham chiếu cho mốc đo này." };
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
