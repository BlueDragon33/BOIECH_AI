import type { HealthAgeStageId } from "./health-age-scope";
import type { HealthPrivacyLevel } from "./health-domain-catalog";

export type TrackingCadence =
  | "daily"
  | "weekly-summary"
  | "scheduled"
  | "guideline-driven"
  | "event-driven"
  | "on-change"
  | "clinician-directed";

export type TrackingCapture = "self" | "caregiver" | "device" | "school-record" | "clinical-record" | "mixed";
export type TrackingImportance = "core" | "recommended" | "optional" | "only-when-relevant";

export type HealthTrackingItem = {
  id: string;
  domainId: string;
  title: string;
  stages: readonly HealthAgeStageId[];
  cadence: TrackingCadence;
  capture: TrackingCapture;
  importance: TrackingImportance;
  privacy: HealthPrivacyLevel;
  evidenceRequiredForAlerts: boolean;
  purpose: string;
};

const allStages: readonly HealthAgeStageId[] = ["foundation", "preteen", "early-adolescent", "late-adolescent"];

export const HEALTH_TRACKING_ITEMS: readonly HealthTrackingItem[] = [
  { id: "profile-age-stage", domainId: "growth-development", title: "Ngày sinh / tuổi theo tháng / giai đoạn", stages: allStages, cadence: "on-change", capture: "caregiver", importance: "core", privacy: "sensitive", evidenceRequiredForAlerts: false, purpose: "Làm mốc cho mọi rule phụ thuộc tuổi và tránh dùng tuổi hiện tại cho dữ liệu lịch sử." },
  { id: "growth-height-weight", domainId: "growth-development", title: "Chiều cao & cân nặng", stages: allStages, cadence: "scheduled", capture: "mixed", importance: "core", privacy: "sensitive", evidenceRequiredForAlerts: true, purpose: "Theo dõi xu hướng tăng trưởng; không cần ghi hằng ngày." },
  { id: "growth-bmi-age", domainId: "growth-development", title: "BMI-for-age / z-score", stages: allStages, cadence: "scheduled", capture: "device", importance: "core", privacy: "sensitive", evidenceRequiredForAlerts: true, purpose: "Tính từ số đo có nguồn và tuổi tại ngày đo theo chuẩn được kiểm định." },
  { id: "vitals-school-clinic", domainId: "vital-signs-screening-results", title: "Huyết áp, nhịp tim và dấu hiệu sinh tồn khi được đo", stages: allStages, cadence: "guideline-driven", capture: "mixed", importance: "recommended", privacy: "highly-sensitive", evidenceRequiredForAlerts: true, purpose: "Lưu kết quả từ trường/cơ sở y tế hoặc khi có chỉ định; không biến thành đo hằng ngày cho trẻ khỏe mạnh." },
  { id: "screening-vision-hearing", domainId: "vital-signs-screening-results", title: "Kết quả thị lực / thính lực", stages: allStages, cadence: "guideline-driven", capture: "mixed", importance: "recommended", privacy: "sensitive", evidenceRequiredForAlerts: true, purpose: "Theo dõi phát hiện, kính/trợ giúp và lần kiểm tra kế tiếp." },
  { id: "nutrition-meals-groups", domainId: "nutrition-hydration", title: "Bữa ăn & nhóm thực phẩm", stages: allStages, cadence: "daily", capture: "self", importance: "recommended", privacy: "standard", evidenceRequiredForAlerts: false, purpose: "Theo dõi thói quen và tính đều đặn, không chấm điểm calorie." },
  { id: "nutrition-water", domainId: "nutrition-hydration", title: "Nước", stages: allStages, cadence: "daily", capture: "self", importance: "recommended", privacy: "standard", evidenceRequiredForAlerts: false, purpose: "Nhắc và theo dõi thói quen uống nước bằng đơn vị thuận tiện." },
  { id: "nutrition-body-image", domainId: "nutrition-hydration", title: "Khó chịu về hình thể / bỏ bữa / ăn uống bất thường", stages: ["preteen", "early-adolescent", "late-adolescent"], cadence: "event-driven", capture: "self", importance: "only-when-relevant", privacy: "highly-sensitive", evidenceRequiredForAlerts: true, purpose: "Phát hiện nhu cầu được hỗ trợ mà không biến thành công cụ giảm cân." },
  { id: "activity-minutes", domainId: "physical-activity", title: "Vận động hằng ngày", stages: allStages, cadence: "daily", capture: "mixed", importance: "recommended", privacy: "standard", evidenceRequiredForAlerts: false, purpose: "Theo dõi thời gian, loại hoạt động và xu hướng ít vận động." },
  { id: "injury-episode", domainId: "injury-sports-musculoskeletal", title: "Chấn thương / đau do vận động", stages: allStages, cadence: "event-driven", capture: "mixed", importance: "only-when-relevant", privacy: "sensitive", evidenceRequiredForAlerts: true, purpose: "Ghi theo episode để theo dõi diễn biến và phục hồi." },
  { id: "sleep-window-quality", domainId: "sleep-recovery", title: "Giờ ngủ, giờ dậy & chất lượng ngủ", stages: allStages, cadence: "daily", capture: "self", importance: "recommended", privacy: "standard", evidenceRequiredForAlerts: false, purpose: "Tạo trend theo tuần thay vì chỉ một đêm." },
  { id: "sleep-concerns", domainId: "sleep-recovery", title: "Ngáy, thức giấc, buồn ngủ ban ngày hoặc khó ngủ", stages: allStages, cadence: "event-driven", capture: "mixed", importance: "only-when-relevant", privacy: "sensitive", evidenceRequiredForAlerts: true, purpose: "Ghi triệu chứng liên quan giấc ngủ khi xuất hiện." },
  { id: "puberty-change", domainId: "puberty-body-changes", title: "Thay đổi cơ thể tuổi dậy thì", stages: ["preteen", "early-adolescent", "late-adolescent"], cadence: "event-driven", capture: "self", importance: "optional", privacy: "highly-sensitive", evidenceRequiredForAlerts: true, purpose: "Cho phép ghi riêng tư các thay đổi cần theo dõi, không chấm điểm trưởng thành." },
  { id: "menstrual-cycle", domainId: "puberty-body-changes", title: "Chu kỳ kinh nguyệt khi phù hợp", stages: ["preteen", "early-adolescent", "late-adolescent"], cadence: "event-driven", capture: "self", importance: "only-when-relevant", privacy: "highly-sensitive", evidenceRequiredForAlerts: true, purpose: "Theo dõi ngày, triệu chứng và ảnh hưởng học tập/hoạt động khi người dùng muốn." },
  { id: "wellbeing-light-checkin", domainId: "mental-emotional", title: "Check-in cảm xúc / stress", stages: allStages, cadence: "weekly-summary", capture: "self", importance: "optional", privacy: "highly-sensitive", evidenceRequiredForAlerts: true, purpose: "Nhận biết xu hướng và nhu cầu hỗ trợ, không tạo health score." },
  { id: "school-function", domainId: "school-function-learning-neurodevelopment", title: "Khả năng học tập / tập trung / nghỉ học", stages: allStages, cadence: "weekly-summary", capture: "mixed", importance: "optional", privacy: "sensitive", evidenceRequiredForAlerts: true, purpose: "Theo dõi thay đổi chức năng có ý nghĩa theo thời gian." },
  { id: "oral-hygiene", domainId: "oral-skin-hygiene", title: "Đánh răng / vệ sinh", stages: allStages, cadence: "daily", capture: "self", importance: "recommended", privacy: "standard", evidenceRequiredForAlerts: false, purpose: "Theo dõi thói quen hằng ngày và lịch nha khoa riêng." },
  { id: "preventive-due", domainId: "preventive-care", title: "Khám định kỳ / tiêm chủng / sàng lọc đến hạn", stages: allStages, cadence: "guideline-driven", capture: "mixed", importance: "core", privacy: "sensitive", evidenceRequiredForAlerts: true, purpose: "Tạo hàng đợi việc đến hạn theo guideline được version hóa và cấu hình quốc gia." },
  { id: "symptom-episode", domainId: "symptoms-illness-first-aid", title: "Episode triệu chứng / bệnh cấp", stages: allStages, cadence: "event-driven", capture: "mixed", importance: "only-when-relevant", privacy: "sensitive", evidenceRequiredForAlerts: true, purpose: "Theo dõi khởi phát, mức độ, diễn biến, hành động đã làm và kết quả." },
  { id: "condition-problem-list", domainId: "chronic-conditions-care-plans", title: "Bệnh nền / tiền sử / kế hoạch chăm sóc", stages: allStages, cadence: "on-change", capture: "mixed", importance: "core", privacy: "highly-sensitive", evidenceRequiredForAlerts: true, purpose: "Giữ problem list và care plan nhất quán để không bỏ sót thông tin quan trọng khi khám hoặc đi học xa." },
  { id: "medication-list-adherence", domainId: "medications-allergies", title: "Thuốc đang dùng & nhật ký dùng thuốc", stages: allStages, cadence: "clinician-directed", capture: "mixed", importance: "only-when-relevant", privacy: "highly-sensitive", evidenceRequiredForAlerts: true, purpose: "Theo dõi thuốc được kê/đã biết và việc đã dùng/bỏ lỡ mà không tự đề xuất liều." },
  { id: "allergy-list", domainId: "medications-allergies", title: "Dị ứng / phản ứng", stages: allStages, cadence: "on-change", capture: "mixed", importance: "core", privacy: "highly-sensitive", evidenceRequiredForAlerts: true, purpose: "Thông tin cần nhớ trong hồ sơ và thẻ khẩn cấp." },
  { id: "digital-wellbeing-trend", domainId: "digital-wellbeing", title: "Thói quen màn hình / nghỉ mắt / trước ngủ", stages: allStages, cadence: "weekly-summary", capture: "self", importance: "optional", privacy: "standard", evidenceRequiredForAlerts: false, purpose: "Theo dõi xu hướng cân bằng số thay vì giám sát chi tiết mọi hành vi." },
  { id: "safety-bullying", domainId: "safety-risk-prevention", title: "An toàn / bắt nạt / bạo lực / tai nạn", stages: allStages, cadence: "event-driven", capture: "self", importance: "only-when-relevant", privacy: "highly-sensitive", evidenceRequiredForAlerts: true, purpose: "Cho phép ghi và truy cập nhanh kế hoạch tìm người hỗ trợ khi có sự việc." },
  { id: "substance-use", domainId: "substance-use-risk-behaviour", title: "Thuốc lá/vape, rượu bia và chất gây nghiện", stages: ["preteen", "early-adolescent", "late-adolescent"], cadence: "guideline-driven", capture: "self", importance: "only-when-relevant", privacy: "highly-sensitive", evidenceRequiredForAlerts: true, purpose: "Hỗ trợ sàng lọc/giáo dục riêng tư theo tuổi bằng công cụ đã được kiểm định." },
  { id: "relationships-reproductive", domainId: "relationships-reproductive-health", title: "Quan hệ / ranh giới / sức khỏe sinh sản", stages: ["preteen", "early-adolescent", "late-adolescent"], cadence: "event-driven", capture: "self", importance: "only-when-relevant", privacy: "highly-sensitive", evidenceRequiredForAlerts: true, purpose: "Cung cấp không gian riêng tư và nội dung phù hợp tuổi, không hiển thị trên dashboard dùng chung." },
  { id: "social-protective-context", domainId: "family-social-protective-context", title: "Người lớn tin cậy / an toàn nhà-trường / rào cản chăm sóc", stages: allStages, cadence: "guideline-driven", capture: "self", importance: "optional", privacy: "highly-sensitive", evidenceRequiredForAlerts: true, purpose: "Ghi tối thiểu các yếu tố bảo vệ/rào cản khi người dùng chủ động, không tạo social score." },
  { id: "documents-appointments", domainId: "records-appointments-documents", title: "Lịch hẹn / tài liệu / kết quả khám", stages: allStages, cadence: "event-driven", capture: "mixed", importance: "recommended", privacy: "highly-sensitive", evidenceRequiredForAlerts: false, purpose: "Giữ provenance, ngày tháng và liên kết tài liệu để timeline không mất ngữ cảnh." },
  { id: "transition-readiness", domainId: "transition-adult-care", title: "Mức sẵn sàng tự quản lý sức khỏe", stages: ["late-adolescent"], cadence: "scheduled", capture: "self", importance: "recommended", privacy: "highly-sensitive", evidenceRequiredForAlerts: false, purpose: "Theo dõi kỹ năng tự quản lý trước khi học đại học/sống xa gia đình; đây không phải điểm sức khỏe." },
];

export const HEALTH_TRACKING_RULES = {
  noOverallHealthScore: true,
  alertsRequireEvidence: true,
  privateDomainsHiddenFromSharedDashboard: true,
  trendBeforeSinglePointJudgement: true,
  eventEpisodesPreferredForSymptomsAndInjuries: true,
  guidelineDrivenItemsRequireJurisdictionAndVersion: true,
} as const;

export function trackingItemsForStage(stage: HealthAgeStageId) {
  return HEALTH_TRACKING_ITEMS.filter((item) => item.stages.includes(stage));
}

export function trackingItemsForDomain(domainId: string) {
  return HEALTH_TRACKING_ITEMS.filter((item) => item.domainId === domainId);
}
