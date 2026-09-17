export const INTERPRETATION_TRUST = Object.freeze({
  HIGH: "high",
  CAUTION: "caution",
  REFERENCE: "reference",
});

function levelOf(level) {
  return Object.values(INTERPRETATION_TRUST).includes(level) ? level : INTERPRETATION_TRUST.CAUTION;
}

export function interpretationPolicy(level) {
  const trust = levelOf(level);
  return {
    level: trust,
    assertiveLanguageAllowed: trust === INTERPRETATION_TRUST.HIGH,
    advisorEligibilityAllowed: trust === INTERPRETATION_TRUST.HIGH,
    softenConclusions: trust !== INTERPRETATION_TRUST.HIGH,
    referenceOnly: trust === INTERPRETATION_TRUST.REFERENCE,
  };
}

export function interpretV1Summary(original, level) {
  const trust = levelOf(level);
  if (trust === INTERPRETATION_TRUST.HIGH) return original;
  const match = /^Phát hiện (\d+) điểm cần xem lại$/u.exec(original);
  if (match) {
    return trust === INTERPRETATION_TRUST.REFERENCE
      ? `AI đánh dấu ${match[1]} điểm cần kiểm tra · kết quả chỉ tham khảo`
      : `Có ${match[1]} điểm AI đánh dấu · cần đối chiếu thêm`;
  }
  if (original === "Chưa thấy lỗi nổi bật trong các tiêu chí v1") {
    return trust === INTERPRETATION_TRUST.REFERENCE
      ? "Chưa thấy tín hiệu nổi bật trong dữ liệu hiện có · chỉ tham khảo"
      : "Chưa thấy tín hiệu nổi bật · vẫn nên đối chiếu video";
  }
  return original;
}

export function interpretIssueTitle(original, level) {
  const trust = levelOf(level);
  if (trust === INTERPRETATION_TRUST.HIGH) return original;
  return trust === INTERPRETATION_TRUST.REFERENCE
    ? `Tín hiệu cần kiểm tra · ${original}`
    : `Cần đối chiếu · ${original}`;
}

export function interpretIssuePriority(original, level) {
  const trust = levelOf(level);
  if (trust === INTERPRETATION_TRUST.HIGH) return original;
  if (original === "Ưu tiên" || original === "Cần sửa") return "Nên kiểm tra";
  return original;
}

export function interpretCycleStatus(original, level) {
  const trust = levelOf(level);
  if (trust === INTERPRETATION_TRUST.HIGH) return original;
  if (original === "Tốt") return trust === INTERPRETATION_TRUST.REFERENCE ? "Chưa thấy bất thường rõ" : "Có vẻ ổn · nên đối chiếu";
  if (original === "Yếu") return trust === INTERPRETATION_TRUST.REFERENCE ? "Có tín hiệu cần xem" : "Có dấu hiệu yếu · cần đối chiếu";
  return original;
}

export function interpretWeakestPhaseLabel(original, level) {
  const trust = levelOf(level);
  if (trust === INTERPRETATION_TRUST.HIGH) return original;
  if (original.startsWith("Pha yếu nhất")) return original.replace("Pha yếu nhất", "Pha nên xem lại");
  return original;
}

export function interpretBilateralStatus(original, level) {
  const trust = levelOf(level);
  if (trust === INTERPRETATION_TRUST.HIGH) return original;
  if (original === "Cân bằng") return trust === INTERPRETATION_TRUST.REFERENCE ? "Chưa thấy lệch rõ" : "Có vẻ cân bằng · nên đối chiếu";
  if (original === "Lệch rõ") return trust === INTERPRETATION_TRUST.REFERENCE ? "Có tín hiệu lệch cần kiểm tra" : "Có dấu hiệu lệch · cần đối chiếu";
  if (original === "Cần xem" && trust === INTERPRETATION_TRUST.REFERENCE) return "Có tín hiệu cần kiểm tra";
  return original;
}

export function interpretAdvisorBadge(original, level) {
  const trust = levelOf(level);
  if (trust === INTERPRETATION_TRUST.HIGH) return original;
  if (original === "Coverage đạt cho clip" || original === "Coverage chưa đạt") {
    return trust === INTERPRETATION_TRUST.REFERENCE ? "Chỉ mô phỏng · không đủ trust" : "Mô phỏng · cần thận trọng";
  }
  return original;
}

export function interpretAdvisorGateLabel(original, level) {
  const trust = levelOf(level);
  if (trust === INTERPRETATION_TRUST.HIGH) return original;
  if (original.startsWith("Đủ coverage + chất lượng góc cho clip:") || original.startsWith("Chưa đủ điều kiện hiệu chỉnh:")) {
    return "Chưa đủ trust để xem xét hiệu chỉnh:";
  }
  return original;
}
