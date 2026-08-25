import type { LessonVisual, LessonVisualSet, PublicQuestion, ServerQuestion } from "./course-types";

const lessonTitles: Record<string, string> = {
  "01": "An toàn và làm quen nước",
  "02": "Tư thế thân người và lướt",
  "03": "Kỹ thuật chân bơi ếch",
  "04": "Kỹ thuật tay",
  "05": "Kỹ thuật thở",
  "06": "Phối hợp hoàn chỉnh",
  "07": "Lỗi sai và cách sửa",
  "08": "Giáo án luyện tập",
};

const mediaNamespace = "be-visuals-v1-4e3b9a7c13d8f06fa571c92b8e64f10d";

async function mediaId(lessonNumber: string, group: "technique" | "diagnostic", index: number) {
  const value = `${mediaNamespace}:${lessonNumber}:${group}:${index}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

const techniqueOrder: Record<string, readonly number[]> = {
  "01": [0, 2, 4, 3, 7, 1, 5, 6],
  "02": [0, 1, 2, 3, 7, 4, 5, 6],
  "03": [1, 2, 4, 0, 5, 3, 6, 7],
  "04": [0, 1, 4, 5, 6, 2, 3, 7],
  "05": [0, 2, 4, 3, 7, 1, 5, 6],
  "06": [0, 1, 2, 3, 5, 4, 6, 7],
  "07": [0, 3, 2, 4, 6, 1, 5, 7],
  "08": [7, 0, 2, 3, 5, 6, 1, 4],
};

const techniqueCaptions: Record<string, readonly string[]> = {
  "01": ["Kiểm tra khu vực và người giám sát", "Xuống bể bằng chân với điểm tựa", "Thở ra đều khi mặt ở dưới nước", "Thu gối, đặt chân rồi mới nâng đầu", "Dừng, bám và ổn định nhịp thở", "Khởi động trước khi xuống nước", "Nổi sấp có người hỗ trợ", "Báo hiệu và gọi trợ giúp"],
  "02": ["Tạo hình thuôn dài trên cạn", "Lướt sấp với đầu ở vị trí trung tính", "Cân bằng đầu, hông và chân", "Hai chân đẩy thành đồng thời", "Thu gối, đặt chân và đứng dậy", "Duy trì đường thân khi lướt", "Giữ hai tay áp gần tai", "Kết thúc pha lướt có kiểm soát"],
  "03": ["Thu gót gọn, gối mở vừa phải", "Gập cổ chân và mở mũi chân", "Đạp ra sau rồi quét vào khép kín", "Hai chân duỗi khép trong pha lướt", "Giữ đường thân sau cú đạp", "Quan sát đường đi của hai chân", "Trình tự một chu kỳ chân", "Bài tập chân có điểm tựa"],
  "04": ["Hai tay duỗi thẳng đối xứng", "Tách tay và tạo mặt tỳ", "Quạt vào rồi thu tay gọn", "Đưa hai tay thẳng về trước", "Hoàn tất chu kỳ ở tư thế dài", "Kiểm soát độ rộng đường quạt", "Giữ hai tay chuyển động đồng thời", "Mô phỏng chậm trước gương"],
  "05": ["Tạo vòng hít trên mặt nước, thở dưới nước", "Hít vào khi vai nâng theo pha quạt", "Vai dẫn đầu lên, cằm giữ thấp", "Thở ra khi mặt ở dưới nước", "Giữ nhịp một chu kỳ, một lần hít", "Duỗi tay và đưa đầu trở lại nước", "Giữ đường thân khi thở", "Ghép tay và hô hấp theo chu kỳ"],
  "06": ["Bắt đầu từ tư thế lướt", "Quạt tay và hít vào", "Thu tay về trước và thu chân", "Tay dài trước khi chân đạp", "Khép chân và lướt", "Tách thời điểm tạo lực của tay và chân", "Ổn định hô hấp tại điểm bám", "Trình tự phối hợp hoàn chỉnh"],
  "07": ["Quan sát một biểu hiện cụ thể", "Chọn lỗi ưu tiên cần sửa", "Ghi lại cùng một tiêu chí", "Sửa động tác trên cạn", "So sánh trước và sau bằng cùng tiêu chí", "Quan sát từ phía sau", "Chuyển từ đoạn ngắn sang ghép hoàn chỉnh", "Phản hồi một tín hiệu ngắn"],
  "08": ["Khóa điểm xuất phát và mục tiêu", "Tổ chức buổi tập có giám sát", "Tuần 1: đường thân và nền tảng", "Tuần 2: củng cố từng kỹ thuật", "Tuần 3: ghép nhịp hoàn chỉnh", "Tuần 4: đo và đánh giá lại", "Chọn dụng cụ phù hợp", "Ghi chép chất lượng sau buổi tập"],
};

const diagnosticCaptions: Record<string, readonly string[]> = {
  "01": ["Nín thở rồi bật đầu lên gấp", "Ngẩng đầu trước khi đặt chân", "Buông điểm bám khi chưa sẵn sàng", "Vùng vẫy khi nước vào mặt"],
  "02": ["Đầu ngẩng và mắt nhìn thẳng", "Tay tách rộng hoặc khuỷu gập", "Hông và chân chìm nhanh", "Đẩy thành lệch hướng"],
  "03": ["Gối mở quá rộng", "Gối kéo quá sâu", "Bàn chân chưa bẻ", "Đạp sang hai bên"],
  "04": ["Hai tay quạt quá rộng", "Bàn tay kéo lùi quá vai", "Hai tay lệch nhịp", "Duỗi tay vòng rộng"],
  "05": ["Ngẩng đầu quá cao", "Giữ đầu trên mặt nước quá lâu", "Nín thở đến cuối pha lướt", "Hít vào sai nhịp"],
  "06": ["Tay và chân cùng tạo lực", "Thu gối khi tay vừa mở", "Đạp khi tay còn trước ngực", "Không giữ pha lướt"],
  "07": ["Nhận xét chưa dựa trên dấu hiệu cụ thể", "Đưa quá nhiều khẩu lệnh", "Tăng quãng khi kỹ thuật đang hỏng", "Không kiểm tra lại sau khi sửa"],
  "08": ["Tăng quãng dù kỹ thuật mất kiểm soát", "Thay nội dung sửa ở mỗi buổi", "Nghỉ chưa đủ giữa các lượt", "Ghi thời gian nhưng bỏ qua chất lượng"],
};

async function visual(
  lessonNumber: string,
  group: "technique" | "diagnostic",
  assetIndex: number,
  displayIndex = assetIndex,
): Promise<LessonVisual> {
  const groupLabel = group === "technique"
    ? techniqueCaptions[lessonNumber]?.[displayIndex] ?? `khung kỹ thuật ${displayIndex + 1}`
    : displayIndex < 4
      ? diagnosticCaptions[lessonNumber]?.[displayIndex] ?? `tình huống phân tích ${displayIndex + 1}`
      : `phương án hình ${displayIndex - 3}`;
  return {
    src: `/course-media/${await mediaId(lessonNumber, group, assetIndex)}.webp`,
    alt: `${lessonTitles[lessonNumber]} – ${groupLabel}`,
  };
}

export async function lessonVisualsFor(lessonNumber: string): Promise<LessonVisualSet> {
  const order = techniqueOrder[lessonNumber] ?? Array.from({ length: 8 }, (_, index) => index);
  const technique = await Promise.all(order.map((assetIndex, displayIndex) => visual(lessonNumber, "technique", assetIndex, displayIndex)));
  const diagnostics = await Promise.all(Array.from({ length: 8 }, (_, index) => visual(lessonNumber, "diagnostic", index)));
  return { cover: technique[0], technique, diagnostics };
}

type QuestionVisualPlan = {
  single: Record<number, number>;
  options: Record<number, readonly [number, number]>;
};

const questionVisualPlans: Record<string, QuestionVisualPlan> = {
  "01": { single: { 0: 0, 2: 3, 4: 2, 6: 4 }, options: { 1: [4, 8] } },
  "02": { single: { 1: 3, 2: 1, 4: 0, 9: 4 }, options: { 0: [4, 8] } },
  "03": { single: { 0: 0, 1: 0, 3: 2, 4: 3 }, options: { 8: [4, 8] } },
  "04": { single: { 0: 0, 2: 2, 4: 1, 7: 3 }, options: { 6: [4, 8] } },
  "05": { single: { 0: 1, 1: 2, 2: 3, 4: 4 }, options: { 7: [4, 8] } },
  "06": { single: { 0: 7, 1: 1, 2: 3, 4: 4 }, options: { 9: [4, 8] } },
  "07": { single: { 0: 1, 2: 6, 4: 5, 9: 2 }, options: { 7: [4, 8] } },
  "08": { single: { 0: 2, 1: 1, 3: 7, 7: 5 }, options: { 8: [4, 8] } },
};

export function publicQuestionsFor(
  items: readonly ServerQuestion[],
  lessonNumber: string,
  visuals: LessonVisualSet,
): PublicQuestion[] {
  const plan = questionVisualPlans[lessonNumber] ?? questionVisualPlans["01"];
  return items.map(({ q, options }, index) => {
    const singleIndex = plan.single[index];
    if (singleIndex !== undefined) return { q, options, image: visuals.technique[singleIndex] };

    const optionRange = plan.options[index];
    if (optionRange) {
      const optionImages = visuals.diagnostics.slice(...optionRange).map((image, optionIndex) => ({
        ...image,
        alt: `${lessonTitles[lessonNumber]} – ${options[optionIndex]}`,
      }));
      return { q, options, optionImages };
    }
    return { q, options };
  });
}
