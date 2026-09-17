const SUPPORTED_VIEWS = new Set(["side", "rear", "front-oblique"]);

export const BILATERAL_SYMMETRY_RULES = Object.freeze({
  trustedEvidenceMin: 0.7,
  armReviewAvgDeg: 10,
  armWeakAvgDeg: 18,
  kneeReviewAvgDeg: 10,
  kneeWeakAvgDeg: 18,
  jointReviewPeakDeg: 20,
  jointWeakPeakDeg: 30,
  kickTimingReviewSec: 0.2,
  kickTimingWeakSec: 0.35,
  kickStrengthReviewDegPerSample: 8,
});

export const BILATERAL_VIEW_RELIABILITY = Object.freeze({
  side: 0.45,
  rear: 1,
  "front-oblique": 0.82,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function avg(values) {
  const safe = values.filter(Number.isFinite);
  return safe.length ? safe.reduce((sum, value) => sum + value, 0) / safe.length : 0;
}

function finiteFrame(frame) {
  return frame
    && Number.isFinite(Number(frame.time))
    && Number.isFinite(Number(frame.leftArmFlexion))
    && Number.isFinite(Number(frame.rightArmFlexion))
    && Number.isFinite(Number(frame.leftKneeFlexion))
    && Number.isFinite(Number(frame.rightKneeFlexion));
}

function peakKick(frames, side) {
  let best = { drop: 0, time: null };
  const key = side === "left" ? "leftKneeFlexion" : "rightKneeFlexion";
  for (let index = 1; index < frames.length; index += 1) {
    const previous = Number(frames[index - 1][key]);
    const current = Number(frames[index][key]);
    if (!Number.isFinite(previous) || !Number.isFinite(current)) continue;
    const drop = previous - current;
    if (drop > best.drop) best = { drop, time: Number(frames[index].time) };
  }
  return best;
}

function cycleAssessment(frames, cycle, view) {
  const start = Number(cycle.start);
  const end = Number(cycle.end);
  const cycleFrames = frames.filter((frame) => frame.time >= start - 1e-6 && frame.time <= end + 1e-6);
  const armFrames = cycleFrames.filter((frame) => frame.phase === "pull" || frame.phase === "breath");
  const legFrames = cycleFrames.filter((frame) => frame.phase === "leg-recovery" || frame.phase === "kick");
  const armSource = armFrames.length ? armFrames : cycleFrames;
  const legSource = legFrames.length ? legFrames : cycleFrames;

  const armDeltas = armSource.map((frame) => Math.abs(frame.leftArmFlexion - frame.rightArmFlexion));
  const kneeDeltas = legSource.map((frame) => Math.abs(frame.leftKneeFlexion - frame.rightKneeFlexion));
  const armAverageDeg = avg(armDeltas);
  const kneeAverageDeg = avg(kneeDeltas);
  const armPeakDeg = armDeltas.length ? Math.max(...armDeltas) : 0;
  const kneePeakDeg = kneeDeltas.length ? Math.max(...kneeDeltas) : 0;

  const visibility = avg(cycleFrames.map((frame) => Math.min(
    clamp(Number(frame.leftVisibility) || 0, 0, 1),
    clamp(Number(frame.rightVisibility) || 0, 0, 1),
  )));
  const viewReliability = BILATERAL_VIEW_RELIABILITY[view] ?? 0;
  const evidence = clamp(viewReliability * 0.6 + visibility * 0.4, 0, 1);

  const kickFrames = legSource.length ? legSource : cycleFrames;
  const leftKick = peakKick(kickFrames, "left");
  const rightKick = peakKick(kickFrames, "right");
  const kickTimingLagSec = leftKick.time === null || rightKick.time === null
    ? null
    : Math.abs(leftKick.time - rightKick.time);
  const kickStrengthDelta = Math.abs(leftKick.drop - rightKick.drop);

  let worstTime = start;
  let worstSeverity = -1;
  for (const frame of cycleFrames) {
    const armDelta = Math.abs(frame.leftArmFlexion - frame.rightArmFlexion);
    const kneeDelta = Math.abs(frame.leftKneeFlexion - frame.rightKneeFlexion);
    const severity = Math.max(armDelta / BILATERAL_SYMMETRY_RULES.armWeakAvgDeg, kneeDelta / BILATERAL_SYMMETRY_RULES.kneeWeakAvgDeg);
    if (severity > worstSeverity) {
      worstSeverity = severity;
      worstTime = frame.time;
    }
  }

  const issues = [];
  let status = "balanced";
  if (evidence < BILATERAL_SYMMETRY_RULES.trustedEvidenceMin) {
    status = "uncertain";
    issues.push("Góc quay/visibility chưa đủ để kết luận chắc về đối xứng trái–phải.");
  } else {
    const weak = armAverageDeg >= BILATERAL_SYMMETRY_RULES.armWeakAvgDeg
      || kneeAverageDeg >= BILATERAL_SYMMETRY_RULES.kneeWeakAvgDeg
      || armPeakDeg >= BILATERAL_SYMMETRY_RULES.jointWeakPeakDeg
      || kneePeakDeg >= BILATERAL_SYMMETRY_RULES.jointWeakPeakDeg
      || (kickTimingLagSec !== null && kickTimingLagSec >= BILATERAL_SYMMETRY_RULES.kickTimingWeakSec);
    const review = armAverageDeg >= BILATERAL_SYMMETRY_RULES.armReviewAvgDeg
      || kneeAverageDeg >= BILATERAL_SYMMETRY_RULES.kneeReviewAvgDeg
      || armPeakDeg >= BILATERAL_SYMMETRY_RULES.jointReviewPeakDeg
      || kneePeakDeg >= BILATERAL_SYMMETRY_RULES.jointReviewPeakDeg
      || (kickTimingLagSec !== null && kickTimingLagSec >= BILATERAL_SYMMETRY_RULES.kickTimingReviewSec)
      || kickStrengthDelta >= BILATERAL_SYMMETRY_RULES.kickStrengthReviewDegPerSample;
    status = weak ? "weak" : review ? "review" : "balanced";

    if (armAverageDeg >= BILATERAL_SYMMETRY_RULES.armReviewAvgDeg) issues.push(`Tay trái–phải lệch trung bình ${Math.round(armAverageDeg)}° trong pha tay.`);
    if (kneeAverageDeg >= BILATERAL_SYMMETRY_RULES.kneeReviewAvgDeg) issues.push(`Gối trái–phải lệch trung bình ${Math.round(kneeAverageDeg)}° trong pha chân.`);
    if (kickTimingLagSec !== null && kickTimingLagSec >= BILATERAL_SYMMETRY_RULES.kickTimingReviewSec) issues.push(`Đỉnh đạp hai chân lệch khoảng ${kickTimingLagSec.toFixed(1)} giây.`);
    if (kickStrengthDelta >= BILATERAL_SYMMETRY_RULES.kickStrengthReviewDegPerSample) issues.push(`Biên độ duỗi nhanh hai chân lệch khoảng ${Math.round(kickStrengthDelta)}°/mẫu.`);
  }

  return {
    index: Number(cycle.index) || 0,
    start,
    end,
    ready: true,
    status,
    evidenceConfidence: Math.round(evidence * 100),
    viewReliability: Math.round(viewReliability * 100),
    bilateralVisibility: Math.round(visibility * 100),
    armAverageDeg: Math.round(armAverageDeg * 10) / 10,
    armPeakDeg: Math.round(armPeakDeg * 10) / 10,
    kneeAverageDeg: Math.round(kneeAverageDeg * 10) / 10,
    kneePeakDeg: Math.round(kneePeakDeg * 10) / 10,
    kickTimingLagSec: kickTimingLagSec === null ? null : Math.round(kickTimingLagSec * 10) / 10,
    kickStrengthDelta: Math.round(kickStrengthDelta * 10) / 10,
    worstTime: Number(worstTime),
    issues,
  };
}

export function assessBilateralSymmetry(frames, cycles, view) {
  if (!SUPPORTED_VIEWS.has(view)) {
    return {
      ready: false,
      view: "",
      cycles: [],
      trustedCycles: 0,
      note: "Chọn góc quay trước khi diễn giải đối xứng trái–phải.",
    };
  }

  const safeFrames = Array.isArray(frames) ? frames.filter(finiteFrame).sort((a, b) => a.time - b.time) : [];
  const safeCycles = Array.isArray(cycles) ? cycles.filter((cycle) => Number.isFinite(Number(cycle?.start)) && Number.isFinite(Number(cycle?.end))) : [];
  const assessments = safeCycles.map((cycle) => cycleAssessment(safeFrames, cycle, view));
  const trustedCycles = assessments.filter((cycle) => cycle.evidenceConfidence >= BILATERAL_SYMMETRY_RULES.trustedEvidenceMin * 100).length;

  return {
    ready: true,
    view,
    cycles: assessments,
    trustedCycles,
    note: view === "rear"
      ? "Góc từ sau là nguồn bằng chứng chính cho đối xứng chân/tay; vẫn cần visibility tốt ở cả hai bên."
      : view === "front-oblique"
        ? "Góc trước/chéo có thể hỗ trợ đối xứng nhưng chịu ảnh hưởng phối cảnh; ưu tiên xác nhận lại bằng góc từ sau."
        : "Góc ngang không đủ mạnh để kết luận đối xứng trái–phải; chỉ dùng tín hiệu tham khảo.",
  };
}
