export const COACHING_BUCKET = Object.freeze({
  PRIORITY: "priority",
  VERIFY: "verify",
  MONITOR: "monitor",
  WAIT: "wait",
});

export const COACHING_TRUST = Object.freeze({
  HIGH: "high",
  CAUTION: "caution",
  REFERENCE: "reference",
  UNKNOWN: "unknown",
});

const DOMAIN_META = Object.freeze({
  coordination: {
    label: "Phối hợp tay–chân",
    tieBreakOrder: 1,
    drill: "Nhịp kéo – thở – đạp – lướt",
    cue: "Thực hiện chậm và tách rõ: kéo tay → lấy hơi/trả tay → thu/đạp chân → lướt trước khi vào nhịp mới.",
    check: "Quay lại cùng góc và kiểm tra xem tỷ lệ chồng pha có giảm ở cả AI v1 lẫn engine 5 pha hay không.",
  },
  "leg-symmetry": {
    label: "Đối xứng chân / nhịp đạp",
    tieBreakOrder: 2,
    drill: "Thu gót đồng thời – đạp khép cân đối",
    cue: "Ưu tiên hai gối/gót chuyển pha gần đồng thời; giảm tốc độ nếu cần để hai chân bắt đầu và kết thúc cú đạp cùng nhịp.",
    check: "Quay lại góc từ sau khi có thể và kiểm tra AI v1 cùng đối xứng trái–phải trên cùng nhóm lỗi.",
  },
  "arm-symmetry": {
    label: "Đối xứng tay",
    tieBreakOrder: 3,
    drill: "Kéo và trả hai tay đồng thời",
    cue: "Giữ biên độ kéo vừa phải, hai khuỷu/tay đổi hướng gần đồng thời và trả về trước cân đối.",
    check: "Quay lại cùng góc và kiểm tra AI v1 cùng detector đối xứng tay trước khi tăng tốc.",
  },
});

const STATUS = Object.freeze({
  CORROBORATED: "corroborated",
  CONFLICT: "conflict",
  SINGLE_SOURCE: "single-source",
  CLEAR: "clear",
  INSUFFICIENT: "insufficient",
});

function trustLabel(level) {
  if (level === COACHING_TRUST.HIGH) return "Tin cậy cao";
  if (level === COACHING_TRUST.CAUTION) return "Cần thận trọng";
  if (level === COACHING_TRUST.REFERENCE) return "Chỉ tham khảo";
  return "Chưa xác định";
}

function normalizeDomain(item) {
  if (!item || !DOMAIN_META[item.domain]) return null;
  const status = Object.values(STATUS).includes(item.status) ? item.status : STATUS.INSUFFICIENT;
  return { domain: item.domain, status };
}

function classify(domain, status, trustLevel) {
  if (!DOMAIN_META[domain]) {
    return {
      bucket: COACHING_BUCKET.WAIT,
      reason: "Chưa đủ dữ liệu độc lập để đưa ra hướng tập cho nhóm này.",
    };
  }
  if (status === STATUS.CORROBORATED) {
    if (trustLevel === COACHING_TRUST.HIGH || trustLevel === COACHING_TRUST.CAUTION) {
      return {
        bucket: COACHING_BUCKET.PRIORITY,
        reason: trustLevel === COACHING_TRUST.HIGH
          ? "Hai nguồn độc lập cùng báo vấn đề và Unified Trust đang cao."
          : "Hai nguồn độc lập cùng báo vấn đề, nhưng Unified Trust yêu cầu thận trọng khi tập và kiểm tra lại sớm.",
      };
    }
    return {
      bucket: COACHING_BUCKET.VERIFY,
      reason: "Hai nguồn cùng báo vấn đề nhưng Unified Trust chỉ ở mức tham khảo/chưa xác định; cần cải thiện đầu vào hoặc kiểm tra lại trước khi dùng làm bài tập chính.",
    };
  }
  if (status === STATUS.CONFLICT) {
    return {
      bucket: COACHING_BUCKET.VERIFY,
      reason: "Các nguồn độc lập đang cho kết quả trái chiều; không dùng nhóm này để dẫn hướng bài tập chính.",
    };
  }
  if (status === STATUS.SINGLE_SOURCE) {
    return {
      bucket: COACHING_BUCKET.VERIFY,
      reason: "Mới một nguồn báo vấn đề; cần nguồn độc lập xác nhận trước khi ưu tiên sửa.",
    };
  }
  if (status === STATUS.CLEAR) {
    return {
      bucket: COACHING_BUCKET.MONITOR,
      reason: "Các nguồn đủ điều kiện cùng chưa thấy tín hiệu lỗi; tiếp tục theo dõi thay vì tạo bài tập sửa lỗi.",
    };
  }
  return {
    bucket: COACHING_BUCKET.WAIT,
    reason: "Chưa đủ dữ liệu độc lập để đưa ra hướng tập cho nhóm này.",
  };
}

export function buildConsensusAwareCoaching(input = {}) {
  const trustLevel = Object.values(COACHING_TRUST).includes(input.trustLevel)
    ? input.trustLevel
    : COACHING_TRUST.UNKNOWN;
  const domains = Array.isArray(input.domains)
    ? input.domains.map(normalizeDomain).filter(Boolean)
    : [];

  const items = domains.map((item) => {
    const meta = DOMAIN_META[item.domain];
    const policy = classify(item.domain, item.status, trustLevel);
    return {
      domain: item.domain,
      label: meta.label,
      status: item.status,
      bucket: policy.bucket,
      reason: policy.reason,
      drill: meta.drill,
      cue: meta.cue,
      check: meta.check,
      tieBreakOrder: meta.tieBreakOrder,
    };
  });

  const priority = items
    .filter((item) => item.bucket === COACHING_BUCKET.PRIORITY)
    .sort((a, b) => a.tieBreakOrder - b.tieBreakOrder)
    .map((item, index) => ({ ...item, priority: index + 1 }));
  const verify = items.filter((item) => item.bucket === COACHING_BUCKET.VERIFY).sort((a, b) => a.tieBreakOrder - b.tieBreakOrder);
  const monitor = items.filter((item) => item.bucket === COACHING_BUCKET.MONITOR).sort((a, b) => a.tieBreakOrder - b.tieBreakOrder);
  const wait = items.filter((item) => item.bucket === COACHING_BUCKET.WAIT).sort((a, b) => a.tieBreakOrder - b.tieBreakOrder);

  return {
    trustLevel,
    trustLabel: trustLabel(trustLevel),
    priority,
    verify,
    monitor,
    wait,
    ready: priority.length > 0,
    note: "Thứ tự chỉ là workflow coaching khi nhiều nhóm có cùng mức xác nhận chéo; không phải xếp hạng mức độ nghiêm trọng sinh cơ học và không thay scoring/Unified Trust.",
  };
}
