export type HealthTriageLevel = 0 | 1 | 2 | 3;
export type HealthCourseTrend = "same" | "better" | "worse" | "betterThenWorse";

export type HealthSymptomKey =
  | "runny" | "cough" | "phlegm" | "wheeze" | "bark" | "stridor" | "retractions" | "nasalFlaring" | "blue" | "apnea"
  | "fever" | "tired" | "looksVeryUnwell" | "hardWake" | "seizure"
  | "vomit" | "vomitAll" | "diarrhea" | "bloodStool" | "abdominalPain" | "lessUrine"
  | "earPain" | "soreThroat" | "mouthSores" | "handFootRash" | "rash" | "purpleRash"
  | "dysuria" | "foulUrine" | "itchEyes" | "recurrentWheeze";

export const HEALTH_SYMPTOMS: { id: HealthSymptomKey; label: string; group: string; danger?: boolean }[] = [
  { id: "runny", label: "Sổ/nghẹt mũi", group: "Hô hấp" },
  { id: "cough", label: "Ho", group: "Hô hấp" },
  { id: "phlegm", label: "Nghe/khạc có đờm", group: "Hô hấp" },
  { id: "wheeze", label: "Khò khè", group: "Hô hấp" },
  { id: "bark", label: "Ho ông ổng/khàn tiếng", group: "Hô hấp" },
  { id: "stridor", label: "Tiếng rít khi hít vào lúc trẻ yên", group: "Hô hấp", danger: true },
  { id: "retractions", label: "Rút lõm ngực khi hít vào", group: "Hô hấp", danger: true },
  { id: "nasalFlaring", label: "Phập phồng cánh mũi/rên khi thở", group: "Hô hấp", danger: true },
  { id: "blue", label: "Tím môi/mặt", group: "Hô hấp", danger: true },
  { id: "apnea", label: "Có cơn ngưng thở", group: "Hô hấp", danger: true },
  { id: "recurrentWheeze", label: "Từng có nhiều đợt khò khè", group: "Hô hấp" },
  { id: "fever", label: "Sốt", group: "Toàn thân" },
  { id: "tired", label: "Mệt hơn thường ngày", group: "Toàn thân" },
  { id: "looksVeryUnwell", label: "Trông rất bệnh/khác hẳn thường ngày", group: "Toàn thân", danger: true },
  { id: "hardWake", label: "Li bì/khó đánh thức", group: "Toàn thân", danger: true },
  { id: "seizure", label: "Co giật", group: "Toàn thân", danger: true },
  { id: "vomit", label: "Nôn", group: "Tiêu hóa" },
  { id: "vomitAll", label: "Nôn mọi thứ/không giữ được nước", group: "Tiêu hóa", danger: true },
  { id: "diarrhea", label: "Tiêu chảy", group: "Tiêu hóa" },
  { id: "bloodStool", label: "Phân có máu", group: "Tiêu hóa", danger: true },
  { id: "abdominalPain", label: "Đau bụng", group: "Tiêu hóa" },
  { id: "lessUrine", label: "Tiểu ít rõ", group: "Tiêu hóa" },
  { id: "earPain", label: "Đau/kéo tai", group: "Tai – họng – da – tiểu" },
  { id: "soreThroat", label: "Đau họng/nuốt đau", group: "Tai – họng – da – tiểu" },
  { id: "mouthSores", label: "Loét miệng", group: "Tai – họng – da – tiểu" },
  { id: "handFootRash", label: "Ban/bóng nước lòng bàn tay/chân", group: "Tai – họng – da – tiểu" },
  { id: "rash", label: "Phát ban", group: "Tai – họng – da – tiểu" },
  { id: "purpleRash", label: "Ban tím/chấm xuất huyết không mất màu khi ấn", group: "Tai – họng – da – tiểu", danger: true },
  { id: "dysuria", label: "Tiểu đau/khóc khi tiểu", group: "Tai – họng – da – tiểu" },
  { id: "foulUrine", label: "Nước tiểu mùi bất thường", group: "Tai – họng – da – tiểu" },
  { id: "itchEyes", label: "Ngứa mắt/hắt hơi từng tràng", group: "Tai – họng – da – tiểu" },
];

export type HealthCheckInput = {
  ageMonths: number;
  symptoms: HealthSymptomKey[];
  days: number;
  course: HealthCourseTrend;
  temperature?: number;
  respiratoryRate?: number;
  spo2?: number;
  intakePercent: number;
  hoursSinceUrine: number;
};

export type HealthPattern = { name: string; strength: "có thể cân nhắc" | "phù hợp một số dấu hiệu" | "phù hợp khá nhiều dấu hiệu"; reasons: string[] };
export type HealthCheckResult = {
  level: HealthTriageLevel;
  title: string;
  summary: string;
  reasons: string[];
  actions: string[];
  avoid: string[];
  missing: string[];
  patterns: HealthPattern[];
  rules: { source: string; label: string; detail: string }[];
  dataQuality: number;
};

const labels = [
  ["Theo dõi tại nhà", "Chưa thấy dấu nguy hiểm trong dữ liệu đã nhập."],
  ["Nên khám trong ngày", "Có dấu cần bác sĩ đánh giá sớm hoặc bệnh đang diễn biến xấu."],
  ["Cần đánh giá khẩn", "Có dấu hiệu vượt mức tự theo dõi an toàn tại nhà."],
  ["CẤP CỨU", "Có dấu hiệu cảnh báo nghiêm trọng."],
] as const;

function unique(values: string[]) { return [...new Set(values.filter(Boolean))]; }
function has(sx: HealthSymptomKey[], key: HealthSymptomKey) { return sx.includes(key); }
export function healthFastBreathing(ageMonths: number, rate: number) { return ageMonths < 12 ? rate >= 50 : rate >= 40; }

export function analyzeHealthSymptoms(input: HealthCheckInput): HealthCheckResult {
  const age = Math.max(9, Math.min(60, Math.round(input.ageMonths || 9)));
  const sx = input.symptoms ?? [];
  const rr = Number(input.respiratoryRate || 0);
  const spo2 = Number(input.spo2 || 0);
  const temp = Number(input.temperature || 0);
  const intake = Math.max(0, Math.min(100, Number(input.intakePercent ?? 100)));
  const urine = Math.max(0, Number(input.hoursSinceUrine || 0));
  const respiratory = sx.some((key) => ["runny", "cough", "phlegm", "wheeze", "bark", "stridor", "retractions", "nasalFlaring", "blue", "apnea"].includes(key));
  const fast = respiratory && rr > 0 && healthFastBreathing(age, rr);
  let level: HealthTriageLevel = 0;
  const reasons: string[] = [];
  const actions: string[] = [];
  const avoid: string[] = [];
  const missing: string[] = [];
  const rules: HealthCheckResult["rules"] = [];
  const fire = (source: string, label: string, detail: string) => rules.push({ source, label, detail });

  if (has(sx, "apnea")) { level = 3; reasons.push("Có cơn ngưng thở."); fire("NICE NG9", "Ngưng thở", "Dấu chuyển cấp cứu trong bronchiolitis."); }
  if (has(sx, "blue")) { level = 3; reasons.push("Tím môi/mặt."); fire("NICE NG9 / CDC", "Tím trung tâm", "Dấu cảnh báo thiếu oxy."); }
  if (has(sx, "hardWake")) { level = 3; reasons.push("Khó đánh thức/li bì."); fire("CDC", "Giảm tỉnh táo", "Dấu cảnh báo ở trẻ."); }
  if (has(sx, "seizure")) { level = 3; reasons.push("Có co giật."); fire("CDC", "Co giật", "Dấu cảnh báo ở trẻ."); }
  if (has(sx, "purpleRash")) { level = 3; reasons.push("Có ban tím/chấm xuất huyết không mất màu khi ấn."); }
  if (has(sx, "looksVeryUnwell")) { level = Math.max(level, 2) as HealthTriageLevel; reasons.push("Người chăm sóc thấy trẻ trông rất bệnh/khác hẳn thường ngày."); }
  if (has(sx, "retractions") || has(sx, "nasalFlaring")) { level = Math.max(level, 2) as HealthTriageLevel; reasons.push("Có tăng công thở/co kéo lồng ngực."); fire("CDC", "Tăng công thở", "Co kéo lồng ngực là dấu cảnh báo."); }
  if (has(sx, "stridor")) { level = Math.max(level, 2) as HealthTriageLevel; reasons.push("Có tiếng rít khi hít vào lúc trẻ yên."); }
  if (has(sx, "vomitAll") || has(sx, "bloodStool")) { level = Math.max(level, 2) as HealthTriageLevel; reasons.push(has(sx, "vomitAll") ? "Nôn mọi thứ/không giữ được dịch." : "Phân có máu."); }

  if (respiratory && rr > 70) { level = 3; reasons.push(`Nhịp thở ${rr}/phút rất cao.`); fire("NICE NG9", "RR >70/phút", "Ví dụ của suy hô hấp nặng trong bronchiolitis."); }
  else if (respiratory && rr > 60) { level = Math.max(level, 2) as HealthTriageLevel; reasons.push(`Nhịp thở ${rr}/phút >60/phút.`); fire("NICE NG9", "RR >60/phút", "Cần cân nhắc chuyển đánh giá tại bệnh viện."); }
  else if (fast) { level = Math.max(level, 1) as HealthTriageLevel; reasons.push(`Thở nhanh theo ngưỡng WHO cho tuổi này (${age < 12 ? "≥50" : "≥40"}/phút).`); fire("WHO IMCI", "Thở nhanh theo tuổi", `Đã nhập ${rr}/phút.`); }

  if (spo2 > 0 && spo2 < 92) { level = Math.max(level, 2) as HealthTriageLevel; reasons.push(`SpO₂ ${spo2}% thấp.`); fire("NICE NG9", "SpO₂ <92%", "Máy đo gia đình có thể sai số; cần nhìn cả tình trạng trẻ."); }
  if (intake <= 50) { level = Math.max(level, 2) as HealthTriageLevel; reasons.push(`Ăn/uống chỉ khoảng ${intake}% bình thường.`); fire("NICE NG9", "Uống giảm đáng kể", "Khả năng uống là yếu tố chuyển đánh giá y tế."); }
  else if (intake <= 75) { level = Math.max(level, 1) as HealthTriageLevel; reasons.push(`Ăn/uống giảm còn khoảng ${intake}% bình thường.`); }
  if (urine >= 8) { level = Math.max(level, 2) as HealthTriageLevel; reasons.push(`Khoảng ${urine} giờ chưa tiểu.`); fire("CDC", "Không tiểu ≥8 giờ", "Dấu cảnh báo mất nước ở trẻ."); }
  if (temp >= 40) { level = Math.max(level, 1) as HealthTriageLevel; reasons.push(`Sốt cao ${temp.toFixed(1)}°C.`); }
  if (input.course === "worse") { level = Math.max(level, 1) as HealthTriageLevel; reasons.push("Triệu chứng đang nặng dần."); }
  if (input.course === "betterThenWorse") { level = Math.max(level, 1) as HealthTriageLevel; reasons.push("Bệnh đã đỡ rồi nặng trở lại."); fire("CDC", "Đỡ rồi nặng trở lại", "Là dấu cần được đánh giá lại."); }

  const scores = new Map<string, { score: number; reasons: string[] }>();
  const add = (name: string, score: number, reason: string) => {
    const item = scores.get(name) ?? { score: 0, reasons: [] };
    item.score += score; item.reasons.push(reason); scores.set(name, item);
  };
  if (has(sx, "runny")) add("Nhiễm virus đường hô hấp trên/cảm lạnh", 3, "Có sổ/nghẹt mũi.");
  if (has(sx, "cough")) add("Nhiễm virus đường hô hấp trên/cảm lạnh", 2, "Có ho.");
  if (age < 24 && has(sx, "runny") && has(sx, "cough")) add("Viêm tiểu phế quản do virus — cần khám nếu có khó thở", 3, "Tuổi nhỏ + sổ mũi rồi ho.");
  if (age < 24 && has(sx, "wheeze")) add("Viêm tiểu phế quản do virus — cần khám nếu có khó thở", 3, "Có khò khè ở trẻ dưới 2 tuổi.");
  if (has(sx, "bark")) add("Croup/viêm thanh khí phế quản — cần đánh giá mức độ", 5, "Ho ông ổng/khàn tiếng.");
  if (has(sx, "stridor")) add("Croup/viêm thanh khí phế quản — cần đánh giá mức độ", 5, "Có tiếng rít khi trẻ yên.");
  if (has(sx, "cough") && fast) add("Mẫu triệu chứng gợi ý viêm phổi hoặc nhiễm trùng hô hấp dưới", 5, "Ho + thở nhanh theo tuổi.");
  if (has(sx, "cough") && has(sx, "retractions")) add("Mẫu triệu chứng gợi ý viêm phổi hoặc nhiễm trùng hô hấp dưới", 5, "Ho + rút lõm ngực.");
  if (has(sx, "wheeze") && has(sx, "recurrentWheeze")) add("Đợt khò khè tái diễn/bệnh đường thở phản ứng", 5, "Có tiền sử nhiều đợt khò khè.");
  if (has(sx, "diarrhea")) add("Viêm dạ dày–ruột cấp", 4, "Có tiêu chảy.");
  if (has(sx, "vomit")) add("Viêm dạ dày–ruột cấp", 2, "Có nôn.");
  if (has(sx, "earPain")) add("Viêm tai giữa/đau tai sau nhiễm hô hấp", 5, "Có đau/kéo tai.");
  if (has(sx, "dysuria")) add("Nhiễm trùng đường tiểu — cần xét nghiệm để xác nhận", 5, "Có tiểu đau/khóc khi tiểu.");
  if (has(sx, "mouthSores") && has(sx, "handFootRash")) add("Tay–chân–miệng hoặc bệnh virus có tổn thương miệng-da", 6, "Loét miệng + ban/bóng nước tay chân.");
  if (has(sx, "itchEyes") && has(sx, "runny") && !has(sx, "fever")) add("Viêm mũi dị ứng", 5, "Ngứa mắt/hắt hơi + sổ mũi không sốt.");
  if (intake <= 75 || urine >= 8 || has(sx, "lessUrine") || has(sx, "vomitAll") || has(sx, "diarrhea")) add("Nguy cơ mất nước", 4, "Lượng uống/tiểu hoặc triệu chứng tiêu hóa gợi ý cần theo dõi mất nước.");

  const patterns: HealthPattern[] = [...scores.entries()].filter(([, value]) => value.score >= 3).sort((a, b) => b[1].score - a[1].score).slice(0, 4).map(([name, value]) => ({
    name,
    strength: value.score >= 7 ? "phù hợp khá nhiều dấu hiệu" : value.score >= 5 ? "phù hợp một số dấu hiệu" : "có thể cân nhắc",
    reasons: unique(value.reasons).slice(0, 3),
  }));

  if (respiratory && !rr) missing.push("Đếm nhịp thở đủ 60 giây khi trẻ yên.");
  if (has(sx, "fever") && !temp) missing.push("Đo nhiệt độ bằng nhiệt kế.");
  if ((has(sx, "vomit") || has(sx, "diarrhea") || intake < 90) && urine === 0) missing.push("Theo dõi số giờ từ lần tiểu cuối hoặc số tã ướt.");

  if (level === 3) {
    actions.push("Đưa trẻ đến cơ sở cấp cứu ngay hoặc gọi cấp cứu địa phương nếu di chuyển không an toàn.");
    actions.push("Không trì hoãn để thử thêm thuốc ho, Đông y, kháng sinh hoặc corticoid tại nhà.");
  } else if (level === 2) {
    actions.push("Cho trẻ được bác sĩ/nhi khoa đánh giá khẩn trong hôm nay; nếu khó thở tăng nhanh, chuyển cấp cứu.");
    actions.push("Mang theo nhịp thở, SpO₂ nếu có, lượng uống, số lần tiểu và danh sách thuốc đã dùng.");
  } else if (level === 1) {
    actions.push("Nên liên hệ hoặc khám bác sĩ trong ngày, nhất là khi trẻ dưới 1 tuổi hoặc dấu hiệu đang tăng.");
    actions.push("Theo dõi nhịp thở, công thở, ăn/uống, tiểu và mức tỉnh táo.");
  } else {
    actions.push("Có thể tiếp tục chăm sóc hỗ trợ tại nhà nếu trẻ vẫn tương tác, thở bình thường và uống được.");
    actions.push("Cho đủ dịch phù hợp tuổi, nghỉ ngơi và làm sạch mũi bằng NaCl 0,9% khi nghẹt.");
    actions.push("Đánh giá lại nếu bệnh nặng dần, đỡ rồi tái nặng hoặc xuất hiện dấu đỏ.");
  }
  avoid.push("Không tự dùng dexamethasone/prednisolone chỉ để cắt ho hoặc 'chống viêm'.");
  avoid.push("Không tự dùng kháng sinh chỉ dựa vào ho, đờm, sốt hoặc màu nước mũi.");
  if (age < 48) avoid.push("Không tự dùng thuốc ho/cảm OTC cho trẻ dưới 4 tuổi.");
  if (age < 12) avoid.push("Không dùng mật ong dưới 12 tháng.");
  avoid.push("Không xông hơi nóng sát mặt và không nhỏ tinh dầu/dầu gió/nước lá vào mũi.");

  const required = missing.length;
  let dataQuality = Math.max(20, 100 - required * 22);
  if (!sx.length && !rr && !temp && !spo2) dataQuality = 20;
  const [title, summary] = labels[level];
  return { level, title: dataQuality < 35 && level === 0 ? "Chưa đủ dữ liệu để kết luận theo dõi tại nhà" : title, summary: dataQuality < 35 && level === 0 ? "Bổ sung thông tin quan trọng trước khi dùng kết quả để quyết định." : summary, reasons: unique(reasons), actions: unique(actions), avoid: unique(avoid), missing: unique(missing), patterns, rules, dataQuality };
}

export type HealthEpisodeEntry = HealthCheckInput & { id: string; time: string; coughSeverity: 0 | 1 | 2 | 3; energy: 0 | 1 | 2 | 3 };

export function analyzeHealthTrend(entries: HealthEpisodeEntry[]) {
  const sorted = [...entries].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  if (sorted.length < 2) return { warnings: [] as string[], improvements: [] as string[] };
  const current = sorted.at(-1)!;
  const previous = sorted.at(-2)!;
  const warnings: string[] = [];
  const improvements: string[] = [];
  const rrDelta = Number(current.respiratoryRate || 0) - Number(previous.respiratoryRate || 0);
  const spoDelta = Number(current.spo2 || 0) && Number(previous.spo2 || 0) ? Number(current.spo2) - Number(previous.spo2) : 0;
  const intakeDelta = current.intakePercent - previous.intakePercent;
  const hiddenWorsening = current.coughSeverity < previous.coughSeverity && (rrDelta >= 8 || spoDelta <= -3 || intakeDelta <= -20 || current.energy < previous.energy || current.symptoms.includes("retractions") || current.symptoms.includes("nasalFlaring"));
  if (hiddenWorsening) warnings.push("Tiếng ho đã giảm nhưng hô hấp/toàn trạng lại xấu đi. Không coi ít ho hơn là bằng chứng trẻ đang khỏi.");
  if (rrDelta >= 8) warnings.push(`Nhịp thở tăng ${rrDelta} lần/phút so với lần trước.`);
  if (spoDelta <= -3) warnings.push(`SpO₂ giảm ${Math.abs(spoDelta)} điểm so với lần trước.`);
  if (intakeDelta <= -20) warnings.push(`Ăn/uống giảm thêm ${Math.abs(intakeDelta)} điểm phần trăm.`);
  if (current.energy < previous.energy) warnings.push("Mức tỉnh táo/năng lượng giảm so với lần trước.");
  if (rrDelta <= -8) improvements.push(`Nhịp thở giảm ${Math.abs(rrDelta)} lần/phút.`);
  if (intakeDelta >= 15) improvements.push(`Ăn/uống tăng ${intakeDelta} điểm phần trăm.`);
  if (current.energy > previous.energy) improvements.push("Toàn trạng tốt hơn lần trước.");
  if (sorted.length >= 3) {
    const last = sorted.slice(-3);
    const rates = last.map((item) => Number(item.respiratoryRate || 0));
    if (rates.every(Boolean) && rates[2] > rates[1] && rates[1] > rates[0]) warnings.push(`Nhịp thở tăng liên tiếp: ${rates.join(" → ")} lần/phút.`);
    const intakes = last.map((item) => item.intakePercent);
    if (intakes[2] < intakes[1] && intakes[1] < intakes[0]) warnings.push(`Ăn/uống giảm liên tiếp: ${intakes.join("% → ")}%.`);
  }
  return { warnings: unique(warnings), improvements: unique(improvements) };
}
