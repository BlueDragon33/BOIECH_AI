const PHASES = ["pull", "breath", "leg-recovery", "kick", "glide"];

export const ANALYSIS_VIEW_OPTIONS = Object.freeze([
  { value: "", label: "Chưa chọn góc quay" },
  { value: "side", label: "Ngang thân (side)" },
  { value: "rear", label: "Từ sau (rear)" },
  { value: "front-oblique", label: "Trước / chéo" },
]);

export const ANALYSIS_VIEW_PROFILES = Object.freeze({
  side: Object.freeze({
    label: "Ngang thân",
    summary: "Mạnh nhất cho nhịp pha, phối hợp tay-chân, lấy hơi và thời lượng lướt.",
    focus: Object.freeze(["pull", "breath", "glide"]),
    limitations: "Độ mở hai bên và đối xứng trái-phải chỉ nên xem hỗ trợ từ góc ngang.",
    phaseReliability: Object.freeze({
      pull: 1,
      breath: 1,
      "leg-recovery": 0.82,
      kick: 0.88,
      glide: 1,
    }),
  }),
  rear: Object.freeze({
    label: "Từ sau",
    summary: "Mạnh nhất cho thu chân, đạp chân, độ mở chân và quan sát hai bên cơ thể.",
    focus: Object.freeze(["leg-recovery", "kick"]),
    limitations: "Pha lấy hơi khó kết luận từ phía sau; chỉ dùng như tín hiệu tham khảo.",
    phaseReliability: Object.freeze({
      pull: 0.76,
      breath: 0.42,
      "leg-recovery": 1,
      kick: 1,
      glide: 0.84,
    }),
  }),
  "front-oblique": Object.freeze({
    label: "Trước / chéo",
    summary: "Cân bằng cho tay, chân và phối hợp tổng thể nhưng kém góc ngang về timing chính xác.",
    focus: Object.freeze(["pull", "leg-recovery", "kick"]),
    limitations: "Timing lấy hơi/lướt và các tỷ lệ theo chiều sâu có thể bị sai lệch phối cảnh.",
    phaseReliability: Object.freeze({
      pull: 0.92,
      breath: 0.76,
      "leg-recovery": 0.9,
      kick: 0.9,
      glide: 0.82,
    }),
  }),
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function viewProfile(view) {
  return ANALYSIS_VIEW_PROFILES[view] ?? null;
}

export function assessCycleByView(cycle, view) {
  const profile = viewProfile(view);
  if (!profile || !cycle || typeof cycle !== "object") {
    return {
      ready: false,
      view: "",
      label: "Chưa chọn góc quay",
      signalScore: null,
      evidenceConfidence: 0,
      focusPhases: [],
      limitedPhases: [],
      phaseEvidence: {},
      weakestTrustedPhase: null,
      note: "Chọn góc quay để giới hạn kết luận vào các pha mà góc đó quan sát đủ tin cậy.",
    };
  }

  const phaseEvidence = {};
  const trusted = [];
  for (const phase of PHASES) {
    const reliability = clamp(Number(profile.phaseReliability[phase]) || 0, 0, 1);
    const score = clamp(Number(cycle.phaseScores?.[phase]) || 0, 0, 100);
    const usable = reliability >= 0.7;
    phaseEvidence[phase] = {
      reliability,
      reliabilityPercent: Math.round(reliability * 100),
      score,
      usable,
    };
    if (usable) trusted.push({ phase, reliability, score });
  }

  const totalWeight = trusted.reduce((sum, item) => sum + item.reliability, 0);
  const signalScore = totalWeight
    ? Math.round(trusted.reduce((sum, item) => sum + item.score * item.reliability, 0) / totalWeight)
    : null;
  const weakestTrustedPhase = trusted.length
    ? trusted.reduce((weakest, item) => item.score < weakest.score ? item : weakest).phase
    : null;
  const meanReliability = avg(trusted.map((item) => item.reliability));
  const visibility = clamp(Number(cycle.visibilityAvg) || 0, 0, 1);
  const evidenceConfidence = Math.round(clamp((meanReliability * 0.55 + visibility * 0.45) * 100, 0, 100));
  const limitedPhases = PHASES.filter((phase) => phaseEvidence[phase].reliability < 0.7);

  return {
    ready: true,
    view,
    label: profile.label,
    summary: profile.summary,
    limitations: profile.limitations,
    signalScore,
    evidenceConfidence,
    focusPhases: [...profile.focus],
    limitedPhases,
    phaseEvidence,
    weakestTrustedPhase,
    note: "Điểm tín hiệu theo góc chỉ tổng hợp các pha có độ tin cậy góc quay ≥70%; không thay thế qualityScore và không tham gia điểm chính.",
  };
}

export const ANALYSIS_VIEW_PHASES = PHASES;
