export const EVIDENCE_KIND = Object.freeze({
  V1_ERROR: "v1-error",
  CYCLE: "cycle",
  BILATERAL: "bilateral",
  ADVISOR: "advisor",
});

const TRUST_LABEL = Object.freeze({
  high: "Tin cậy cao",
  caution: "Cần thận trọng",
  reference: "Chỉ tham khảo",
  unknown: "Chưa xác định",
});

const PROFILE_LABEL = Object.freeze({
  side: "Ngang thân",
  rear: "Từ sau",
  "front-oblique": "Trước / chéo",
});

const GATE_LABEL = Object.freeze({
  good: "Đạt",
  strong: "Đạt mạnh",
  review: "Cần kiểm tra",
  retry: "Không đạt",
  poor: "Không đủ",
  unselected: "Chưa chọn",
  unknown: "Chưa có dữ liệu",
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percent(value) {
  const number = finite(value);
  return number === null ? null : Math.max(0, Math.min(100, Math.round(number)));
}

export function cameraProfileLabel(profile) {
  return PROFILE_LABEL[profile] ?? "Chưa chọn góc quay";
}

export function trustLabel(level) {
  return TRUST_LABEL[level] ?? TRUST_LABEL.unknown;
}

export function gateLabel(status) {
  return GATE_LABEL[status] ?? GATE_LABEL.unknown;
}

export function parseEvidenceTime(value) {
  if (typeof value === "number") return finite(value);
  const text = String(value ?? "").trim();
  if (!text) return null;
  const clock = text.match(/(?:\d+:)?(\d{1,2}):(\d+(?:\.\d+)?)/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const seconds = text.match(/(-?\d+(?:\.\d+)?)\s*s\b/i);
  return seconds ? finite(seconds[1]) : null;
}

function fact(label, value) {
  if (value === undefined || value === null || value === "") return null;
  return { label, value: String(value) };
}

function gate(name, status, detail = "") {
  return { name, status: status || "unknown", label: gateLabel(status), detail };
}

export function buildEvidenceTrace(input = {}) {
  const kind = input.kind ?? EVIDENCE_KIND.V1_ERROR;
  const trust = input.trustLevel ?? "unknown";
  const facts = [];
  const gates = [];
  const timeSec = finite(input.timeSec);
  const profile = input.cameraProfile ?? "";

  facts.push(fact("Nguồn", input.source || (kind === EVIDENCE_KIND.V1_ERROR ? "AI v1 pose" : kind === EVIDENCE_KIND.CYCLE ? "Engine 5 pha" : kind === EVIDENCE_KIND.BILATERAL ? "Đối xứng trái–phải" : "Threshold Advisor")));
  facts.push(fact("Góc quay", cameraProfileLabel(profile)));
  if (timeSec !== null) facts.push(fact("Mốc video", `${timeSec.toFixed(1)}s`));
  if (input.range) facts.push(fact("Khoảng video", input.range));

  if (kind === EVIDENCE_KIND.V1_ERROR) {
    facts.push(fact("Quan sát", input.observed));
    facts.push(fact("Mốc tham chiếu", input.expected));
    const confidence = percent(input.confidence);
    if (confidence !== null) facts.push(fact("Confidence lượt phân tích", `${confidence}%`));
    gates.push(gate("Capture Quality", input.captureQuality));
  }

  if (kind === EVIDENCE_KIND.CYCLE) {
    facts.push(fact("Chu kỳ", input.cycleIndex));
    const score = percent(input.qualityScore);
    const visibility = percent(input.visibility);
    const recognized = percent(input.recognized);
    const overlap = percent(input.overlap);
    if (score !== null) facts.push(fact("Quality signal", `${score}%`));
    if (visibility !== null) facts.push(fact("Pose visibility", `${visibility}%`));
    if (recognized !== null) facts.push(fact("Nhận dạng pha", `${recognized}%`));
    if (overlap !== null) facts.push(fact("Chồng pha", `${overlap}%`));
    facts.push(fact("Pha cần xem", input.weakestPhase));
    gates.push(gate("View Quality", input.viewQuality));
  }

  if (kind === EVIDENCE_KIND.BILATERAL) {
    facts.push(fact("Chu kỳ", input.cycleIndex));
    const evidence = percent(input.evidenceConfidence);
    const bilateral = percent(input.bilateralVisibility);
    if (evidence !== null) facts.push(fact("Evidence confidence", `${evidence}%`));
    if (bilateral !== null) facts.push(fact("Visibility hai bên", `${bilateral}%`));
    facts.push(fact("Lệch tay", input.armDelta));
    facts.push(fact("Lệch gối", input.kneeDelta));
    facts.push(fact("Lệch nhịp đạp", input.kickTiming));
    gates.push(gate("View Quality", input.viewQuality));
  }

  if (kind === EVIDENCE_KIND.ADVISOR) {
    const coverage = percent(input.coverageScore);
    if (coverage !== null) facts.push(fact("Calibration coverage", `${coverage}%`));
    facts.push(fact("Trạng thái Advisor", input.advisorStatus));
    gates.push(gate("Calibration Coverage", input.coverageReady ? "good" : "review"));
    gates.push(gate("View Quality", input.viewQuality));
  }

  gates.push(gate("Unified Trust", trust === "high" ? "strong" : trust === "reference" ? "poor" : trust === "caution" ? "review" : "unknown", trustLabel(trust)));

  const conclusion = trust === "high"
    ? "Các gate hiện cho phép giữ ngôn ngữ kết luận mạnh trong phạm vi clip và góc quay này."
    : trust === "reference"
      ? "Có gate đang chặn hoặc bằng chứng yếu; trace này chỉ dùng để khoanh vùng và kiểm tra lại, không xác nhận kết luận mạnh."
      : "Bằng chứng chưa đủ hoàn chỉnh để đọc kết luận như chắc chắn; cần đối chiếu các gate và mốc video bên dưới.";

  return {
    kind,
    title: "Bằng chứng & gate",
    timeSec,
    facts: facts.filter(Boolean),
    gates,
    conclusion,
  };
}

export function evidenceTraceSignature(trace) {
  return JSON.stringify({ kind: trace.kind, timeSec: trace.timeSec, facts: trace.facts, gates: trace.gates, conclusion: trace.conclusion });
}
