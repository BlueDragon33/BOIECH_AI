export type HealthEvidenceSource = {
  id: string;
  organization: string;
  title: string;
  scope: string;
  url: string;
  referenceYear?: number;
  jurisdiction?: "global" | "vietnam" | "united-states" | "other";
  reviewedAt: string;
  reviewDueAt?: string;
};

export const HEALTH_EVIDENCE = {
  whoGrowthReference: {
    id: "who-growth-reference-2007",
    organization: "World Health Organization (WHO)",
    title: "Growth reference data for 5–19 years",
    scope: "Khung tham chiếu tăng trưởng WHO 2007 cho trẻ và vị thành niên 61–228 tháng.",
    url: "https://www.who.int/tools/growth-reference-data-for-5to19-years",
    referenceYear: 2007,
    jurisdiction: "global",
    reviewedAt: "2026-09-08",
    reviewDueAt: "2027-09-08",
  },
  whoBmiForAge: {
    id: "who-bmi-for-age-5-19",
    organization: "World Health Organization (WHO)",
    title: "BMI-for-age (5–19 years)",
    scope: "Bảng LMS/z-score theo tháng và giới tính; các ngưỡng gầy, thừa cân, béo phì.",
    url: "https://www.who.int/toolkits/growth-reference-data-for-5to19-years/indicators/bmi-for-age",
    referenceYear: 2007,
    jurisdiction: "global",
    reviewedAt: "2026-09-08",
    reviewDueAt: "2027-09-08",
  },
  whoZScoreComputation: {
    id: "who-growth-zscore-computation",
    organization: "World Health Organization (WHO)",
    title: "Computation of centiles and z-scores for height-for-age, weight-for-age and BMI-for-age",
    scope: "Công thức LMS và quy tắc mở rộng tuyến tính ở ngoài ±3 SD.",
    url: "https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/computation.pdf",
    referenceYear: 2007,
    jurisdiction: "global",
    reviewedAt: "2026-09-08",
    reviewDueAt: "2027-09-08",
  },
  whoAdolescentHealth: {
    id: "who-adolescent-health",
    organization: "World Health Organization (WHO)",
    title: "Adolescent health",
    scope: "Khung bao quát sức khỏe vị thành niên 10–19 tuổi: phát triển thể chất/tâm lý-xã hội, dinh dưỡng, hoạt động thể lực, chất gây nghiện, sức khỏe sinh sản, môi trường an toàn và tiếp cận dịch vụ.",
    url: "https://www.who.int/health-topics/adolescent-health/",
    jurisdiction: "global",
    reviewedAt: "2026-09-08",
    reviewDueAt: "2027-03-08",
  },
  whoGamaIndicators: {
    id: "who-gama-adolescent-indicators-2024",
    organization: "World Health Organization (WHO) / GAMA",
    title: "The adolescent health indicators recommended by the Global Action for Measurement of Adolescent health",
    scope: "Bộ 47 chỉ số khuyến nghị để tránh bỏ sót các miền sức khỏe vị thành niên khi thiết kế hệ thống theo dõi.",
    url: "https://www.who.int/publications/i/item/9789240092198/",
    referenceYear: 2024,
    jurisdiction: "global",
    reviewedAt: "2026-09-08",
    reviewDueAt: "2027-03-08",
  },
  whoAdolescentMentalHealth: {
    id: "who-adolescent-mental-health-2025",
    organization: "World Health Organization (WHO)",
    title: "Mental health of adolescents",
    scope: "Các yếu tố nguy cơ/bảo vệ và tầm quan trọng của hỗ trợ sức khỏe tâm thần ở trẻ vị thành niên.",
    url: "https://www.who.int/vietnam/news/fact-sheets/detail/adolescent-mental-health",
    referenceYear: 2025,
    jurisdiction: "global",
    reviewedAt: "2026-09-08",
    reviewDueAt: "2027-03-08",
  },
  aapBrightFuturesPeriodicity: {
    id: "aap-bright-futures-periodicity-2025",
    organization: "American Academy of Pediatrics (AAP) / Bright Futures",
    title: "Recommendations for Preventive Pediatric Health Care (Periodicity Schedule)",
    scope: "Nguồn tham chiếu quốc tế để kiểm tra cấu trúc khám/sàng lọc dự phòng theo tuổi; không được dùng làm lịch mặc định cho Việt Nam nếu chưa map sang cấu hình quốc gia.",
    url: "https://www.aap.org/periodicityschedule",
    referenceYear: 2025,
    jurisdiction: "united-states",
    reviewedAt: "2026-09-08",
    reviewDueAt: "2027-03-08",
  },
  vietnamSchoolHealth: {
    id: "vietnam-school-health-monitoring",
    organization: "Bộ Y tế Việt Nam",
    title: "Theo dõi sức khỏe học sinh",
    scope: "Khung y tế học đường gồm theo dõi chiều cao/cân nặng, huyết áp, nhịp tim, thị lực, răng miệng, bất thường và hướng dẫn tự chăm sóc; dùng làm nguồn cấu hình Việt Nam sau khi đối chiếu văn bản còn hiệu lực.",
    url: "https://moh.gov.vn/documents/20182/212437/81711.%20Phu%20luc%20TTLT%2013.2016_PL17_18_19_20.pdf/d85a3ebd-68e1-4547-b5c9-a602a39a2847",
    jurisdiction: "vietnam",
    reviewedAt: "2026-09-08",
    reviewDueAt: "2027-03-08",
  },
  vietnamExpandedImmunization2026: {
    id: "vietnam-expanded-immunization-2026-2028",
    organization: "Bộ Y tế Việt Nam",
    title: "Kế hoạch tiêm chủng mở rộng 2026–2028",
    scope: "Nguồn định hướng cấu hình Việt Nam cho tiêm chủng mở rộng, bao gồm lộ trình bổ sung HPV/phế cầu; lịch cá nhân vẫn phải dựa vào hướng dẫn/chương trình chính thức và hồ sơ từng trẻ.",
    url: "https://moh.gov.vn/en_US/hoat-dong-cua-lanh-dao-bo/-/asset_publisher/k206Q9qkZOqn/content/ke-hoach-tiem-vaccine-phe-cau-va-hpv-trong-tiem-chung-mo-rong",
    referenceYear: 2026,
    jurisdiction: "vietnam",
    reviewedAt: "2026-09-08",
    reviewDueAt: "2027-01-08",
  },
} as const satisfies Record<string, HealthEvidenceSource>;

export const WHO_BMI_REFERENCE_NOTE = "WHO Reference 2007 · BMI-for-age 5–19 years";
