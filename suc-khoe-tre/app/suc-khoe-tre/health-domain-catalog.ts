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
    id: "vital-signs-screening-results",
    title: "Dấu hiệu sinh tồn, sàng lọc & kết quả kiểm tra",
    navArea: "profile",
    summary: "Lưu các kết quả được đo/khám như huyết áp, nhịp tim, thị lực, thính lực và kết quả sàng lọc/xét nghiệm khi người dùng có dữ liệu hợp lệ.",
    capabilities: ["huyết áp/nhịp tim", "thị lực/thính lực", "kết quả sàng lọc", "kết quả xét nghiệm có nguồn"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "highly-sensitive",
    guardrail: "Không tự suy diễn bất thường từ kết quả xét nghiệm/sàng lọc nếu chưa có rule được kiểm định theo tuổi, giới, đơn vị và nguồn chuyên môn.",
  },
  {
    id: "nutrition-hydration",
    title: "Dinh dưỡng & nước",
    navArea: "nutrition",
    summary: "Theo dõi nhóm thực phẩm, bữa ăn, nước và thói quen ăn uống theo giai đoạn phát triển.",
    capabilities: ["checklist nhóm thực phẩm", "nhật ký bữa ăn", "nước", "nhắc dinh dưỡng", "thói quen ăn uống & hình ảnh cơ thể"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "standard",
    guardrail: "Không biến thành calorie tracker/giảm cân dành cho người lớn; tránh gamification cân nặng có thể làm tăng ám ảnh hình thể.",
  },
  {
    id: "physical-activity",
    title: "Vận động & thể lực",
    navArea: "activity",
    summary: "Ghi hoạt động thể lực, thời gian vận động, cường độ tương đối, thói quen ngồi lâu và phục hồi sau vận động.",
    capabilities: ["phút vận động", "loại hoạt động", "lịch sử tuần/tháng", "nhắc vận động", "thói quen ít vận động"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "standard",
  },
  {
    id: "injury-sports-musculoskeletal",
    title: "Chấn thương, thể thao & cơ xương khớp",
    navArea: "activity",
    summary: "Theo dõi chấn thương, đau do vận động, chấn động đầu được ghi nhận, nghỉ tập và quá trình quay lại hoạt động.",
    capabilities: ["episode chấn thương", "vị trí/mức đau", "nghỉ vận động", "tái khám/phục hồi", "ghi chú thể thao"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "sensitive",
    guardrail: "Không tự cấp giấy đủ điều kiện thể thao hoặc tự quyết định return-to-play sau chấn thương/chấn động đầu.",
  },
  {
    id: "sleep-recovery",
    title: "Giấc ngủ & phục hồi",
    navArea: "care",
    summary: "Giờ ngủ, giờ dậy, thời lượng/chất lượng ngủ, thức giấc, ngáy/buồn ngủ ban ngày khi có và tác động của lịch học.",
    capabilities: ["nhật ký ngủ", "checklist trước ngủ", "nhắc giờ ngủ", "xu hướng theo tuần", "chất lượng ngủ"],
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
    guardrail: "Dữ liệu nhạy cảm private-by-default; không hiển thị mặc định trên dashboard dùng chung hoặc Site Quản trị.",
  },
  {
    id: "mental-emotional",
    title: "Sức khỏe tinh thần & cảm xúc",
    navArea: "journal",
    summary: "Theo dõi cảm xúc, căng thẳng học tập, giấc ngủ, kết nối xã hội và dấu hiệu cần người lớn/chuyên gia hỗ trợ.",
    capabilities: ["check-in cảm xúc", "nhật ký", "stress học tập", "yếu tố bảo vệ", "kế hoạch tìm hỗ trợ"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "highly-sensitive",
    guardrail: "Không tự chẩn đoán rối loạn tâm thần; nội dung nguy cơ cao phải ưu tiên hướng dẫn tìm hỗ trợ phù hợp và không dùng điểm số tổng hợp để dán nhãn trẻ.",
  },
  {
    id: "school-function-learning-neurodevelopment",
    title: "Học tập, chú ý & chức năng học đường",
    navArea: "journal",
    summary: "Theo dõi khó khăn chú ý/học tập, đi học, khả năng tập trung, mệt mỏi và hỗ trợ/hòa nhập tại trường theo thời gian.",
    capabilities: ["chức năng học tập", "đi học/nghỉ học", "khó khăn tập trung", "hỗ trợ học đường", "xu hướng chức năng"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "sensitive",
    guardrail: "Không tự chẩn đoán ADHD, rối loạn học tập hoặc khuyết tật; chỉ ghi nhận chức năng và tài liệu đánh giá có nguồn.",
  },
  {
    id: "oral-skin-hygiene",
    title: "Răng miệng, da & vệ sinh cá nhân",
    navArea: "care",
    summary: "Đánh răng, lịch nha khoa, vệ sinh cá nhân, tóc/da và thói quen chăm sóc hằng ngày.",
    capabilities: ["checklist sáng/tối", "răng miệng", "vệ sinh", "ghi chú da/tóc", "lịch nha khoa"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "standard",
  },
  {
    id: "eyes-hearing-school",
    title: "Mắt, tai, tư thế & sức khỏe học đường",
    navArea: "care",
    summary: "Mỏi mắt, nhìn mờ, nghe kém, tư thế học, cặp sách, màn hình và nghỉ giữa giờ học.",
    capabilities: ["nghỉ mắt", "thói quen màn hình", "tư thế", "kính/trợ thính khi có", "nhắc kiểm tra mắt/tai"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "standard",
  },
  {
    id: "preventive-care",
    title: "Phòng ngừa, khám định kỳ & tiêm chủng",
    navArea: "profile",
    summary: "Lịch khám, nha khoa, mắt, tiêm chủng và các việc phòng ngừa theo hồ sơ cá nhân và cấu hình quốc gia.",
    capabilities: ["lịch khám", "lịch tiêm", "nhắc tái khám", "catch-up status", "tài liệu phòng ngừa"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "sensitive",
    guardrail: "Lịch/khuyến nghị cụ thể chỉ được bật khi có nguồn chuẩn, phiên bản và cấu hình quốc gia/hồ sơ phù hợp; không dùng lịch nước khác làm mặc định cho Việt Nam.",
  },
  {
    id: "symptoms-illness-first-aid",
    title: "Triệu chứng, bệnh cấp & sơ cứu",
    navArea: "journal",
    summary: "Ghi triệu chứng theo episode, diễn biến, nhiệt độ/ghi chú khi cần và hướng dẫn nhận biết khi nào phải tìm trợ giúp.",
    capabilities: ["episode triệu chứng", "thời điểm khởi phát", "mức độ/diễn biến", "cờ cảnh báo", "thẻ hướng dẫn sơ cứu"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "sensitive",
    guardrail: "Không tự kê đơn hoặc thay thế cấp cứu/chẩn đoán y khoa; red-flag rules chỉ được bật khi có nguồn chuyên môn và test riêng.",
  },
  {
    id: "chronic-conditions-care-plans",
    title: "Bệnh nền, tiền sử & kế hoạch chăm sóc",
    navArea: "profile",
    summary: "Quản lý bệnh nền/điều kiện sức khỏe đã được xác định, tiền sử nhập viện/phẫu thuật, kế hoạch chăm sóc và hướng dẫn xử trí cá nhân.",
    capabilities: ["problem list", "tiền sử y tế", "kế hoạch chăm sóc", "chuyên khoa theo dõi", "hỗ trợ tại trường"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "highly-sensitive",
    guardrail: "Không tự tạo chẩn đoán; tình trạng bệnh phải do người dùng nhập từ thông tin đã biết hoặc từ tài liệu/chuyên gia y tế.",
  },
  {
    id: "medications-allergies",
    title: "Thuốc, dị ứng & thông tin cần nhớ",
    navArea: "profile",
    summary: "Danh sách thuốc đang dùng, dị ứng, lịch dùng và thông tin cần mang theo khi khám.",
    capabilities: ["danh sách thuốc", "nhắc dùng", "nhật ký đã dùng/bỏ lỡ", "dị ứng/phản ứng", "lịch sử thay đổi"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "highly-sensitive",
    guardrail: "Ứng dụng không tự đề xuất liều hoặc thay đổi thuốc; liều chỉ được ghi lại theo thông tin người dùng/chuyên gia cung cấp.",
  },
  {
    id: "digital-wellbeing",
    title: "Sức khỏe số & thói quen màn hình",
    navArea: "care",
    summary: "Thời gian màn hình, nghỉ mắt, sử dụng thiết bị trước ngủ, an toàn trực tuyến và cân bằng học–nghỉ.",
    capabilities: ["checklist màn hình", "nghỉ mắt", "thói quen trước ngủ", "an toàn số", "xu hướng sử dụng"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "standard",
  },
  {
    id: "safety-risk-prevention",
    title: "An toàn & phòng tránh nguy cơ",
    navArea: "care",
    summary: "An toàn giao thông, thể thao, nước, tai nạn, bạo lực/bắt nạt và kỹ năng tìm trợ giúp theo tuổi.",
    capabilities: ["checklist an toàn", "kế hoạch liên hệ người lớn", "kiến thức phòng tránh", "nhắc trang bị bảo hộ", "bắt nạt/bạo lực"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "sensitive",
  },
  {
    id: "substance-use-risk-behaviour",
    title: "Thuốc lá/vape, rượu bia, chất gây nghiện & hành vi nguy cơ",
    navArea: "journal",
    summary: "Khung giáo dục và check-in riêng tư về nicotine/vape, rượu bia, ma túy/chất gây nghiện và hành vi nguy cơ ở tuổi phù hợp.",
    capabilities: ["giáo dục phòng tránh", "check-in riêng tư", "validated screening adapter", "kế hoạch tìm trợ giúp"],
    stages: ["preteen", "early-adolescent", "late-adolescent"],
    privacy: "highly-sensitive",
    guardrail: "Không hiển thị công khai hoặc gửi về Site Quản trị; công cụ sàng lọc chỉ được dùng khi đã kiểm tra phạm vi tuổi, bản quyền, ngôn ngữ và hướng xử trí.",
  },
  {
    id: "relationships-reproductive-health",
    title: "Quan hệ, ranh giới cá nhân & sức khỏe sinh sản",
    navArea: "care",
    summary: "Giáo dục theo tuổi về cơ thể, ranh giới cá nhân, đồng thuận, mối quan hệ an toàn và sức khỏe sinh sản.",
    capabilities: ["kiến thức theo tuổi", "ranh giới cá nhân", "đồng thuận", "sức khỏe sinh sản", "tìm nguồn trợ giúp tin cậy"],
    stages: ["preteen", "early-adolescent", "late-adolescent"],
    privacy: "highly-sensitive",
    guardrail: "Thiết kế giáo dục, trung lập và phù hợp tuổi; dữ liệu cá nhân nhạy cảm không gửi về Trung tâm Quản trị và phải hỗ trợ chế độ xem riêng tư.",
  },
  {
    id: "family-social-protective-context",
    title: "Gia đình, môi trường sống & yếu tố bảo vệ",
    navArea: "journal",
    summary: "Theo dõi tối thiểu các yếu tố ảnh hưởng sức khỏe như người lớn tin cậy, an toàn ở nhà/trường, thay đổi lớn trong gia đình, hỗ trợ xã hội và khó khăn tiếp cận chăm sóc khi người dùng muốn ghi.",
    capabilities: ["người lớn tin cậy", "an toàn nhà/trường", "yếu tố bảo vệ", "rào cản chăm sóc", "thay đổi hoàn cảnh"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "highly-sensitive",
    guardrail: "Thu thập tối thiểu, tự nguyện và private-by-default; không tạo hồ sơ xã hội để chấm điểm hoặc gửi sang Site Quản trị.",
  },
  {
    id: "records-appointments-documents",
    title: "Hồ sơ, lịch hẹn & tài liệu y tế",
    navArea: "profile",
    summary: "Quản lý lịch khám, ghi chú lần khám, kết quả/tài liệu do người dùng lưu và lịch nhắc liên quan.",
    capabilities: ["lịch hẹn", "ghi chú khám", "tài liệu", "nguồn/provenance", "xuất lịch .ics", "Google Calendar theo quyền thiết bị"],
    stages: ["foundation", "preteen", "early-adolescent", "late-adolescent"],
    privacy: "highly-sensitive",
    guardrail: "Tài liệu y tế chỉ được lưu/xuất theo thao tác chủ động của người dùng; không tự tải lên hoặc gửi sang Site Quản trị.",
  },
  {
    id: "transition-adult-care",
    title: "Tự quản lý sức khỏe & chuyển tiếp tuổi trưởng thành",
    navArea: "profile",
    summary: "Chuẩn bị 16–18 tuổi biết thông tin sức khỏe của mình, quản lý lịch khám/thuốc/tài liệu và tự tìm trợ giúp khi vào đại học.",
    capabilities: ["health passport", "thông tin khẩn cấp", "tự đặt lịch", "quản lý thuốc", "privacy ownership", "chuẩn bị sống xa gia đình"],
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
