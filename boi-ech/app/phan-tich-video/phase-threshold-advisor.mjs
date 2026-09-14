import { PHASE_THRESHOLDS } from "./phase-cycle-core.mjs";

const PHASES = ["pull", "breath", "leg-recovery", "kick", "glide"];

const SEARCH = Object.freeze({
  glideArmFlexionMax: { steps: [-8, -6, -4, -2, 2, 4, 6, 8], phases: ["glide"], digits: 0 },
  glideKneeFlexionMax: { steps: [-8, -6, -4, -2, 2, 4, 6, 8], phases: ["glide"], digits: 0 },
  glideWristSpreadMax: { steps: [-0.12, -0.09, -0.06, -0.03, 0.03, 0.06, 0.09, 0.12], phases: ["glide"], digits: 2 },
  glideAnkleSpreadMax: { steps: [-0.16, -0.12, -0.08, -0.04, 0.04, 0.08, 0.12, 0.16], phases: ["glide"], digits: 2 },
  kickVelocityMin: { steps: [-4, -3, -2, -1, 1, 2, 3, 4], phases: ["kick"], digits: 0 },
  kickKneeFlexionMin: { steps: [-8, -6, -4, -2, 2, 4, 6, 8], phases: ["kick"], digits: 0 },
  legRecoveryKneeFlexionMin: { steps: [-8, -6, -4, -2, 2, 4, 6, 8], phases: ["leg-recovery"], digits: 0 },
  pullArmFlexionMin: { steps: [-8, -6, -4, -2, 2, 4, 6, 8], phases: ["pull"], digits: 0 },
  pullWristSpreadMin: { steps: [-0.12, -0.09, -0.06, -0.03, 0.03, 0.06, 0.09, 0.12], phases: ["pull"], digits: 2 },
  breathArmFlexionMin: { steps: [-8, -6, -4, -2, 2, 4, 6, 8], phases: ["breath"], digits: 0 },
  breathArmFlexionMax: { steps: [-8, -6, -4, -2, 2, 4, 6, 8], phases: ["breath"], digits: 0 },
});

const LABELS = Object.freeze({
  glideArmFlexionMax: "Lướt · arm flexion tối đa",
  glideKneeFlexionMax: "Lướt · knee flexion tối đa",
  glideWristSpreadMax: "Lướt · wrist spread tối đa",
  glideAnkleSpreadMax: "Lướt · ankle spread tối đa",
  kickVelocityMin: "Đạp chân · mức duỗi gối tối thiểu / mẫu",
  kickKneeFlexionMin: "Đạp chân · knee flexion tối thiểu",
  legRecoveryKneeFlexionMin: "Thu chân · knee flexion tối thiểu",
  pullArmFlexionMin: "Kéo tay · arm flexion tối thiểu",
  pullWristSpreadMin: "Kéo tay · wrist spread tối thiểu",
  breathArmFlexionMin: "Lấy hơi/trả tay · arm flexion tối thiểu",
  breathArmFlexionMax: "Lấy hơi/trả tay · arm flexion tối đa",
});

function keyForTime(time) {
  return Number(time).toFixed(3);
}

function classify(frame, previousKneeFlexion, thresholds) {
  const t = thresholds;
  const kickVelocity = previousKneeFlexion === null ? 0 : previousKneeFlexion - frame.kneeFlexion;
  if (frame.armFlexion < t.glideArmFlexionMax && frame.kneeFlexion < t.glideKneeFlexionMax && frame.wristSpread < t.glideWristSpreadMax && frame.ankleSpread < t.glideAnkleSpreadMax) return "glide";
  if (kickVelocity > t.kickVelocityMin && frame.kneeFlexion >= t.kickKneeFlexionMin) return "kick";
  if (frame.kneeFlexion > t.legRecoveryKneeFlexionMin) return "leg-recovery";
  if (frame.armFlexion > t.pullArmFlexionMin && frame.wristSpread > t.pullWristSpreadMin) return "pull";
  if (frame.armFlexion > t.breathArmFlexionMin && frame.armFlexion <= t.breathArmFlexionMax && frame.kneeFlexion < t.legRecoveryKneeFlexionMin) return "breath";
  return "unclear";
}

function validThresholds(thresholds) {
  return thresholds.breathArmFlexionMin < thresholds.breathArmFlexionMax
    && thresholds.glideArmFlexionMax >= 4
    && thresholds.glideKneeFlexionMax >= 4
    && thresholds.kickVelocityMin >= 1
    && thresholds.kickKneeFlexionMin >= 2
    && thresholds.pullArmFlexionMin >= 10
    && thresholds.legRecoveryKneeFlexionMin >= 15
    && thresholds.glideWristSpreadMax >= 0.5
    && thresholds.glideAnkleSpreadMax >= 0.5
    && thresholds.pullWristSpreadMin >= 0.5;
}

export function simulateThresholds(frames, labelsByTime, thresholds = PHASE_THRESHOLDS) {
  const safeFrames = Array.isArray(frames) ? [...frames].sort((a, b) => a.time - b.time) : [];
  const labels = labelsByTime && typeof labelsByTime === "object" ? labelsByTime : {};
  let previousKneeFlexion = null;
  let annotated = 0;
  let matches = 0;
  const perPhase = Object.fromEntries(PHASES.map((phase) => [phase, { annotated: 0, matches: 0 }]));

  for (const frame of safeFrames) {
    const predicted = classify(frame, previousKneeFlexion, thresholds);
    previousKneeFlexion = Number.isFinite(Number(frame.kneeFlexion)) ? Number(frame.kneeFlexion) : previousKneeFlexion;
    const truth = labels[keyForTime(frame.time)];
    if (!PHASES.includes(truth)) continue;
    annotated += 1;
    perPhase[truth].annotated += 1;
    if (predicted === truth) {
      matches += 1;
      perPhase[truth].matches += 1;
    }
  }

  return {
    annotated,
    matches,
    accuracy: annotated ? matches / annotated : 0,
    perPhase: Object.fromEntries(PHASES.map((phase) => [phase, {
      ...perPhase[phase],
      recall: perPhase[phase].annotated ? perPhase[phase].matches / perPhase[phase].annotated : 0,
    }])),
  };
}

function roundFor(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function phaseSupport(simulation, phases) {
  return phases.reduce((sum, phase) => sum + (simulation.perPhase[phase]?.annotated ?? 0), 0);
}

export function adviseThresholds(frames, labelsByTime, currentThresholds = PHASE_THRESHOLDS) {
  const baseline = simulateThresholds(frames, labelsByTime, currentThresholds);
  if (baseline.annotated < 10) {
    return {
      ready: false,
      minimumAnnotations: 10,
      baseline,
      preview: baseline,
      recommendations: [],
      previewThresholds: { ...currentThresholds },
      reason: `Cần ít nhất 10 mốc Ground Truth; hiện có ${baseline.annotated}.`,
    };
  }

  const recommendations = [];
  for (const [thresholdKey, config] of Object.entries(SEARCH)) {
    if (phaseSupport(baseline, config.phases) < 2) continue;
    const current = Number(currentThresholds[thresholdKey]);
    if (!Number.isFinite(current)) continue;
    let best = { value: current, simulation: baseline };

    for (const step of config.steps) {
      const value = roundFor(current + step, config.digits);
      const candidateThresholds = { ...currentThresholds, [thresholdKey]: value };
      if (!validThresholds(candidateThresholds)) continue;
      const simulation = simulateThresholds(frames, labelsByTime, candidateThresholds);
      if (simulation.accuracy > best.simulation.accuracy + 1e-9) best = { value, simulation };
      else if (Math.abs(simulation.accuracy - best.simulation.accuracy) < 1e-9 && Math.abs(value - current) < Math.abs(best.value - current)) best = { value, simulation };
    }

    const gain = best.simulation.accuracy - baseline.accuracy;
    if (best.value !== current && gain >= 0.02) {
      recommendations.push({
        key: thresholdKey,
        label: LABELS[thresholdKey] ?? thresholdKey,
        current,
        suggested: best.value,
        delta: roundFor(best.value - current, config.digits),
        support: phaseSupport(baseline, config.phases),
        baselineAccuracy: baseline.accuracy,
        candidateAccuracy: best.simulation.accuracy,
        gain,
      });
    }
  }

  recommendations.sort((a, b) => b.gain - a.gain || b.support - a.support || a.key.localeCompare(b.key));

  const previewThresholds = { ...currentThresholds };
  let preview = baseline;
  const acceptedRecommendations = [];
  for (const recommendation of recommendations) {
    const candidateThresholds = { ...previewThresholds, [recommendation.key]: recommendation.suggested };
    if (!validThresholds(candidateThresholds)) continue;
    const candidatePreview = simulateThresholds(frames, labelsByTime, candidateThresholds);
    if (candidatePreview.accuracy + 1e-9 < preview.accuracy) continue;
    previewThresholds[recommendation.key] = recommendation.suggested;
    preview = candidatePreview;
    acceptedRecommendations.push(recommendation);
  }

  return {
    ready: true,
    minimumAnnotations: 10,
    baseline,
    preview,
    recommendations: acceptedRecommendations,
    previewThresholds,
    reason: acceptedRecommendations.length
      ? "Đề xuất được tạo bằng mô phỏng Ground Truth trong phiên hiện tại; engine chưa bị thay đổi."
      : "Chưa có thay đổi ngưỡng đơn lẻ nào cải thiện độ khớp ít nhất 2 điểm phần trăm trên Ground Truth hiện tại.",
  };
}

export const THRESHOLD_ADVISOR_SEARCH = SEARCH;
