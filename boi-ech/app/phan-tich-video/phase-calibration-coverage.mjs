import { ANALYSIS_VIEW_OPTIONS } from "./phase-view-profile.mjs";

const PHASES = ["pull", "breath", "leg-recovery", "kick", "glide"];

export const CALIBRATION_COVERAGE_RULES = Object.freeze({
  minimumAnnotations: 20,
  minimumPerPhase: 3,
  minimumCompleteCycles: 2,
  minimumTemporalCoverage: 0.5,
  maximumDominantPhaseShare: 0.45,
});

export const CALIBRATION_VIEWS = ANALYSIS_VIEW_OPTIONS;

function keyForTime(time) {
  return Number(time).toFixed(3);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function assessCalibrationCoverage(frames, labelsByTime, options = {}) {
  const safeFrames = Array.isArray(frames) ? [...frames].sort((a, b) => a.time - b.time) : [];
  const labels = labelsByTime && typeof labelsByTime === "object" ? labelsByTime : {};
  const completeCycles = Math.max(0, Number(options.completeCycles) || 0);
  const view = typeof options.view === "string" ? options.view : "";
  const counts = Object.fromEntries(PHASES.map((phase) => [phase, 0]));
  const annotatedTimes = [];

  for (const frame of safeFrames) {
    const truth = labels[keyForTime(frame.time)];
    if (!PHASES.includes(truth)) continue;
    counts[truth] += 1;
    annotatedTimes.push(Number(frame.time));
  }

  const annotated = annotatedTimes.length;
  const minFrameTime = safeFrames.length ? Number(safeFrames[0].time) : 0;
  const maxFrameTime = safeFrames.length ? Number(safeFrames.at(-1).time) : 0;
  const analyzedSpan = Math.max(0, maxFrameTime - minFrameTime);
  const annotatedSpan = annotatedTimes.length >= 2 ? Math.max(...annotatedTimes) - Math.min(...annotatedTimes) : 0;
  const temporalCoverage = analyzedSpan > 0 ? clamp(annotatedSpan / analyzedSpan, 0, 1) : 0;
  const dominantCount = Math.max(0, ...Object.values(counts));
  const dominantShare = annotated ? dominantCount / annotated : 0;
  const coveredPhases = PHASES.filter((phase) => counts[phase] >= CALIBRATION_COVERAGE_RULES.minimumPerPhase);
  const missingPhases = PHASES.filter((phase) => counts[phase] < CALIBRATION_COVERAGE_RULES.minimumPerPhase);
  const viewSelected = CALIBRATION_VIEWS.some((item) => item.value && item.value === view);

  const checks = {
    enoughAnnotations: annotated >= CALIBRATION_COVERAGE_RULES.minimumAnnotations,
    phaseCoverage: coveredPhases.length === PHASES.length,
    enoughCycles: completeCycles >= CALIBRATION_COVERAGE_RULES.minimumCompleteCycles,
    temporalCoverage: temporalCoverage >= CALIBRATION_COVERAGE_RULES.minimumTemporalCoverage,
    balancedPhases: dominantShare <= CALIBRATION_COVERAGE_RULES.maximumDominantPhaseShare,
    viewSelected,
  };

  const issues = [];
  if (!checks.enoughAnnotations) issues.push(`Cần ít nhất ${CALIBRATION_COVERAGE_RULES.minimumAnnotations} mốc Ground Truth; hiện có ${annotated}.`);
  if (!checks.phaseCoverage) issues.push(`Mỗi pha cần ít nhất ${CALIBRATION_COVERAGE_RULES.minimumPerPhase} nhãn; còn thiếu: ${missingPhases.join(", ")}.`);
  if (!checks.enoughCycles) issues.push(`Cần ít nhất ${CALIBRATION_COVERAGE_RULES.minimumCompleteCycles} chu kỳ hoàn chỉnh; hiện có ${completeCycles}.`);
  if (!checks.temporalCoverage) issues.push(`Nhãn Ground Truth mới phủ khoảng ${Math.round(temporalCoverage * 100)}% chiều dài dữ liệu phân tích.`);
  if (!checks.balancedPhases && annotated) issues.push(`Một pha đang chiếm ${Math.round(dominantShare * 100)}% Ground Truth; bộ nhãn còn lệch.`);
  if (!checks.viewSelected) issues.push("Chưa khai báo góc quay của clip calibration.");

  const passedChecks = Object.values(checks).filter(Boolean).length;
  const coverageScore = Math.round(passedChecks / Object.keys(checks).length * 100);
  const readyForThresholdReview = Object.values(checks).every(Boolean);

  return {
    scope: "single-clip",
    readyForThresholdReview,
    globalReady: false,
    coverageScore,
    annotated,
    counts,
    coveredPhases,
    missingPhases,
    completeCycles,
    temporalCoverage,
    dominantShare,
    view,
    viewSelected,
    checks,
    issues,
    note: readyForThresholdReview
      ? "Đủ coverage để xem xét đề xuất ngưỡng trong phạm vi clip/góc quay hiện tại; chưa đủ để suy ra ngưỡng chung cho toàn hệ thống."
      : "Coverage chưa đủ để coi đề xuất ngưỡng là đáng tin; có thể xem mô phỏng nhưng chưa nên dùng để hiệu chỉnh engine.",
  };
}

export const CALIBRATION_COVERAGE_PHASES = PHASES;
