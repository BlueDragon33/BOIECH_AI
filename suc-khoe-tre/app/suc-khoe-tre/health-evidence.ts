export type HealthEvidenceSource = {
  id: string;
  organization: string;
  title: string;
  scope: string;
  url: string;
  referenceYear?: number;
  reviewedAt: string;
};

export const HEALTH_EVIDENCE = {
  whoGrowthReference: {
    id: "who-growth-reference-2007",
    organization: "World Health Organization (WHO)",
    title: "Growth reference data for 5–19 years",
    scope: "Khung tham chiếu tăng trưởng WHO 2007 cho trẻ và vị thành niên 61–228 tháng.",
    url: "https://www.who.int/tools/growth-reference-data-for-5to19-years",
    referenceYear: 2007,
    reviewedAt: "2026-09-08",
  },
  whoBmiForAge: {
    id: "who-bmi-for-age-5-19",
    organization: "World Health Organization (WHO)",
    title: "BMI-for-age (5–19 years)",
    scope: "Bảng LMS/z-score theo tháng và giới tính; các ngưỡng gầy, thừa cân, béo phì.",
    url: "https://www.who.int/toolkits/growth-reference-data-for-5to19-years/indicators/bmi-for-age",
    referenceYear: 2007,
    reviewedAt: "2026-09-08",
  },
  whoZScoreComputation: {
    id: "who-growth-zscore-computation",
    organization: "World Health Organization (WHO)",
    title: "Computation of centiles and z-scores for height-for-age, weight-for-age and BMI-for-age",
    scope: "Công thức LMS và quy tắc mở rộng tuyến tính ở ngoài ±3 SD.",
    url: "https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/computation.pdf",
    referenceYear: 2007,
    reviewedAt: "2026-09-08",
  },
} as const satisfies Record<string, HealthEvidenceSource>;

export const WHO_BMI_REFERENCE_NOTE = "WHO Reference 2007 · BMI-for-age 5–19 years";
