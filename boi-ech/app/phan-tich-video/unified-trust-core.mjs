export const TRUST_LEVEL = Object.freeze({
  HIGH: "high",
  CAUTION: "caution",
  REFERENCE: "reference",
});

const LABEL = Object.freeze({
  high: "Tin cậy cao",
  caution: "Cần thận trọng",
  reference: "Chỉ tham khảo",
});

export function assessUnifiedTrust(input = {}) {
  const preflight = input.preflight ?? "unknown";
  const captureQuality = input.captureQuality ?? "unknown";
  const viewQuality = input.viewQuality ?? "unknown";
  const cameraProfileSelected = Boolean(input.cameraProfileSelected);
  const overrideActive = Boolean(input.overrideActive);

  const blockers = [];
  const warnings = [];

  if (overrideActive) blockers.push("Đã chủ động bỏ qua preflight ‘Nên quay lại’ cho clip này.");
  if (!cameraProfileSelected) blockers.push("Chưa có camera profile chung để diễn giải theo góc quay.");
  if (preflight === "retry") blockers.push("Camera Guidance đánh giá clip ở mức ‘Nên quay lại’.");
  if (captureQuality === "retry") blockers.push("Capture Quality không đủ để dùng kết quả như đánh giá kỹ thuật tin cậy.");
  if (viewQuality === "poor" || viewQuality === "unselected") blockers.push("View Quality Gate chưa đủ bằng chứng cho kết luận mạnh.");

  if (preflight === "review") warnings.push("Preflight còn điểm cần chỉnh khung.");
  if (captureQuality === "review") warnings.push("Capture Quality yêu cầu đọc kết quả thận trọng.");
  if (viewQuality === "review") warnings.push("View Quality Gate chỉ ở mức cần kiểm tra.");
  if (preflight === "unknown") warnings.push("Chưa có kết quả Camera Guidance cho clip hiện tại.");
  if (captureQuality === "unknown") warnings.push("Chưa có Capture Quality từ lượt phân tích chính.");
  if (viewQuality === "unknown") warnings.push("Chưa có View Quality từ phân tích pha/góc quay.");

  let level = TRUST_LEVEL.HIGH;
  if (blockers.length) level = TRUST_LEVEL.REFERENCE;
  else if (warnings.length) level = TRUST_LEVEL.CAUTION;

  return {
    level,
    label: LABEL[level],
    highConfidence: level === TRUST_LEVEL.HIGH,
    blockers,
    warnings,
    reasons: [...blockers, ...warnings],
    evidence: {
      preflight,
      captureQuality,
      viewQuality,
      cameraProfileSelected,
      overrideActive,
    },
    note: level === TRUST_LEVEL.HIGH
      ? "Các gate đầu vào hiện đều đạt trong phạm vi clip/góc quay này; đây vẫn là phân tích hỗ trợ thử nghiệm, không phải xác nhận sinh cơ học đã hiệu chuẩn."
      : level === TRUST_LEVEL.CAUTION
        ? "Có gate chưa hoàn tất hoặc đang ở mức cần kiểm tra; không nên đọc một chỉ số riêng lẻ như kết luận chắc chắn."
        : "Có gate chặn hoặc người dùng đã bỏ qua cảnh báo đầu vào; mọi điểm/lỗi chỉ nên dùng để tham khảo và khoanh vùng đoạn cần xem lại.",
  };
}
