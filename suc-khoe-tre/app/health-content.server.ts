import type { getCourseDatabase } from "./device-auth.server";

type Database = Awaited<ReturnType<typeof getCourseDatabase>>;

export const HEALTH_DOCUMENT_SCHEMA_VERSION = 2 as const;
export const HEALTH_POLICY_VERSION = "child-health-clinical-v2" as const;
export const HEALTH_LESSON_NUMBERS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14"] as const;
export const HEALTH_EDIT_SECTIONS = ["content", "practice", "analysis", "review", "quiz"] as const;
export type HealthLessonNumber = (typeof HEALTH_LESSON_NUMBERS)[number];
export type HealthEditSection = (typeof HEALTH_EDIT_SECTIONS)[number];
export type HealthEditScope = {
  lessonNumber: HealthLessonNumber;
  section: HealthEditSection;
  sectionLabel: string;
  label: string;
  value: string;
};

export type HealthAgeBand = "under5" | "school5to10";

const sectionLabels: Record<HealthEditSection, string> = {
  content: "Nội dung",
  practice: "Thực hành",
  analysis: "Phân tích",
  review: "Ôn tập",
  quiz: "Kiểm tra",
};

export type HealthQuestion = {
  q: string;
  options: [string, string, string, string];
  answer: number;
  explain: string;
};

export type HealthLesson = {
  number: HealthLessonNumber;
  ageBand: HealthAgeBand;
  title: string;
  summary: string;
  content: { html: string; safety: string[] };
  practice: { steps: string[] };
  analysis: { html: string };
  review: { points: string[] };
  quiz: { questions: HealthQuestion[] };
};

export type HealthCourseDocument = {
  schemaVersion: typeof HEALTH_DOCUMENT_SCHEMA_VERSION;
  application: "child-health";
  policyVersion: typeof HEALTH_POLICY_VERSION;
  reviewedOn: string;
  title: string;
  passScore: 8;
  lessons: Record<HealthLessonNumber, HealthLesson>;
};

type HealthVersionRow = {
  id: string;
  version_number: number;
  status: "permission_requested" | "draft" | "review" | "published" | "changes_requested" | "denied" | "cancelled" | "archived";
  payload_json: string;
  summary: string | null;
  created_by: string;
  editor_device_id: string | null;
  editor_device_code: string | null;
  edit_scope: string | null;
  permission_note: string | null;
  permission_reviewed_by: string | null;
  permission_reviewed_at: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  parent_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicHealthContentVersion = Omit<HealthVersionRow, "payload_json"> & {
  application: "child-health";
  payload?: HealthCourseDocument;
  edit_lesson: HealthLessonNumber | null;
  edit_section: HealthEditSection | null;
  edit_scope_label: string | null;
};

function question(q: string, correct: string, wrong1: string, wrong2: string, wrong3: string, explain: string): HealthQuestion {
  return { q, options: [correct, wrong1, wrong2, wrong3], answer: 0, explain };
}

const Q = {
  growth: [
    question("Điều quan trọng nhất khi theo dõi tăng trưởng là gì?", "Xu hướng theo thời gian", "Một lần cân duy nhất", "So với trẻ hàng xóm", "Nhìn bằng mắt", "Tăng trưởng cần được đánh giá theo chuỗi số đo."),
    question("Biểu đồ WHO 0–5 tuổi có tách bé trai và bé gái không?", "Có", "Không", "Chỉ sau 3 tuổi", "Chỉ theo cân nặng", "WHO cung cấp chuẩn tăng trưởng riêng theo giới."),
    question("Trẻ mất kỹ năng đã có nên làm gì?", "Trao đổi với bác sĩ", "Chờ vài tháng", "Tự tăng vitamin", "Ép luyện tập", "Mất kỹ năng đã có là dấu hiệu cần đánh giá."),
    question("Một lần cân thấp hơn có đủ chẩn đoán suy dinh dưỡng không?", "Không", "Có", "Luôn đủ", "Chỉ ở bé trai", "Cần xem xu hướng và đánh giá toàn diện."),
    question("Khi đo chiều cao nên ưu tiên gì?", "Phương pháp nhất quán", "Đổi cách mỗi lần", "Đo khi mang giày", "Ước lượng", "Đo nhất quán giúp so sánh theo thời gian."),
    question("Sau đợt bệnh có nên ép trẻ ăn thật nhiều không?", "Không nên ép", "Luôn phải ép", "Chỉ ép buổi tối", "Càng nhiều càng tốt", "Khuyến khích ăn phù hợp, theo dõi hồi phục và tăng trưởng."),
    question("Hồ sơ sức khỏe nên ghi gì?", "Số đo và diễn biến theo ngày", "Chỉ cân nặng", "Chỉ số giờ ngủ", "Chỉ số lần khóc", "Dữ liệu theo thời gian giúp nhận diện thay đổi."),
    question("Sụt cân rõ không giải thích được nên làm gì?", "Đưa trẻ đi đánh giá", "Tự dùng thuốc bổ", "Bỏ qua", "Chỉ tăng đồ ngọt", "Sụt cân rõ cần tìm nguyên nhân."),
    question("Mục tiêu của biểu đồ tăng trưởng là gì?", "Theo dõi diễn biến", "Xếp hạng trẻ", "Tự kê thuốc", "Thi đua cân nặng", "Biểu đồ giúp nhận diện quỹ đạo tăng trưởng."),
    question("Giới tính có ảnh hưởng lựa chọn biểu đồ WHO không?", "Có", "Không", "Chỉ dưới 1 tuổi", "Chỉ lúc 5 tuổi", "Chuẩn được tách theo bé trai/bé gái."),
  ],
  nutrition: [
    question("Trẻ 9 tháng có dùng mật ong được không?", "Không", "Có", "Chỉ buổi tối", "Chỉ khi ho", "Không dùng mật ong cho trẻ dưới 12 tháng."),
    question("Trẻ nhỏ nên ăn ở tư thế nào?", "Ngồi và có người quan sát", "Vừa chạy vừa ăn", "Nằm ăn", "Ăn một mình", "Ngồi và giám sát giúp giảm nguy cơ hóc."),
    question("Thực phẩm nào có nguy cơ hóc?", "Kẹo cứng", "Cháo mềm", "Nước", "Sữa phù hợp", "Thức ăn cứng/tròn có thể gây hóc."),
    question("Sữa bò nguyên chất có nên là đồ uống chính trước 12 tháng?", "Không", "Có", "Chỉ buổi sáng", "Tùy món", "Trước 12 tháng không dùng làm đồ uống chính."),
    question("Dấu mất nước đáng chú ý là gì?", "Tiểu ít", "Hắt hơi", "Ho một lần", "Chảy nước mắt", "Tiểu ít là dấu cần theo dõi mất nước."),
    question("Có nên cho trẻ vừa chạy vừa ăn?", "Không", "Có", "Chỉ trên 2 tuổi", "Tùy món", "Vừa vận động vừa ăn tăng nguy cơ hóc."),
    question("Khi bệnh, mục tiêu dinh dưỡng ưu tiên là gì?", "Duy trì đủ dịch", "Ép ăn thật nhiều", "Nhịn uống", "Chỉ uống siro", "Đủ dịch rất quan trọng khi trẻ ốm."),
    question("Thảo dược không rõ thành phần cho trẻ có nên tự dùng không?", "Không", "Có", "Luôn an toàn", "Chỉ khi ho", "Không rõ thành phần và liều có thể gây hại."),
    question("Chống hóc đặc biệt quan trọng đến mấy tuổi?", "Dưới 5 tuổi", "Chỉ dưới 1 tuổi", "Không cần", "Chỉ bé gái", "Trẻ nhỏ cần giám sát và chuẩn bị thức ăn phù hợp."),
    question("Khi trẻ nôn nhiều có nên ép ăn không?", "Không", "Có", "Luôn phải ép", "Chỉ đồ ngọt", "Ưu tiên đánh giá mất nước và dung nạp dịch."),
  ],
  development: [
    question("Trẻ 1–2 tuổi thường cần ngủ bao nhiêu?", "11–14 giờ/24 giờ", "5–6 giờ", "18–20 giờ", "Không cần ngủ ngày", "Thời lượng tính cả ngủ ngày."),
    question("Mốc phát triển dùng chủ yếu để làm gì?", "Theo dõi và sàng lọc", "Thi đua", "Tự chẩn đoán", "Xếp hạng", "Mốc phát triển giúp phát hiện trẻ cần đánh giá thêm."),
    question("Mất kỹ năng đã có cần làm gì?", "Đánh giá y tế", "Bỏ qua", "Tăng đường", "Dùng kháng sinh", "Mất kỹ năng cần trao đổi với bác sĩ."),
    question("Hoạt động nào hỗ trợ ngôn ngữ?", "Nói chuyện và đọc cùng trẻ", "Để màn hình cả ngày", "Không tương tác", "Chỉ nghe nhạc", "Tương tác trực tiếp hỗ trợ phát triển ngôn ngữ."),
    question("Trẻ 3–5 tuổi thường cần ngủ bao nhiêu?", "10–13 giờ", "4–6 giờ", "16–20 giờ", "2 giờ", "Tính tổng trong 24 giờ."),
    question("Giờ ngủ tương đối đều có lợi không?", "Có", "Không", "Chỉ bé trai", "Chỉ dưới 1 tuổi", "Lịch ngủ ổn định hỗ trợ giấc ngủ."),
    question("Vận động nên như thế nào?", "Phù hợp tuổi và có giám sát", "Cấm vận động", "Luôn tập nặng", "Chỉ trong nhà", "Vận động cần phù hợp khả năng và an toàn."),
    question("Mọi trẻ đạt mốc phát triển hoàn toàn giống nhau không?", "Không", "Có", "Chỉ bé trai", "Chỉ bé gái", "Có biến thiên cá nhân nhưng mất kỹ năng là đáng lưu ý."),
    question("Ngoài cân nặng nên ghi gì?", "Kỹ năng và hành vi phát triển", "Chỉ màu quần áo", "Không cần", "Chỉ số lần khóc", "Phát triển là nhiều lĩnh vực."),
    question("Mục tiêu theo dõi phát triển là gì?", "Quan sát tiến bộ toàn diện", "Đạt mốc sớm nhất", "So trẻ", "Tự kê thuốc", "Không biến mốc phát triển thành cuộc thi."),
  ],
  respiratory: [
    question("Ho có vai trò gì?", "Hỗ trợ làm sạch đường thở", "Luôn gây viêm phổi", "Không có ích", "Luôn phải cắt", "Ho là một cơ chế bảo vệ đường thở."),
    question("Bé 9 tháng ho/khó thở được coi thở nhanh từ bao nhiêu?", "50 lần/phút", "20", "30", "35", "WHO IMCI dùng ngưỡng 50/phút cho 2–<12 tháng."),
    question("Trẻ 18 tháng ho/khó thở được coi thở nhanh từ bao nhiêu?", "40 lần/phút", "20", "25", "30", "WHO IMCI dùng ngưỡng 40/phút cho 12 tháng–<5 tuổi."),
    question("Nên đếm nhịp thở khi nào?", "Khi trẻ yên, đủ 60 giây", "Khi khóc dữ", "Sau chạy", "Đếm 5 giây", "Đếm một phút khi trẻ bình tĩnh."),
    question("Ho giảm nhưng nhịp thở tăng nghĩa là gì?", "Cần đánh giá lại", "Chắc chắn khỏi", "Không cần quan tâm", "Cho thêm thuốc ho", "Ít ho hơn không chứng minh hô hấp tốt hơn."),
    question("Có nên tự dùng corticoid chỉ để cắt ho?", "Không", "Có", "Luôn dùng", "Chỉ ban đêm", "Corticoid cần đúng chỉ định."),
    question("Ho có đờm có tự động cần kháng sinh không?", "Không", "Có", "Luôn có", "Chỉ bé trai", "Kháng sinh phụ thuộc chẩn đoán nhiễm khuẩn."),
    question("NaCl 0,9% thường hỗ trợ việc gì?", "Làm sạch mũi", "Thay kháng sinh", "Thay corticoid", "Gây ngủ", "Nước muối sinh lý hỗ trợ thông mũi."),
    question("Dấu hiệu nào nguy hiểm?", "Rút lõm ngực", "Hắt hơi một lần", "Chơi bình thường", "Ăn tốt", "Tăng công thở cần được đánh giá."),
    question("Mục tiêu chăm sóc hô hấp là gì?", "Thở ổn, đủ dịch, theo dõi toàn trạng", "Hết ho ngay", "Dùng nhiều thuốc", "Ngủ mê", "Không lấy hết ho làm mục tiêu duy nhất."),
  ],
  fever: [
    question("Sốt là gì?", "Một triệu chứng", "Luôn là nhiễm khuẩn", "Luôn cần kháng sinh", "Một chẩn đoán", "Sốt cần được đặt trong toàn cảnh bệnh."),
    question("Có nên tự phối nhiều thuốc cảm?", "Không", "Có", "Luôn tốt", "Chỉ ban đêm", "Nhiều sản phẩm có thể trùng hoạt chất."),
    question("Cần đọc gì trên nhãn thuốc?", "Hoạt chất và nồng độ", "Màu chai", "Hình vẽ", "Giá tiền", "Tên hoạt chất/nồng độ quyết định cách dùng."),
    question("Có nên dùng thìa ăn để đong thuốc?", "Không nên", "Luôn nên", "Chỉ trẻ lớn", "Tùy màu thuốc", "Nên dùng dụng cụ đong chuẩn."),
    question("Corticoid có phải thuốc nhẹ không?", "Không", "Có", "Luôn vô hại", "Chỉ bé trai", "Corticoid là thuốc mạnh và cần đúng chỉ định."),
    question("Ho sốt có tự động cần kháng sinh không?", "Không", "Có", "Luôn có", "Chỉ dưới 1 tuổi", "Nhiều bệnh hô hấp do virus."),
    question("Ghi giờ dùng thuốc có ích gì?", "Tránh dùng lặp", "Làm khỏi nhanh", "Thay bác sĩ", "Không có ích", "Nhật ký giảm nguy cơ trùng liều."),
    question("Có nên tự dùng aspirin cho trẻ không?", "Không", "Có", "Luôn dùng khi sốt", "Chỉ sau ăn", "Không tự dùng aspirin cho trẻ nếu không có chỉ định chuyên khoa."),
    question("Trẻ khó uống và tiểu ít cần nghĩ tới gì?", "Mất nước", "Tăng thuốc ho", "Nhịn uống", "Bỏ qua", "Khả năng uống và tiểu rất quan trọng."),
    question("Mục tiêu sử dụng thuốc là gì?", "Đúng chỉ định và đúng hoạt chất", "Càng nhiều càng tốt", "Cắt mọi triệu chứng", "Dùng theo kinh nghiệm", "Thuốc cần dùng có mục tiêu và kiểm soát."),
  ],
  hygiene: [
    question("Nguy cơ quan trọng khi tiêu chảy ở trẻ là gì?", "Mất nước", "Ho", "Cận thị", "Đau răng", "Trẻ nhỏ mất nước nhanh hơn."),
    question("Dấu nào gợi ý mất nước?", "Tiểu ít", "Chơi tốt", "Ăn bình thường", "Da bình thường", "Tiểu ít cần được chú ý."),
    question("Có nên cố tuột bao quy đầu bé trai?", "Không", "Có", "Hằng ngày", "Chỉ khi tắm", "Không cố tuột bao quy đầu chưa tự tách."),
    question("Bé gái nên được dạy lau thế nào?", "Từ trước ra sau", "Từ sau ra trước", "Bất kỳ", "Không cần", "Lau từ trước ra sau giúp giảm đưa vi khuẩn từ hậu môn về niệu đạo."),
    question("Da kích ứng có nên dùng nhiều sản phẩm thơm không?", "Nên tránh", "Nên dùng nhiều", "Luôn cần", "Chỉ ban đêm", "Sản phẩm thơm có thể tăng kích ứng."),
    question("Có nên tự bôi corticoid mạnh diện rộng?", "Không", "Có", "Luôn an toàn", "Chỉ bé trai", "Thuốc bôi corticoid cần đúng hoạt lực, vị trí và thời gian."),
    question("Tiêu chảy cần nhìn thêm gì ngoài số lần?", "Khả năng uống và tiểu", "Chỉ màu phân", "Không cần", "Chỉ cân nặng", "Toàn trạng và mất nước quyết định mức nguy cơ."),
    question("Vùng tã nên được chăm sóc thế nào?", "Giữ sạch và thay khi ướt/bẩn", "Luôn ẩm", "Không thay", "Rắc nhiều phấn", "Giữ sạch và khô vừa phải giúp giảm kích ứng."),
    question("Không uống được kèm li bì là gì?", "Dấu hiệu cần đánh giá khẩn", "Bình thường", "Chỉ cần ngủ", "Cho siro", "Đây là dấu nguy hiểm."),
    question("Vệ sinh cơ quan sinh dục trẻ nên thế nào?", "Nhẹ nhàng, tránh kích ứng", "Chà mạnh", "Dùng rượu", "Dùng hóa chất thơm", "Vệ sinh đơn giản thường là đủ."),
  ],
  safety: [
    question("Hóc nặng có thể biểu hiện thế nào?", "Im lặng, không ho hiệu quả", "Luôn ho to", "Luôn khóc lớn", "Luôn nói được", "Tắc nghẽn hoàn toàn có thể không tạo được âm thanh."),
    question("Có thể để trẻ một mình gần bồn tắm không?", "Không", "Có", "Một phút được", "Chỉ bé lớn", "Đuối nước có thể xảy ra rất nhanh."),
    question("Pin cúc áo nên được cất ở đâu?", "Khóa ngoài tầm trẻ", "Trên bàn", "Trong túi trẻ", "Trong đồ chơi mở", "Nuốt pin cúc áo là cấp cứu."),
    question("Sơ cứu hóc nên học từ đâu?", "Nguồn đào tạo chính thống", "Video ngẫu nhiên", "Truyền miệng", "Không cần", "Kỹ thuật phải đúng lứa tuổi."),
    question("Trẻ tím và không phát tiếng sau ăn cần làm gì?", "Xử trí cấp cứu", "Cho ngủ", "Cho siro", "Chờ một giờ", "Có thể là tắc nghẽn đường thở nặng."),
    question("Đồ nội thất nặng dễ đổ nên làm gì?", "Cố định", "Để tự do", "Kê sát trẻ", "Không cần", "Cố định giúp phòng chấn thương do đổ."),
    question("Thuốc và hóa chất nên được cất thế nào?", "Khóa ngoài tầm trẻ", "Để thấp", "Gọi là kẹo", "Cho trẻ cầm", "Phòng ngộ độc quan trọng hơn xử trí sau ngộ độc."),
    question("Nước nông có an toàn tuyệt đối không?", "Không", "Có", "Chỉ ban ngày", "Chỉ bé gái", "Trẻ nhỏ có thể đuối nước ở lượng nước ít."),
    question("Mục tiêu sơ cứu là gì?", "Xử trí đúng và gọi trợ giúp", "Tự điều trị mọi thứ", "Tìm thuốc trước", "Chờ", "Tình huống cấp cứu cần hành động đúng và sớm."),
    question("Phòng tai nạn có quan trọng không?", "Rất quan trọng", "Không", "Chỉ khi đi học", "Chỉ ngoài nhà", "Nhiều tai nạn trẻ em có thể phòng ngừa."),
  ],
  prevention: [
    question("Lịch vaccine có nên đóng cứng nhiều năm trong site không?", "Không", "Có", "Luôn giống nhau", "Không cần cập nhật", "Lịch tiêm chủng cần theo hướng dẫn hiện hành nơi trẻ sinh sống."),
    question("Tiêm chủng nên theo gì?", "Lịch hiện hành và tư vấn y tế", "Truyền miệng", "Mạng xã hội", "Chọn ngẫu nhiên", "Lịch phụ thuộc quốc gia và lịch sử tiêm thực tế."),
    question("Giáo trình này có thay thế bác sĩ không?", "Không", "Có", "Luôn có", "Chỉ dưới 1 tuổi", "Site hỗ trợ ghi nhớ và phân tầng nguy cơ, không chẩn đoán thay bác sĩ."),
    question("Có nên lưu hồ sơ tiêm chủng của trẻ?", "Có", "Không", "Chỉ nhớ", "Không cần", "Hồ sơ thực tế giúp tránh thiếu hoặc lặp vaccine."),
    question("Khám định kỳ nên theo dõi gì?", "Tăng trưởng và phát triển", "Chỉ cân nặng", "Chỉ chiều cao", "Chỉ răng", "Khám định kỳ đánh giá nhiều lĩnh vực."),
    question("Răng miệng có thuộc chăm sóc định kỳ không?", "Có", "Không", "Chỉ 5 tuổi", "Chỉ bé gái", "Răng miệng cần được chăm sóc từ sớm."),
    question("Trẻ có bệnh nền thì dùng thuốc thế nào?", "Theo bác sĩ", "Tự thay đổi", "Dùng bài thuốc bất kỳ", "Ngừng mọi thuốc", "Bệnh nền có thể làm thay đổi chỉ định và nguy cơ."),
    question("Checklist an toàn trong nhà nên được làm thế nào?", "Xem lại định kỳ", "Chỉ làm một lần", "Không cần", "Chỉ khi chuyển nhà", "Nguy cơ thay đổi khi trẻ phát triển kỹ năng mới."),
    question("Mục tiêu cuối khóa là gì?", "Chăm sóc an toàn và nhận ra dấu cần khám", "Tự chẩn đoán mọi bệnh", "Tự kê thuốc", "Không cần bác sĩ", "Cha mẹ cần biết giới hạn của tự chăm sóc."),
    question("Thông tin sức khỏe thay đổi theo thời gian cần làm gì?", "Cập nhật", "Giữ nguyên mãi", "Bỏ qua", "Chỉ hỏi bạn bè", "Hướng dẫn và lịch tiêm chủng cần được rà soát định kỳ."),
  ],
  schoolGrowth: [
    question("Từ 5–10 tuổi nên ghi tuổi theo cách nào?", "Theo số năm tuổi", "Theo số tháng", "Theo cân nặng", "Theo lớp học", "Nhóm tuổi học đường trong site dùng mốc 5–10 tuổi, không nhập tháng."),
    question("Theo dõi tăng trưởng nên nhìn gì?", "Xu hướng cân nặng, chiều cao và hoạt động", "Một lần cân", "So với bạn", "Chỉ số giày", "Một điểm đo không thay thế theo dõi xu hướng."),
    question("Mất kỹ năng đã có cần làm gì?", "Trao đổi với bác sĩ", "Chờ tự hết", "Tự mua thuốc bổ", "Ép luyện tập", "Mất kỹ năng là dấu cần được đánh giá."),
    question("Dấu hiệu nào cần lưu ý ở tuổi học đường?", "Mệt kéo dài, sụt cân hoặc tăng trưởng chậm rõ", "Một ngày ăn ít", "Đổi kiểu tóc", "Thích một món ăn", "Cần đặt dấu hiệu trong diễn biến và khám phù hợp."),
    question("Trẻ nên vận động thế nào?", "Đều đặn, phù hợp và an toàn", "Chỉ vận động cuối tuần", "Tập đến kiệt sức", "Không cần vận động", "Vận động hỗ trợ sức khỏe thể chất và tinh thần."),
    question("Chuẩn tăng trưởng có phải công cụ chẩn đoán duy nhất không?", "Không", "Có", "Luôn đúng tuyệt đối", "Chỉ cần nhìn biểu đồ", "Cần kết hợp khám và bối cảnh của từng trẻ."),
    question("Khi số đo thay đổi bất thường nên làm gì?", "Ghi lại và trao đổi với nhân viên y tế", "Tự dùng hormone", "Bỏ qua", "Ép ăn", "Không tự điều trị vấn đề tăng trưởng."),
    question("Giấc ngủ ảnh hưởng điều gì?", "Học tập, tâm trạng và sức khỏe", "Chỉ chiều cao", "Không ảnh hưởng", "Chỉ da", "Ngủ đủ giúp trẻ hoạt động và học tập tốt hơn."),
    question("Nên so sánh trẻ với ai?", "Với chính xu hướng của trẻ và chuẩn phù hợp", "Với bạn cùng lớp", "Với anh chị", "Với ảnh trên mạng", "Mỗi trẻ có bối cảnh và nhịp phát triển khác nhau."),
    question("Hồ sơ sức khỏe học đường nên có gì?", "Số đo, bệnh nền, thuốc đang dùng và ghi chú khám", "Chỉ tên trẻ", "Chỉ điểm số", "Không cần lưu", "Hồ sơ giúp trao đổi chính xác hơn khi đi khám."),
  ],
  schoolNutrition: [
    question("Bữa ăn của trẻ 5–10 tuổi nên ưu tiên gì?", "Đa dạng thực phẩm và đủ nhóm chất", "Chỉ thịt", "Chỉ nước ngọt", "Bỏ bữa sáng", "Tính đều đặn và đa dạng quan trọng hơn một món riêng lẻ."),
    question("Đồ uống nào nên hạn chế?", "Nước ngọt và đồ uống nhiều đường", "Nước lọc", "Sữa phù hợp", "Canh", "Đồ uống nhiều đường làm tăng nguy cơ sâu răng và dư năng lượng."),
    question("Khi ăn trẻ nên làm gì?", "Ngồi ăn, nhai kỹ và không vừa chạy vừa ăn", "Vừa chạy vừa ăn", "Ăn khi nằm", "Ăn một mình", "An toàn khi ăn vẫn quan trọng ở tuổi học đường."),
    question("Có nên ép trẻ ăn hết mọi thứ không?", "Không nên ép", "Luôn phải ép", "Chỉ ép rau", "Ép bằng phần thưởng", "Ép ăn có thể làm xấu quan hệ của trẻ với thức ăn."),
    question("Để phòng hóc nên làm gì?", "Cắt phù hợp, ăn chậm và không vừa ăn vừa chơi", "Ăn thật nhanh", "Ném thức ăn vào miệng", "Ăn khi chạy", "Giám sát và thói quen ăn an toàn vẫn cần thiết."),
    question("Nước uống hằng ngày nên ưu tiên gì?", "Nước lọc và dịch phù hợp", "Nước tăng lực", "Nước ngọt", "Chỉ nước có màu", "Không dùng nước tăng lực cho trẻ."),
    question("Dị ứng thực phẩm cần xử trí thế nào?", "Tránh tác nhân đã biết và có kế hoạch với bác sĩ", "Tự thử lại nhiều lần", "Bỏ qua sưng môi", "Cho ăn thêm", "Phản ứng nặng cần xử trí y tế khẩn."),
    question("Đau bụng tái diễn nên làm gì?", "Ghi thời điểm, thức ăn và trao đổi với bác sĩ", "Tự dùng men/thuốc kéo dài", "Bỏ bữa", "Không cần ghi", "Nhật ký giúp tìm mối liên quan nhưng không thay khám."),
    question("Thói quen nào bảo vệ răng?", "Đánh răng với kem có fluoride phù hợp và khám răng", "Uống nước ngọt trước ngủ", "Không cần đánh răng", "Dùng kẹo thay đánh răng", "Chăm sóc răng cần đều đặn và theo hướng dẫn nha khoa."),
    question("Bữa ăn ở trường cần lưu ý gì?", "Vệ sinh, dị ứng và khả năng ăn của trẻ", "Chỉ nhìn hình thức", "Cho trẻ đổi đồ tùy ý", "Không cần báo dị ứng", "Thông tin dị ứng phải được thông báo rõ cho người chăm sóc."),
  ],
  schoolSleepMind: [
    question("Điều gì giúp trẻ 5–10 tuổi ngủ tốt hơn?", "Giờ ngủ đều và giảm màn hình trước ngủ", "Màn hình đến khi ngủ", "Uống nước tăng lực", "Ngủ bù cả tuần", "Nhịp sinh hoạt ổn định hỗ trợ giấc ngủ."),
    question("Màn hình nên được quản lý thế nào?", "Có giới hạn, nội dung phù hợp và có thời gian không màn hình", "Để trẻ tự dùng cả ngày", "Dùng khi ăn mọi bữa", "Dùng thay ngủ", "Cần cân bằng màn hình với ngủ, vận động và tương tác."),
    question("Dấu hiệu tâm lý kéo dài cần lưu ý là gì?", "Buồn bã, lo sợ, cáu gắt hoặc rút lui kéo dài", "Một lần cáu", "Thích ở nhà một buổi", "Đổi sở thích", "Diễn biến kéo dài và ảnh hưởng sinh hoạt cần được lắng nghe."),
    question("Khi trẻ bị bắt nạt nên làm gì?", "Lắng nghe, ghi nhận và phối hợp người lớn đáng tin", "Bảo trẻ chịu đựng", "Đổ lỗi cho trẻ", "Im lặng hoàn toàn", "An toàn thể chất và tinh thần cần được ưu tiên."),
    question("Cách hỗ trợ trẻ nói về cảm xúc là gì?", "Hỏi mở và lắng nghe không phán xét", "Ngắt lời", "Chê là yếu đuối", "Ép kể ngay", "Không khí an toàn giúp trẻ chia sẻ."),
    question("Ngủ ngáy to kèm ngừng thở nên làm gì?", "Trao đổi với bác sĩ", "Bỏ qua", "Tự mua thuốc ngủ", "Cho thức khuya", "Rối loạn hô hấp khi ngủ cần được đánh giá."),
    question("Khi trẻ học sa sút đột ngột nên làm gì?", "Xem cả sức khỏe, giấc ngủ, cảm xúc và môi trường", "Chỉ phạt", "Tự tăng thuốc bổ", "Bỏ qua", "Không nên quy mọi thay đổi cho sự lười biếng."),
    question("Hoạt động nào bảo vệ sức khỏe tinh thần?", "Vận động, chơi, trò chuyện và thời gian gia đình", "Cô lập", "Chỉ học", "Chỉ dùng màn hình", "Trẻ cần nhịp sống cân bằng."),
    question("Dấu hiệu nguy hiểm về tự hại cần làm gì?", "Ở bên trẻ và tìm trợ giúp khẩn cấp ngay", "Giữ bí mật tuyệt đối", "Mắng trẻ", "Chờ tự hết", "An toàn tức thời quan trọng hơn việc giữ kín."),
    question("Lịch sinh hoạt nên được thay đổi ra sao?", "Điều chỉnh từng bước và nhất quán", "Đổi toàn bộ mỗi ngày", "Ép trẻ thức", "Bỏ ngủ trưa tùy ý", "Thói quen bền vững cần điều chỉnh phù hợp."),
  ],
  schoolRespiratory: [
    question("Từ 5–10 tuổi khi đánh giá hô hấp cần ưu tiên gì?", "Công thở, màu môi, mức tỉnh táo và khả năng nói/uống", "Chỉ đếm nhịp thở", "Chỉ nghe tiếng ho", "Chỉ nhìn nhiệt độ", "Ngưỡng IMCI 0–5 tuổi không được áp dụng máy móc cho nhóm này."),
    question("Khó thở rõ có thể nhận ra qua dấu nào?", "Rút lõm, phập phồng cánh mũi, nói không trọn câu", "Chỉ sổ mũi", "Ăn tốt", "Chơi bình thường", "Công thở và toàn trạng quan trọng."),
    question("Ho kèm đau ngực hoặc khó thở khi vận động nên làm gì?", "Cho trẻ được đánh giá y tế", "Tự dùng kháng sinh", "Bỏ qua", "Cho chạy thêm", "Cần đặt triệu chứng vào bối cảnh cụ thể."),
    question("Ho giảm nhưng trẻ mệt và thở gắng sức nghĩa là gì?", "Cần đánh giá lại", "Chắc chắn khỏi", "Cho thêm thuốc ho", "Không cần theo dõi", "Không dùng riêng tiếng ho để kết luận hồi phục."),
    question("Khò khè tái diễn nên được theo dõi thế nào?", "Ghi yếu tố khởi phát và trao đổi với bác sĩ", "Tự dùng thuốc xịt của người khác", "Bỏ qua", "Dùng tinh dầu", "Thuốc hô hấp cần đúng người, đúng chỉ định."),
    question("Sốt kèm lừ đừ hoặc khó đánh thức là gì?", "Dấu cần đánh giá khẩn", "Cảm lạnh bình thường", "Chỉ cần ngủ", "Cho nước ngọt", "Giảm tỉnh táo là dấu cảnh báo."),
    question("Có nên tự dùng kháng sinh khi ho đờm?", "Không", "Có", "Luôn cần", "Dùng còn thừa", "Kháng sinh phải dựa trên đánh giá và chỉ định."),
    question("Khi trẻ khó thở nên cho ăn thế nào?", "Không ép ăn/uống khi trẻ đang khó thở nặng", "Ép thật nhiều", "Cho ăn khi nằm", "Cho kẹo", "Ưu tiên an toàn đường thở và đánh giá y tế."),
    question("SpO₂ tại nhà nên được hiểu thế nào?", "Là một dữ liệu phụ, phải nhìn cùng tình trạng trẻ", "Luôn chính xác tuyệt đối", "Thay thế khám", "Không bao giờ có ích", "Máy gia đình có thể sai số và không loại trừ nguy hiểm."),
    question("Dấu nào cần cấp cứu ngay?", "Tím, ngưng thở, li bì hoặc khó thở rõ", "Hắt hơi", "Ho nhẹ", "Sổ mũi", "Dấu đỏ phải được xử trí khẩn."),
  ],
  schoolSafety: [
    question("Nguy cơ an toàn quan trọng ở tuổi 5–10 là gì?", "Giao thông, nước, điện, ngã và ngộ độc", "Chỉ hóc", "Không còn nguy cơ", "Chỉ ở trường", "Nguy cơ thay đổi theo kỹ năng và môi trường."),
    question("Trẻ nên làm gì khi qua đường?", "Dừng, quan sát, nghe và qua nơi an toàn có người hướng dẫn", "Chạy nhanh", "Vừa nhìn điện thoại vừa đi", "Đi giữa dòng xe", "Kỹ năng giao thông cần luyện lặp lại."),
    question("Bơi giỏi có đồng nghĩa an toàn tuyệt đối không?", "Không", "Có", "Chỉ cần biết nổi", "Chỉ cần phao", "Luôn cần giám sát gần nước."),
    question("Khi nghi ngộ độc nên làm gì?", "Gọi trợ giúp y tế và giữ lại bao bì chất nghi ngờ", "Tự gây nôn", "Cho uống sữa bất kỳ", "Chờ đến hôm sau", "Không tự gây nôn nếu chưa được hướng dẫn."),
    question("Pin cúc áo nếu nuốt phải cần làm gì?", "Đưa đi cấp cứu ngay", "Chờ đi ngoài", "Cho ăn cơm", "Tự móc họng", "Pin cúc áo có thể gây tổn thương nhanh."),
    question("Mũ bảo hiểm cần thế nào?", "Đúng cỡ, cài đúng và dùng khi đi xe", "Đội hờ", "Chỉ đội đường xa", "Dùng mũ đồ chơi", "Bảo vệ đầu cần dùng đúng cách."),
    question("Bỏng mới xảy ra nên làm gì trước?", "Làm mát bằng nước sạch mát và tìm trợ giúp phù hợp", "Bôi kem bất kỳ", "Đắp kem đánh răng", "Chọc vỡ bóng nước", "Không bôi chất dân gian lên bỏng."),
    question("Trẻ bị đánh vào đầu cần theo dõi gì?", "Nôn lặp lại, lơ mơ, co giật hoặc đau tăng", "Chỉ vết xước", "Cho ngủ không kiểm tra", "Tự dùng thuốc", "Dấu thần kinh sau chấn thương cần đánh giá."),
    question("Kỹ năng sơ cứu nên học từ đâu?", "Khóa đào tạo và nguồn chính thống", "Video bất kỳ", "Truyền miệng", "Đoán theo kinh nghiệm", "Sơ cứu sai có thể gây hại."),
    question("Phòng tai nạn có cần rà soát định kỳ không?", "Có", "Không", "Chỉ khi trẻ nhỏ", "Chỉ sau tai nạn", "Kỹ năng mới của trẻ tạo ra nguy cơ mới."),
  ],
  schoolPrevention: [
    question("Trẻ 5–10 tuổi cần hồ sơ phòng bệnh nào?", "Tiêm chủng, răng miệng, mắt và khám định kỳ", "Chỉ cân nặng", "Chỉ điểm số", "Không cần hồ sơ", "Theo dõi sức khỏe học đường gồm nhiều lĩnh vực."),
    question("Lịch tiêm chủng nên dựa vào đâu?", "Lịch hiện hành và hồ sơ thực tế", "Lịch trên mạng cũ", "Nhớ bằng miệng", "Tự tiêm thêm", "Lịch có thể thay đổi theo nơi sống và tiền sử tiêm."),
    question("Khám mắt nên chú ý dấu nào?", "Nheo mắt, nhìn gần, đau đầu hoặc nhìn mờ", "Chỉ màu mắt", "Chỉ chiều cao", "Không cần hỏi trẻ", "Dấu hiệu nhìn bất thường nên được kiểm tra."),
    question("Răng vĩnh viễn cần chăm sóc thế nào?", "Đánh răng đều và khám nha khoa", "Chờ đau mới khám", "Tự nhổ răng", "Chỉ súc nước ngọt", "Phòng bệnh răng miệng quan trọng hơn chờ đau."),
    question("Trẻ có bệnh nền nên chuẩn bị gì ở trường?", "Kế hoạch chăm sóc đã thống nhất với gia đình và nhà trường", "Giấu hoàn toàn", "Cho bạn tự xử lý", "Tự đổi thuốc", "Thông tin an toàn cần được chia sẻ đúng người."),
    question("Đau đầu tái diễn nên làm gì?", "Ghi thời điểm, yếu tố liên quan và trao đổi với bác sĩ", "Tự dùng thuốc thường xuyên", "Bỏ qua", "Nhịn ăn", "Nhật ký giúp bác sĩ đánh giá đầy đủ hơn."),
    question("Tầm soát sức khỏe tinh thần có ý nghĩa gì?", "Phát hiện sớm khó khăn để hỗ trợ", "Dán nhãn trẻ", "Xếp loại trẻ", "Thay thế trò chuyện", "Sàng lọc không phải chẩn đoán."),
    question("Thuốc của trẻ ở trường cần quản lý ra sao?", "Theo quy định và kế hoạch của bác sĩ/gia đình", "Bạn bè tự cho", "Chia thuốc của người khác", "Để trong cặp không báo ai", "Không dùng thuốc kê cho trẻ khác."),
    question("Mục tiêu của site ở nhóm 5–10 tuổi là gì?", "Theo dõi, phòng ngừa và nhận ra dấu cần khám", "Tự chẩn đoán", "Tự kê thuốc", "Thay bác sĩ", "Site chỉ hỗ trợ ghi nhớ và chuẩn bị trao đổi y tế."),
    question("Khi hướng dẫn y tế thay đổi nên làm gì?", "Cập nhật nội dung đã được kiểm duyệt", "Giữ nguyên mãi", "Tin bài cũ", "Tự sửa thuốc", "Nội dung sức khỏe cần được rà soát định kỳ."),
  ],
};

function lesson(number: HealthLessonNumber, title: string, summary: string, html: string, safety: string[], steps: string[], analysis: string, points: string[], questions: HealthQuestion[], ageBand: HealthAgeBand = "under5"): HealthLesson {
  return { number, ageBand, title, summary, content: { html, safety }, practice: { steps }, analysis: { html: analysis }, review: { points }, quiz: { questions } };
}

const schoolLessons: Record<Extract<HealthLessonNumber, "09" | "10" | "11" | "12" | "13" | "14">, HealthLesson> = {
  "09": lesson("09", "Tăng trưởng & sức khỏe học đường", "Theo dõi trẻ 5–10 tuổi theo năm, nhìn xu hướng phát triển và hồ sơ sức khỏe học đường.", "<h3>Mốc tuổi mới: 5–10 tuổi</h3><p>Từ 5 tuổi trở đi, hồ sơ của site dùng số năm tuổi, không yêu cầu nhập tháng. Cần nhìn cân nặng, chiều cao, vận động, giấc ngủ, học tập và tâm trạng theo thời gian; một lần đo không đủ để kết luận.</p>", ["Sụt cân rõ, mệt kéo dài, mất kỹ năng hoặc tăng trưởng thay đổi nhanh cần được đánh giá.", "Không tự dùng hormone, thuốc bổ hoặc sản phẩm tăng chiều cao."], ["Chọn nhóm 5–10 tuổi và nhập số năm tuổi.", "Ghi cân nặng, chiều cao và ngày đo.", "Ghi diễn biến học tập, ngủ và vận động nếu có thay đổi.", "Mang hồ sơ khi đi khám."], "<p>Trẻ ở tuổi học đường có thể thay đổi do bệnh, dinh dưỡng, giấc ngủ, tâm lý hoặc môi trường. Hãy dùng nhật ký để nhận ra xu hướng và đặt câu hỏi đúng khi khám.</p>", ["Tuổi 5–10 nhập theo năm, không theo tháng.", "Nhìn xu hướng chứ không xếp hạng trẻ.", "Sụt cân hoặc mất kỹ năng cần được đánh giá."], Q.schoolGrowth, "school5to10"),
  "10": lesson("10", "Dinh dưỡng, vận động & răng miệng", "Tổ chức bữa ăn, vận động và chăm sóc răng cho trẻ trong gia đình và ở trường.", "<h3>Nếp sống là nền tảng</h3><p>Ưu tiên bữa ăn đa dạng, nước lọc, vận động đều đặn và đánh răng đúng cách. Hạn chế nước ngọt, đồ ăn vặt nhiều đường và thói quen vừa ăn vừa chạy/chơi.</p>", ["Không ép ăn hoặc tự bổ sung sản phẩm tăng chiều cao.", "Dị ứng thực phẩm, đau bụng tái diễn hoặc sụt cân cần trao đổi y tế."], ["Ghi món gây khó chịu hoặc phản ứng nếu có.", "Chuẩn bị nước lọc và bữa phụ phù hợp.", "Duy trì vận động hằng ngày.", "Đánh răng và đặt lịch khám răng."], "<p>Ở tuổi 5–10, sức khỏe không chỉ nằm ở cân nặng. Năng lượng khi học và chơi, giấc ngủ, răng miệng và mối quan hệ với thức ăn cũng là dữ liệu quan trọng.</p>", ["Ăn đa dạng, uống nước lọc.", "Không ép ăn và không tự dùng thuốc bổ.", "Theo dõi răng, dị ứng và đau bụng tái diễn."], Q.schoolNutrition, "school5to10"),
  "11": lesson("11", "Ngủ, màn hình & sức khỏe tinh thần", "Nhận biết thay đổi kéo dài về giấc ngủ, cảm xúc, học tập và các mối quan hệ.", "<h3>Trẻ lớn vẫn cần được bảo vệ</h3><p>Giờ ngủ đều, vận động, trò chuyện và khoảng thời gian không màn hình giúp trẻ phục hồi. Buồn bã, lo sợ, cáu gắt, rút lui hoặc sa sút học tập kéo dài cần được lắng nghe và hỗ trợ.</p>", ["Không dùng thuốc ngủ hoặc thuốc an thần cho trẻ nếu chưa có chỉ định.", "Nếu trẻ nói về tự hại hoặc không an toàn, cần ở bên và tìm trợ giúp khẩn cấp."], ["Hỏi trẻ bằng câu mở và lắng nghe.", "Ghi giờ ngủ, thời gian màn hình và thay đổi cảm xúc.", "Phối hợp gia đình–nhà trường khi cần.", "Tìm hỗ trợ chuyên môn nếu dấu hiệu kéo dài."], "<p>Không nên quy mọi khó khăn của trẻ cho lười biếng hay bướng bỉnh. Hãy xem cả sức khỏe thể chất, giấc ngủ, áp lực học tập, bắt nạt và môi trường gia đình.</p>", ["Lắng nghe không phán xét.", "Ngủ và màn hình ảnh hưởng sức khỏe toàn diện.", "Dấu hiệu kéo dài hoặc tự hại cần hỗ trợ sớm."], Q.schoolSleepMind, "school5to10"),
  "12": lesson("12", "Hô hấp & bệnh học đường", "Đánh giá khó thở ở trẻ 5–10 tuổi bằng công thở, màu môi, tỉnh táo và khả năng nói/uống.", "<h3>Không áp dụng máy móc ngưỡng dưới 5 tuổi</h3><p>Ở nhóm 5–10 tuổi, site không dùng ngưỡng thở nhanh IMCI của trẻ dưới 5 tuổi để tự kết luận. Khi trẻ khó thở, hãy quan sát rút lõm, phập phồng cánh mũi, tím, khả năng nói thành câu, uống và mức tỉnh táo.</p>", ["Tím, ngưng thở, li bì, khó thở rõ hoặc không nói/uống được là dấu cần cấp cứu.", "Không tự dùng kháng sinh, corticoid hoặc thuốc xịt của người khác."], ["Để trẻ ngồi thoải mái và quan sát công thở.", "Đếm nhịp thở đủ 60 giây khi trẻ yên nếu có thể.", "Ghi sốt, SpO₂ nếu có và diễn biến.", "Đưa đi đánh giá khi dấu hiệu tăng."], "<p>Ho ít hơn không luôn đồng nghĩa với hồi phục. Nếu trẻ mệt hơn, thở gắng sức, uống kém hoặc màu môi bất thường, cần đánh giá lại dù tiếng ho đã giảm.</p>", ["Tuổi 5–10 không dùng ngưỡng IMCI 0–5 tuổi máy móc.", "Công thở và toàn trạng là trọng tâm.", "Dấu đỏ cần cấp cứu."], Q.schoolRespiratory, "school5to10"),
  "13": lesson("13", "An toàn, giao thông & sơ cứu", "Phòng tai nạn theo kỹ năng mới của trẻ: đường phố, nước, điện, bỏng, ngã và ngộ độc.", "<h3>Nguy cơ thay đổi theo khả năng</h3><p>Trẻ 5–10 tuổi di chuyển độc lập hơn nhưng chưa luôn đánh giá được nguy hiểm. Cần luyện kỹ năng qua đường, quy tắc gần nước, mũ bảo hiểm, không tự dùng thuốc và cách gọi người lớn khi có sự cố.</p>", ["Không để trẻ tự xử trí ngộ độc hoặc chấn thương nặng.", "Không tự gây nôn, bôi chất dân gian lên bỏng hoặc cho thuốc của người khác."], ["Rà soát lối đi và thiết bị trong nhà.", "Luyện quy tắc qua đường và dùng mũ bảo hiểm.", "Dạy trẻ gọi người lớn khi không an toàn.", "Học sơ cứu từ nguồn đào tạo chính thống."], "<p>Phòng tai nạn phải được cập nhật khi trẻ biết leo, chạy, tự đi học, dùng thiết bị hoặc ở gần nước. Bơi biết kỹ thuật vẫn không thay thế giám sát.</p>", ["Biết bơi không đồng nghĩa an toàn tuyệt đối.", "Pin cúc áo và ngộ độc cần cấp cứu.", "Sơ cứu phải đúng kỹ thuật và đúng tình huống."], Q.schoolSafety, "school5to10"),
  "14": lesson("14", "Khám định kỳ & hồ sơ sức khỏe", "Tổ chức tiêm chủng, khám răng–mắt, bệnh nền và thông tin cần trao đổi với bác sĩ.", "<h3>Biết chuẩn bị cho lần khám</h3><p>Lưu hồ sơ tiêm chủng, thuốc đang dùng, dị ứng, bệnh nền, số đo và các thay đổi ở nhà/trường. Site không đóng cứng lịch vaccine; hãy đối chiếu lịch hiện hành và hồ sơ thật của trẻ.</p>", ["Không tự đổi thuốc đang điều trị hoặc dùng đơn thuốc của trẻ khác.", "Sàng lọc và nhật ký không thay thế chẩn đoán."], ["Chụp/lưu hồ sơ tiêm chủng và lần khám.", "Ghi câu hỏi trước khi đi khám.", "Mang theo danh sách thuốc, dị ứng và diễn biến.", "Cập nhật kế hoạch chăm sóc với nhà trường nếu cần."], "<p>Một hồ sơ ngắn nhưng có ngày tháng, triệu chứng, thuốc và diễn biến sẽ giúp cuộc trao đổi y tế hiệu quả hơn. Khi hướng dẫn thay đổi, nội dung cần được cập nhật qua quy trình biên tập.</p>", ["Tuổi 5–10 theo năm.", "Lưu hồ sơ răng, mắt, vaccine và bệnh nền.", "Dùng site để chuẩn bị trao đổi, không tự kê đơn."], Q.schoolPrevention, "school5to10"),
};

export function staticHealthCourseDocument(): HealthCourseDocument {
  return {
    schemaVersion: 2,
    application: "child-health",
    policyVersion: HEALTH_POLICY_VERSION,
    reviewedOn: "2026-09-05",
    title: "Giáo trình chăm sóc sức khỏe trẻ 9 tháng – 10 tuổi",
    passScore: 8,
    lessons: {
      "01": lesson("01", "Hồ sơ sức khỏe & tăng trưởng", "Theo dõi tuổi, giới, cân nặng, chiều cao và phát triển theo xu hướng.", "<h3>Theo dõi theo thời gian</h3><p>Không kết luận tình trạng tăng trưởng chỉ từ một lần cân đo. Dùng chuẩn WHO đúng giới và theo dõi xu hướng cân nặng, chiều dài/chiều cao cùng sự phát triển.</p>", ["Sụt cân rõ, ăn uống giảm kéo dài hoặc mất kỹ năng đã có cần được đánh giá."], ["Ghi tuổi theo tháng.", "Đo cân nặng và chiều cao bằng phương pháp nhất quán.", "Lưu số đo theo ngày.", "Theo dõi cả vận động, ngôn ngữ và tương tác."], "<p>Cân nặng đứng yên ngay sau một đợt bệnh không tự động đồng nghĩa bệnh nặng; cần nhìn quá trình hồi phục và đường tăng trưởng.</p>", ["Theo dõi xu hướng, không chỉ một con số.", "Dùng chuẩn tăng trưởng đúng giới.", "Mất kỹ năng đã có là dấu cần đánh giá."], Q.growth),
      "02": lesson("02", "Dinh dưỡng & chống hóc", "Ăn phù hợp độ tuổi, đủ dịch và giảm nguy cơ hóc.", "<h3>Ăn an toàn</h3><p>Trẻ cần thực phẩm phù hợp khả năng nhai nuốt, ngồi khi ăn và luôn có người lớn giám sát.</p>", ["Không mật ong dưới 12 tháng.", "Không để trẻ nhỏ vừa chạy vừa ăn.", "Tránh thức ăn cứng/tròn nguyên miếng có nguy cơ hóc."], ["Kiểm tra tư thế ngồi.", "Cắt nhỏ thực phẩm nguy cơ.", "Cho đủ dịch phù hợp tuổi.", "Không ép ăn khi trẻ khó thở hoặc nôn nhiều."], "<p>Ăn ít một bữa có thể không đáng lo; uống giảm rõ, tiểu ít và mệt dần quan trọng hơn.</p>", ["Dưới 12 tháng không mật ong.", "Ăn có giám sát.", "Uống kém và tiểu ít cần chú ý."], Q.nutrition),
      "03": lesson("03", "Ngủ, vận động & phát triển", "Theo dõi giấc ngủ, vận động, giao tiếp và kỹ năng theo tuổi.", "<h3>Phát triển toàn diện</h3><p>Mốc phát triển là công cụ sàng lọc, không phải cuộc thi. 9–11 tháng thường ngủ 12–16 giờ; 1–2 tuổi 11–14 giờ; 3–5 tuổi 10–13 giờ trong 24 giờ.</p>", ["Mất kỹ năng đã có cần được đánh giá."], ["Duy trì giờ ngủ tương đối đều.", "Chơi tương tác hằng ngày.", "Đọc và nói chuyện với trẻ.", "Ghi lại kỹ năng mới."], "<p>Nếu trẻ từng dùng một kỹ năng rồi mất kỹ năng đó kéo dài, không nên chỉ chờ đợi mà cần trao đổi với bác sĩ.</p>", ["Ngủ đủ theo tuổi.", "Ưu tiên tương tác thật.", "Không gây áp lực vì mốc phát triển."], Q.development),
      "04": lesson("04", "Ho, sổ mũi & đường hô hấp", "Không dập ho sai cách; theo dõi nhịp thở, công thở và toàn trạng.", "<h3>Ho là một cơ chế bảo vệ</h3><p>Khi trẻ có nhiều chất tiết, mục tiêu không phải làm hết ho bằng mọi giá. Hỗ trợ thông mũi, đủ dịch và theo dõi hô hấp.</p><p>WHO IMCI: 2–&lt;12 tháng thở nhanh từ 50 lần/phút; 12 tháng–&lt;5 tuổi từ 40 lần/phút khi trẻ ho/khó thở, đếm đủ một phút lúc trẻ yên.</p>", ["Rút lõm ngực, tím, ngưng thở, khó đánh thức hoặc khó thở rõ là dấu nguy hiểm.", "Không tự dùng corticoid chỉ để cắt ho.", "Ho có đờm không tự động là chỉ định kháng sinh."], ["Làm sạch mũi bằng NaCl 0,9% khi nghẹt.", "Đếm nhịp thở đủ 60 giây lúc trẻ yên.", "Theo dõi rút lõm ngực và màu môi.", "Theo dõi lượng uống, tiểu và mức tỉnh táo."], "<p>Ho giảm nhưng nhịp thở tăng, SpO₂ giảm, ăn/uống giảm hoặc trẻ mệt hơn không được coi là hồi phục. Cần đánh giá lại theo các chỉ số quan trọng hơn tiếng ho.</p>", ["Không lấy hết ho làm mục tiêu.", "Đếm nhịp thở đủ một phút.", "Ít ho hơn không đồng nghĩa phổi tốt hơn."], Q.respiratory),
      "05": lesson("05", "Sốt & sử dụng thuốc an toàn", "Đọc đúng hoạt chất, tránh trùng thuốc và không tự lạm dụng corticoid/kháng sinh.", "<h3>Điều trị trẻ, không chỉ điều trị con số</h3><p>Sốt là triệu chứng. Quan trọng là toàn trạng, khả năng uống, dấu mất nước và nguyên nhân.</p>", ["Không tự phối nhiều thuốc cảm vì có thể trùng hoạt chất.", "Không tự dùng aspirin cho trẻ.", "Corticoid không phải thuốc kháng viêm nhẹ."], ["Ghi nhiệt độ và thời điểm đo.", "Kiểm tra hoạt chất/nồng độ.", "Dùng dụng cụ đong thuốc chuẩn.", "Ghi giờ đã dùng thuốc."], "<p>Hai sản phẩm có tên thương mại khác nhau vẫn có thể chứa cùng hoạt chất; đọc thành phần giúp giảm nguy cơ dùng lặp.</p>", ["Sốt là triệu chứng.", "Kiểm tra hoạt chất/nồng độ.", "Không tự phối nhiều thuốc cảm."], Q.fever),
      "06": lesson("06", "Tiêu hóa, da & vệ sinh", "Nhận biết mất nước và chăm sóc da/cơ quan sinh dục nhẹ nhàng.", "<h3>Tiêu hóa và vệ sinh</h3><p>Khi nôn hoặc tiêu chảy, theo dõi lượng uống, tiểu và tỉnh táo. Da kích ứng nên tránh sản phẩm thơm và thuốc bôi mạnh không rõ chỉ định.</p>", ["Không cố tuột bao quy đầu bé trai.", "Bé gái nên được dạy lau từ trước ra sau.", "Không tự bôi corticoid mạnh trên diện rộng."], ["Theo dõi số lần tiểu.", "Thay tã khi ướt/bẩn.", "Vệ sinh nhẹ bên ngoài.", "Quan sát dấu mất nước."], "<p>Tiêu chảy kèm li bì, không uống được hoặc tiểu rất ít khác hoàn toàn tiêu chảy khi trẻ vẫn uống và hoạt động tốt.</p>", ["Mất nước là nguy cơ chính khi nôn/tiêu chảy.", "Vệ sinh nhẹ nhàng.", "Không tự dùng thuốc bôi mạnh."], Q.hygiene),
      "07": lesson("07", "An toàn & sơ cứu cần nhớ", "Phòng hóc, đuối nước, bỏng, ngã và ngộ độc.", "<h3>Phòng tai nạn trước</h3><p>Không để trẻ một mình gần nước; khóa thuốc, hóa chất và pin cúc áo; cố định đồ dễ đổ và phòng bỏng.</p>", ["Hóc nặng có thể im lặng.", "Tím và không phát tiếng sau ăn có thể là tắc đường thở nặng.", "Sơ cứu cần học đúng kỹ thuật theo lứa tuổi."], ["Kiểm tra nhà ở ngang tầm trẻ.", "Khóa hóa chất và pin.", "Giám sát liên tục gần nước.", "Học sơ cứu hóc/CPR từ nguồn chính thống."], "<p>Khi trẻ không ho/nói/khóc hiệu quả và tím dần sau ăn, không mất thời gian tìm thuốc; đây là tình huống cấp cứu.</p>", ["Hóc có thể im lặng.", "Nước nông vẫn nguy hiểm.", "Pin cúc áo là dị vật nguy hiểm."], Q.safety),
      "08": lesson("08", "Tiêm chủng, khám định kỳ & kế hoạch gia đình", "Tổ chức chăm sóc phòng bệnh và biết giới hạn của tự chăm sóc.", "<h3>Phòng bệnh có hệ thống</h3><p>Tiêm chủng theo lịch hiện hành tại nơi trẻ sinh sống và hồ sơ vaccine thực tế. Site không đóng cứng lịch vaccine nhiều năm.</p>", ["Giáo trình không thay thế khám, chẩn đoán hoặc kê đơn.", "Bệnh nền có thể làm thay đổi cách đánh giá và điều trị."], ["Lưu hồ sơ tiêm chủng.", "Ghi các lần khám quan trọng.", "Theo dõi răng miệng và phát triển.", "Xem lại checklist an toàn định kỳ."], "<p>Nội dung phụ thuộc vaccine, thuốc kê đơn, bệnh nền hoặc chẩn đoán cần dựa trên hướng dẫn hiện hành và đánh giá cá nhân.</p>", ["Tiêm chủng theo lịch hiện hành.", "Lưu hồ sơ thật của trẻ.", "Biết giới hạn của tự chăm sóc."], Q.prevention),
      ...schoolLessons,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, max = 20_000) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

export function validateHealthCourseDocument(value: unknown) {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["Gói nội dung phải là một đối tượng."] };
  if (value.schemaVersion !== HEALTH_DOCUMENT_SCHEMA_VERSION) errors.push("Sai phiên bản cấu trúc nội dung.");
  if (value.application !== "child-health") errors.push("Sai mã ứng dụng nội dung.");
  if (value.policyVersion !== HEALTH_POLICY_VERSION) errors.push("Không được thay đổi phiên bản chính sách an toàn lâm sàng từ trình biên tập.");
  if (value.passScore !== 8) errors.push("Điểm đạt kiểm tra phải giữ ở mức 8/10.");
  if (!cleanText(value.title, 200)) errors.push("Thiếu tiêu đề giáo trình.");
  if (!isRecord(value.lessons)) errors.push("Thiếu danh sách bài học.");
  const lessons = isRecord(value.lessons) ? value.lessons : {};
  for (const number of HEALTH_LESSON_NUMBERS) {
    const lessonValue = lessons[number];
    if (!isRecord(lessonValue)) { errors.push(`Thiếu Bài ${number}.`); continue; }
    if (lessonValue.number !== number) errors.push(`Bài ${number}: mã bài không hợp lệ.`);
    if (lessonValue.ageBand !== "under5" && lessonValue.ageBand !== "school5to10") errors.push(`Bài ${number}: thiếu nhóm tuổi hợp lệ.`);
    if (!cleanText(lessonValue.title, 180) || !cleanText(lessonValue.summary, 600)) errors.push(`Bài ${number}: thiếu tiêu đề hoặc giới thiệu.`);
    const content = isRecord(lessonValue.content) ? lessonValue.content : null;
    const practice = isRecord(lessonValue.practice) ? lessonValue.practice : null;
    const analysis = isRecord(lessonValue.analysis) ? lessonValue.analysis : null;
    const review = isRecord(lessonValue.review) ? lessonValue.review : null;
    const quiz = isRecord(lessonValue.quiz) ? lessonValue.quiz : null;
    if (!content || !cleanText(content.html) || !Array.isArray(content.safety)) errors.push(`Bài ${number}: phần Nội dung chưa hợp lệ.`);
    if (!practice || !Array.isArray(practice.steps) || practice.steps.length < 3) errors.push(`Bài ${number}: phần Thực hành cần ít nhất 3 bước.`);
    if (!analysis || !cleanText(analysis.html)) errors.push(`Bài ${number}: phần Phân tích chưa hợp lệ.`);
    if (!review || !Array.isArray(review.points) || review.points.length < 3) errors.push(`Bài ${number}: phần Ôn tập cần ít nhất 3 điểm.`);
    const questions = quiz && Array.isArray(quiz.questions) ? quiz.questions : [];
    if (questions.length !== 10) errors.push(`Bài ${number}: phải có đúng 10 câu kiểm tra.`);
    questions.forEach((raw, index) => {
      if (!isRecord(raw) || !cleanText(raw.q, 1000) || !Array.isArray(raw.options) || raw.options.length !== 4
          || raw.options.some((option) => !cleanText(option, 500)) || !Number.isInteger(raw.answer) || Number(raw.answer) < 0 || Number(raw.answer) > 3
          || !cleanText(raw.explain, 1500)) errors.push(`Bài ${number}: Câu ${index + 1} chưa hợp lệ.`);
    });
  }
  try {
    if (JSON.stringify(value).length > 500_000) errors.push("Gói nội dung vượt giới hạn 500 KB.");
  } catch { errors.push("Không thể mã hóa gói nội dung."); }
  return { valid: errors.length === 0, errors };
}

export function parseHealthEditScope(value: unknown): HealthEditScope | null {
  if (typeof value !== "string") return null;
  const [lessonValue, sectionValue, ...rest] = value.split(":");
  if (rest.length || !HEALTH_LESSON_NUMBERS.includes(lessonValue as HealthLessonNumber) || !HEALTH_EDIT_SECTIONS.includes(sectionValue as HealthEditSection)) return null;
  const lessonNumber = lessonValue as HealthLessonNumber;
  const section = sectionValue as HealthEditSection;
  const sectionLabel = sectionLabels[section];
  return { lessonNumber, section, sectionLabel, label: `Sức khỏe trẻ · Bài ${lessonNumber} · ${sectionLabel}`, value };
}

export function createHealthEditScope(lesson: unknown, section: unknown) {
  return parseHealthEditScope(`${String(lesson ?? "")}:${String(section ?? "")}`);
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

export function healthEditSectionFromDocument(document: HealthCourseDocument, scope: HealthEditScope) {
  return clone(document.lessons[scope.lessonNumber][scope.section]);
}

export function replaceHealthEditSection(document: HealthCourseDocument, scope: HealthEditScope, payload: unknown) {
  const next = clone(document);
  (next.lessons[scope.lessonNumber] as unknown as Record<string, unknown>)[scope.section] = clone(payload);
  return next;
}

export function parseHealthCourseDocument(value: string): HealthCourseDocument | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return validateHealthCourseDocument(parsed).valid ? parsed as HealthCourseDocument : null;
  } catch { return null; }
}

export async function publishedHealthCourseDocument(database: Database) {
  const row = await database.prepare(
    `SELECT payload_json FROM health_content_versions WHERE status = 'published' ORDER BY version_number DESC LIMIT 1`,
  ).first<{ payload_json: string }>();
  return row ? parseHealthCourseDocument(row.payload_json) ?? staticHealthCourseDocument() : staticHealthCourseDocument();
}

function publicVersion(row: HealthVersionRow, includePayload = false): PublicHealthContentVersion {
  const { payload_json, ...rest } = row;
  const reviewable = ["review", "published", "archived", "changes_requested"].includes(row.status);
  const scope = parseHealthEditScope(row.edit_scope);
  return {
    ...rest,
    application: "child-health",
    edit_lesson: scope?.lessonNumber ?? null,
    edit_section: scope?.section ?? null,
    edit_scope_label: scope?.label ?? null,
    ...(includePayload && reviewable ? { payload: parseHealthCourseDocument(payload_json) ?? undefined } : {}),
  };
}

export async function listHealthContentVersions(database: Database, includePayloadId?: string) {
  const result = await database.prepare(
    `SELECT id, version_number, status, payload_json, summary, created_by, editor_device_id, editor_device_code,
            edit_scope, permission_note, permission_reviewed_by, permission_reviewed_at, submitted_at,
            reviewed_by, reviewed_at, published_at, parent_version_id, created_at, updated_at
       FROM health_content_versions ORDER BY version_number DESC LIMIT 50`,
  ).all<HealthVersionRow>();
  return result.results.map((row) => publicVersion(row, row.id === includePayloadId));
}

export async function listHealthEditorVersions(database: Database, email: string, deviceId: string, includePayloadId?: string) {
  const result = await database.prepare(
    `SELECT id, version_number, status, payload_json, summary, created_by, editor_device_id, editor_device_code,
            edit_scope, permission_note, permission_reviewed_by, permission_reviewed_at, submitted_at,
            reviewed_by, reviewed_at, published_at, parent_version_id, created_at, updated_at
       FROM health_content_versions WHERE created_by = ? AND editor_device_id = ? ORDER BY version_number DESC LIMIT 20`,
  ).bind(email, deviceId).all<HealthVersionRow>();
  return result.results.map((row) => publicVersion(row, row.id === includePayloadId));
}
