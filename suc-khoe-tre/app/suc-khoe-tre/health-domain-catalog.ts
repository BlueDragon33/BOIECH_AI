import type { HealthAgeStageId } from "./health-age-scope";

export type HealthNavArea = "today" | "growth" | "nutrition" | "activity" | "care" | "journal" | "profile";
export type HealthPrivacyLevel = "standard" | "sensitive" | "highly-sensitive";

export type HealthDomain = {
  id: string;
  title: string;
  navArea: HealthNavArea;
  summary: string;
  capabilities: readonly string[];
  stages: readonly HealthAgeStageId[];
  privacy: HealthPrivacyLevel;
  guardrail?: string;
};

export const HEALTH_DOMAINS: readonly HealthDomain[] = [
  {
    id: "growth-development",
    title: "Tăng trưởng & phát triển thể chất",
    navArea: "growth",
    summary: "Chiều cao, cân nặng, BMI-for-age, xu hướng tăng trưởng và các mốc phát triển phù hợp tuổi.",
    capabilities: ["timeline số đo", "WHO BMI-for-age", "xu hướng dài hạn", "mốc phát triển"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "sensitive",
    guardrail: "Không suy diễn chẩn đoán từ một số đo đơn lẻ.",
  },
  {
    id: "nutrition-hydration",
    title: "Dinh dưỡng & nước",
    navArea: "nutrition",
    summary: "Theo dõi nhóm thực phẩm, bữa ăn, nước và thói quen ăn uống theo giai đoạn phát triển.",
    capabilities: ["checklist nhóm thực phẩm", "nhật ký bữa ăn", "nước", "nhắc dinh dưỡng"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "standard",
    guardrail: "Không biến thành calorie tracker/giảm cân dành cho người lớn.",
  },
  {
    id: "physical-activity",
    title: "Vận động & thể lực",
    navArea: "activity",
    summary: "Ghi hoạt động thể lực, thời gian vận động, thói quen ngồi lâu và phục hồi sau vận động.",
    capabilities: ["phút vận động", "loại hoạt động", "lịch sử tuần/tháng", "nhắc vận động"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "standard",
  },
  {
    id: "sleep-recovery",
    title: "Giấc ngủ & phục hồi",
    navArea: "care",
    summary: "Giờ ngủ, giờ dậy, thời lượng ngủ, thói quen trước ngủ và tác động của lịch học.",
    capabilities: ["nhật ký ngủ", "checklist trước ngủ", "nhắc giờ ngủ", "xu hướng theo tuần"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "standard",
  },
  {
    id: "puberty-body-changes",
    title: "Dậy thì & thay đổi cơ thể",
    navArea: "care",
    summary: "Khung giáo dục và theo dõi thay đổi cơ thể theo tuổi, có riêng tư và ngôn ngữ phù hợp lứa tuổi.",
    capabilities: ["kiến thức dậy thì", "vệ sinh tuổi dậy thì", "ghi chú thay đổi cơ thể", "chu kỳ kinh nguyệt khi phù hợp"],
    stages: ["preteen", "early-adolescent", "late-adolescent"],
    privacy: "highly-sensitive",
    guardrail: "Dữ liệu nhạy cảm chỉ local-first; không hiển thị mặc định trên dashboard công khai hoặc Site Quản trị.",
  },
  {
    id: "mental-emotional",
    title: "Sức khỏe tinh thần & cảm xúc",
    navArea: "journal",
    summary: "Theo dõi cảm xúc, căng thẳng học tập, giấc ngủ, kết nối xã hội và dấu hiệu cần người lớn/chuyên gia hỗ trợ.",
    capabilities: ["check-in cảm xúc", "nhật ký", "stress học tập", "kế hoạch tìm hỗ trợ"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "highly-sensitive",
    guardrail: "Không tự chẩn đoán rối loạn tâm thần; nội dung nguy cơ cao phải ưu tiên hướng dẫn tìm hỗ trợ phù hợp.",
  },
  {
    id: "oral-skin-hygiene",
    title: "Răng miệng, da & vệ sinh cá nhân",
    navArea: "care",
    summary: "Đánh răng, lịch nha khoa, vệ sinh cá nhân, tóc/da và thói quen chăm sóc hằng ngày.",
    capabilities: ["checklist sáng/tối", "răng miệng", "vệ sinh", "ghi chú da/tóc"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "standard",
  },
  {
    id: "eyes-hearing-school",
    title: "Mắt, tai, tư thế & sức khỏe học đường",
    navArea: "care",
    summary: "Mỏi mắt, nhìn mờ, nghe kém, tư thế học, cặp sách, màn hình và nghỉ giữa giờ học.",
    capabilities: ["nghỉ mắt", "thói quen màn hình", "tư thế", "nhắc kiểm tra mắt/răng"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "standard",
  },
  {
    id: "preventive-care",
    title: "Phòng ngừa, khám định kỳ & tiêm chủng",
    navArea: "profile",
    summary: "Lịch khám, nha khoa, mắt, tiêm chủng và các việc phòng ngừa theo hồ sơ cá nhân.",
    capabilities: ["lịch khám", "lịch tiêm", "nhắc tái khám", "tài liệu phòng ngừa"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "sensitive",
    guardrail: "Lịch/khuyến nghị cụ thể chỉ được bật khi có nguồn chuẩn và cấu hình phù hợp địa phương/hồ sơ.",
  },
  {
    id: "symptoms-illness-first-aid",
    title: "Triệu chứng, bệnh cấp & sơ cứu",
    navArea: "journal",
    summary: "Ghi triệu chứng, diễn biến, nhiệt độ/ghi chú khi cần và hướng dẫn nhận biết khi nào phải tìm trợ giúp.",
    capabilities: ["timeline triệu chứng", "ghi diễn biến", "cờ cảnh báo", "thẻ hướng dẫn sơ cứu"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "sensitive",
    guardrail: "Không tự kê đơn hoặc thay thế cấp cứu/chẩn đoán y khoa.",
  },
  {
    id: "medications-allergies",
    title: "Thuốc, dị ứng & thông tin cần nhớ",
    navArea: "profile",
    summary: "Danh sách thuốc đang dùng, dị ứng, lịch dùng và thông tin cần mang theo khi khám.",
    capabilities: ["danh sách thuốc", "nhắc dùng", "dị ứng", "lịch sử thay đổi"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "highly-sensitive",
    guardrail: "Ứng dụng không tự đề xuất liều hoặc thay đổi thuốc.",
  },
  {
    id: "digital-wellbeing",
    title: "Sức khỏe số & thói quen màn hình",
    navArea: "care",
    summary: "Thời gian màn hình, nghỉ mắt, sử dụng thiết bị trước ngủ, an toàn trực tuyến và cân bằng học–nghỉ.",
    capabilities: ["checklist màn hình", "nghỉ mắt", "thói quen trước ngủ", "an toàn số"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "standard",
  },
  {
    id: "safety-risk-prevention",
    title: "An toàn & phòng tránh nguy cơ",
    navArea: "care",
    summary: "An toàn giao thông, thể thao, nước, tai nạn, bạo lực/bắt nạt và phòng tránh chất gây nghiện theo tuổi.",
    capabilities: ["checklist an toàn", "kế hoạch liên hệ người lớn", "kiến thức phòng tránh", "nhắc trang bị bảo hộ"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "sensitive",
  },
  {
    id: "relationships-reproductive-health",
    title: "Quan hệ, ranh giới cá nhân & sức khỏe sinh sản",
    navArea: "care",
    summary: "Giáo dục theo tuổi về cơ thể, ranh giới cá nhân, đồng thuận, mối quan hệ an toàn và sức khỏe sinh sản.",
    capabilities: ["kiến thức theo tuổi", "ranh giới cá nhân", "đồng thuận", "tìm nguồn trợ giúp tin cậy"],
    stages: ["preteen", "early-adolescent", "late-adolescent"],
    privacy: "highly-sensitive",
    guardrail: "Thiết kế giáo dục, trung lập và phù hợp tuổi; dữ liệu cá nhân nhạy cảm không gửi về Trung tâm Quản trị.",
  },
  {
    id: "records-appointments-documents",
    title: "Hồ sơ, lịch hẹn & tài liệu y tế",
    navArea: "profile",
    summary: "Quản lý lịch khám, ghi chú lần khám, kết quả/tài liệu do người dùng lưu và lịch nhắc liên quan.",
    capabilities: ["lịch hẹn", "ghi chú khám", "tài liệu", "xuất lịch .ics", "Google Calendar theo quyền thiết bị"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "highly-sensitive",
    guardrail: "Tài liệu y tế chỉ được lưu/xuất theo thao tác chủ động của người dùng; không tự tải lên hoặc gửi sang Site Quản trị.",
  },
  {
    id: "transition-adult-care",
    title: "Tự quản lý sức khỏe & chuyển tiếp tuổi trưởng thành",
    navArea: "profile",
    summary: "Chuẩn bị 16–18 tuổi biết thông tin sức khỏe của mình, quản lý lịch khám/thuốc/tài liệu và tự tìm trợ giúp khi vào đại học.",
    capabilities: ["health passport", "thông tin khẩn cấp", "tự đặt lịch", "quản lý thuốc", "chuẩn bị sống xa gia đình"],
    stages: ["late-adolescent"],
    privacy: "highly-sensitive",
    guardrail: "Không tự động chuyển dữ liệu cho trường đại học, cơ sở y tế hoặc Site Quản trị nếu người dùng chưa chủ động cho phép.",
  },
] as const;

export const HEALTH_FRAMEWORK_COUNTS = {
  domains: HEALTH_DOMAINS.length,
  stages: 4,
  navAreas: 7,
} as const;

export function healthDomainsForStage(stageId: HealthAgeStageId) {
  return HEALTH_DOMAINS.filter((domain) => domain.stages.includes(stageId));
}

export function healthDomainsForNavArea(area: HealthNavArea) {
  return HEALTH_DOMAINS.filter((domain) => domain.navArea === area);
}
