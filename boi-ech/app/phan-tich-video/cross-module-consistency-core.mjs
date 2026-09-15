export const CONSISTENCY_DOMAIN = Object.freeze({
  ARM_SYMMETRY: "arm-symmetry",
  LEG_SYMMETRY: "leg-symmetry",
  COORDINATION: "coordination",
});

export const CONSISTENCY_STATUS = Object.freeze({
  CORROBORATED: "corroborated",
  CONFLICT: "conflict",
  SINGLE_SOURCE: "single-source",
  CLEAR: "clear",
  INSUFFICIENT: "insufficient",
});

export const CONSISTENCY_SIGNAL = Object.freeze({
  POSITIVE: "positive",
  NEGATIVE: "negative",
  UNKNOWN: "unknown",
});

const DOMAIN_META = Object.freeze({
  [CONSISTENCY_DOMAIN.ARM_SYMMETRY]: {
    label: "Đối xứng tay",
    modules: ["v1", "bilateral"],
  },
  [CONSISTENCY_DOMAIN.LEG_SYMMETRY]: {
    label: "Đối xứng chân / nhịp đạp",
    modules: ["v1", "bilateral"],
  },
  [CONSISTENCY_DOMAIN.COORDINATION]: {
    label: "Phối hợp tay–chân",
    modules: ["v1", "phase"],
  },
});

const STATUS_LABEL = Object.freeze({
  [CONSISTENCY_STATUS.CORROBORATED]: "Bằng chứng phù hợp",
  [CONSISTENCY_STATUS.CONFLICT]: "Bằng chứng chưa thống nhất",
  [CONSISTENCY_STATUS.SINGLE_SOURCE]: "Mới có một nguồn",
  [CONSISTENCY_STATUS.CLEAR]: "Các nguồn cùng chưa thấy tín hiệu lỗi",
  [CONSISTENCY_STATUS.INSUFFICIENT]: "Chưa đủ nguồn để đối chiếu",
});

function unique(values) {
  return [...new Set(values)];
}

export function consistencyStatusLabel(status) {
  return STATUS_LABEL[status] ?? STATUS_LABEL[CONSISTENCY_STATUS.INSUFFICIENT];
}

export function domainLabel(domain) {
  return DOMAIN_META[domain]?.label ?? domain;
}

function normalizeFinding(finding) {
  if (!finding || !DOMAIN_META[finding.domain]) return null;
  const expected = DOMAIN_META[finding.domain].modules;
  if (!expected.includes(finding.module)) return null;
  const signal = Object.values(CONSISTENCY_SIGNAL).includes(finding.signal)
    ? finding.signal
    : CONSISTENCY_SIGNAL.UNKNOWN;
  return {
    domain: finding.domain,
    module: finding.module,
    signal,
    eligible: finding.eligible !== false,
    detail: String(finding.detail ?? ""),
  };
}

function assessDomain(domain, findings) {
  const meta = DOMAIN_META[domain];
  const byModule = new Map();
  for (const finding of findings) {
    if (finding.domain !== domain) continue;
    const previous = byModule.get(finding.module);
    if (!previous || previous.signal === CONSISTENCY_SIGNAL.UNKNOWN) byModule.set(finding.module, finding);
    if (finding.signal === CONSISTENCY_SIGNAL.POSITIVE) byModule.set(finding.module, finding);
  }

  const eligible = meta.modules
    .map((module) => byModule.get(module))
    .filter((finding) => finding?.eligible);
  const positives = unique(eligible.filter((finding) => finding.signal === CONSISTENCY_SIGNAL.POSITIVE).map((finding) => finding.module));
  const negatives = unique(eligible.filter((finding) => finding.signal === CONSISTENCY_SIGNAL.NEGATIVE).map((finding) => finding.module));
  const unknown = meta.modules.filter((module) => {
    const finding = byModule.get(module);
    return !finding || !finding.eligible || finding.signal === CONSISTENCY_SIGNAL.UNKNOWN;
  });

  let status = CONSISTENCY_STATUS.INSUFFICIENT;
  if (positives.length >= 2) status = CONSISTENCY_STATUS.CORROBORATED;
  else if (positives.length >= 1 && negatives.length >= 1) status = CONSISTENCY_STATUS.CONFLICT;
  else if (positives.length === 1) status = CONSISTENCY_STATUS.SINGLE_SOURCE;
  else if (negatives.length >= 2) status = CONSISTENCY_STATUS.CLEAR;

  const sources = meta.modules.map((module) => {
    const finding = byModule.get(module);
    return {
      module,
      signal: finding?.eligible ? finding.signal : CONSISTENCY_SIGNAL.UNKNOWN,
      detail: finding?.detail ?? "",
    };
  });

  const conclusion = status === CONSISTENCY_STATUS.CORROBORATED
    ? "Hai nguồn độc lập cùng chỉ về một vấn đề; có thể xem đây là tín hiệu được xác nhận chéo, nhưng vẫn chịu giới hạn của Unified Trust."
    : status === CONSISTENCY_STATUS.CONFLICT
      ? "Một nguồn báo có vấn đề trong khi nguồn còn lại không thấy tín hiệu tương ứng. Không nên cộng dồn thành kết luận mạnh; cần xem lại mốc video và gate của từng nguồn."
      : status === CONSISTENCY_STATUS.SINGLE_SOURCE
        ? "Mới có một nguồn báo vấn đề. Cần nguồn độc lập còn lại xác nhận trước khi coi đây là kết luận chắc."
        : status === CONSISTENCY_STATUS.CLEAR
          ? "Hai nguồn đủ điều kiện đều chưa thấy tín hiệu lỗi trong nhóm này. Đây không phải chứng minh kỹ thuật hoàn hảo, chỉ là sự nhất quán giữa các detector hiện có."
          : "Ít nhất một nguồn chưa đủ điều kiện hoặc chưa có dữ liệu tương đương để đối chiếu.";

  return {
    domain,
    label: meta.label,
    status,
    statusLabel: consistencyStatusLabel(status),
    positives,
    negatives,
    unknown,
    sources,
    conclusion,
  };
}

export function assessCrossModuleConsistency(findings = []) {
  const safe = Array.isArray(findings) ? findings.map(normalizeFinding).filter(Boolean) : [];
  const domains = Object.keys(DOMAIN_META).map((domain) => assessDomain(domain, safe));

  let status = CONSISTENCY_STATUS.INSUFFICIENT;
  if (domains.some((item) => item.status === CONSISTENCY_STATUS.CONFLICT)) status = CONSISTENCY_STATUS.CONFLICT;
  else if (domains.some((item) => item.status === CONSISTENCY_STATUS.CORROBORATED)) status = CONSISTENCY_STATUS.CORROBORATED;
  else if (domains.some((item) => item.status === CONSISTENCY_STATUS.SINGLE_SOURCE)) status = CONSISTENCY_STATUS.SINGLE_SOURCE;
  else if (domains.some((item) => item.status === CONSISTENCY_STATUS.CLEAR)) status = CONSISTENCY_STATUS.CLEAR;

  return {
    status,
    statusLabel: consistencyStatusLabel(status),
    domains,
    note: "Consistency chỉ đối chiếu các detector độc lập; không thay điểm, threshold, Unified Trust hay kết luận sinh cơ học.",
  };
}
