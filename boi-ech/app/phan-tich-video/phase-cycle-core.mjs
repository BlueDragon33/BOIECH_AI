export const SAMPLE_FPS = 5;

export const PHASE_LABEL = {
  pull: "Kéo tay",
  breath: "Lấy hơi / trả tay",
  "leg-recovery": "Thu chân",
  kick: "Đạp chân",
  glide: "Lướt",
  unclear: "Chưa rõ",
};

export const PHASE_THRESHOLDS = Object.freeze({
  glideArmFlexionMax: 24,
  glideKneeFlexionMax: 22,
  glideWristSpreadMax: 1.18,
  glideAnkleSpreadMax: 1.35,
  kickVelocityMin: 5,
  kickKneeFlexionMin: 10,
  legRecoveryKneeFlexionMin: 42,
  pullArmFlexionMin: 48,
  pullWristSpreadMin: 1.12,
  breathArmFlexionMin: 24,
  breathArmFlexionMax: 48,
  overlapArmFlexionMin: 38,
  overlapKneeFlexionMin: 42,
});

const EXPECTED_PHASES = ["pull", "breath", "leg-recovery", "kick", "glide"];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function metricStats(frames, key) {
  const values = frames.map((frame) => Number(frame[key])).filter(Number.isFinite);
  if (!values.length) return { min: 0, max: 0, avg: 0 };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: avg(values),
  };
}

function aboveThresholdScore(value, threshold, margin) {
  return clamp(60 + ((value - threshold) / Math.max(0.001, margin)) * 40, 0, 100);
}

function belowThresholdScore(value, threshold, margin) {
  return clamp(60 + ((threshold - value) / Math.max(0.001, margin)) * 40, 0, 100);
}

function bandScore(value, min, max) {
  if (value < min || value > max) return 0;
  const center = (min + max) / 2;
  const half = Math.max(0.001, (max - min) / 2);
  return clamp(100 - Math.abs(value - center) / half * 40, 60, 100);
}

function phaseDuration(segment) {
  return Math.max(1 / SAMPLE_FPS, segment.end - segment.start + 1 / SAMPLE_FPS);
}

export function classifyPhase({ armFlexion, kneeFlexion, wristSpread, ankleSpread, previousKneeFlexion = null }) {
  const kickVelocity = previousKneeFlexion === null ? 0 : previousKneeFlexion - kneeFlexion;
  const t = PHASE_THRESHOLDS;
  if (armFlexion < t.glideArmFlexionMax && kneeFlexion < t.glideKneeFlexionMax && wristSpread < t.glideWristSpreadMax && ankleSpread < t.glideAnkleSpreadMax) return "glide";
  if (kickVelocity > t.kickVelocityMin && kneeFlexion >= t.kickKneeFlexionMin) return "kick";
  if (kneeFlexion > t.legRecoveryKneeFlexionMin) return "leg-recovery";
  if (armFlexion > t.pullArmFlexionMin && wristSpread > t.pullWristSpreadMin) return "pull";
  if (armFlexion > t.breathArmFlexionMin && armFlexion <= t.breathArmFlexionMax && kneeFlexion < t.legRecoveryKneeFlexionMin) return "breath";
  return "unclear";
}

export function smoothPhases(frames) {
  return frames.map((frame, index) => {
    if (frame.phase !== "unclear") return frame;
    const before = frames[index - 1]?.phase;
    const after = frames[index + 1]?.phase;
    if (before && before === after && before !== "unclear") return { ...frame, phase: before };
    return frame;
  });
}

export function segmentsFor(frames) {
  const segments = [];
  for (const frame of frames) {
    const current = segments.at(-1);
    if (!current || current.phase !== frame.phase) {
      segments.push({ phase: frame.phase, start: frame.time, end: frame.time, frames: 1 });
    } else {
      current.end = frame.time;
      current.frames += 1;
    }
  }
  return segments.filter((segment) => segment.frames >= 2 || segment.phase === "glide");
}

export function summarizeCalibration(frames) {
  const safeFrames = Array.isArray(frames) ? frames : [];
  const recognized = safeFrames.filter((frame) => frame.phase !== "unclear");
  const overlapFrames = safeFrames.filter((frame) => frame.armFlexion > PHASE_THRESHOLDS.overlapArmFlexionMin && frame.kneeFlexion > PHASE_THRESHOLDS.overlapKneeFlexionMin);
  const visibilityValues = safeFrames.map((frame) => Number(frame.visibility)).filter(Number.isFinite);
  const phases = Object.fromEntries(Object.keys(PHASE_LABEL).map((phase) => [phase, safeFrames.filter((frame) => frame.phase === phase).length]));

  return {
    sampledFrames: safeFrames.length,
    recognizedRatio: safeFrames.length ? recognized.length / safeFrames.length : 0,
    overlapRatio: safeFrames.length ? overlapFrames.length / safeFrames.length : 0,
    visibilityAvg: avg(visibilityValues),
    visibilityMin: visibilityValues.length ? Math.min(...visibilityValues) : 0,
    metrics: {
      armFlexion: metricStats(safeFrames, "armFlexion"),
      kneeFlexion: metricStats(safeFrames, "kneeFlexion"),
      wristSpread: metricStats(safeFrames, "wristSpread"),
      ankleSpread: metricStats(safeFrames, "ankleSpread"),
    },
    phases,
  };
}

function framesForSegment(frames, segment) {
  const pad = 1 / SAMPLE_FPS / 4;
  return frames.filter((frame) => frame.time >= segment.start - pad && frame.time <= segment.end + pad);
}

function phaseSignalScore(phase, frames, cycleFrames, segment, selectedSegments) {
  const t = PHASE_THRESHOLDS;
  const visibilityScore = clamp(avg(frames.map((frame) => frame.visibility)) * 100, 0, 100);
  if (!frames.length) return 0;

  let signalScore = 0;
  if (phase === "pull") {
    signalScore = avg([
      aboveThresholdScore(avg(frames.map((frame) => frame.armFlexion)), t.pullArmFlexionMin, 18),
      aboveThresholdScore(avg(frames.map((frame) => frame.wristSpread)), t.pullWristSpreadMin, 0.35),
    ]);
  } else if (phase === "breath") {
    signalScore = avg([
      bandScore(avg(frames.map((frame) => frame.armFlexion)), t.breathArmFlexionMin, t.breathArmFlexionMax),
      belowThresholdScore(avg(frames.map((frame) => frame.kneeFlexion)), t.legRecoveryKneeFlexionMin, 25),
    ]);
  } else if (phase === "leg-recovery") {
    signalScore = aboveThresholdScore(avg(frames.map((frame) => frame.kneeFlexion)), t.legRecoveryKneeFlexionMin, 28);
  } else if (phase === "kick") {
    const kickDrops = [];
    for (let index = 1; index < cycleFrames.length; index += 1) {
      if (cycleFrames[index].phase === "kick") kickDrops.push(cycleFrames[index - 1].kneeFlexion - cycleFrames[index].kneeFlexion);
    }
    signalScore = aboveThresholdScore(Math.max(0, ...kickDrops), t.kickVelocityMin, 14);
  } else if (phase === "glide") {
    signalScore = avg([
      belowThresholdScore(avg(frames.map((frame) => frame.armFlexion)), t.glideArmFlexionMax, 18),
      belowThresholdScore(avg(frames.map((frame) => frame.kneeFlexion)), t.glideKneeFlexionMax, 18),
      belowThresholdScore(avg(frames.map((frame) => frame.wristSpread)), t.glideWristSpreadMax, 0.25),
      belowThresholdScore(avg(frames.map((frame) => frame.ankleSpread)), t.glideAnkleSpreadMax, 0.35),
    ]);
    const pull = selectedSegments.find((item) => item.phase === "pull");
    if (pull) {
      const ratio = phaseDuration(segment) / Math.max(1 / SAMPLE_FPS, phaseDuration(pull));
      const durationScore = aboveThresholdScore(ratio, 0.45, 0.55);
      signalScore = signalScore * 0.75 + durationScore * 0.25;
    }
  }

  return Math.round(clamp(signalScore * 0.7 + visibilityScore * 0.3, 0, 100));
}

function cycleStatus(score) {
  if (score >= 82) return "good";
  if (score >= 65) return "review";
  return "weak";
}

function buildCycleQuality(smoothed, cycleSeed, index) {
  const selectedSegments = cycleSeed.segments;
  const start = selectedSegments[0].start;
  const end = selectedSegments.at(-1).end;
  const cycleFrames = smoothed.filter((frame) => frame.time >= start - 1e-6 && frame.time <= end + 1e-6);
  const calibration = summarizeCalibration(cycleFrames);
  const phaseScores = {};
  const phaseStarts = {};

  for (const segment of selectedSegments) {
    const phaseFrames = framesForSegment(smoothed, segment);
    phaseScores[segment.phase] = phaseSignalScore(segment.phase, phaseFrames, cycleFrames, segment, selectedSegments);
    phaseStarts[segment.phase] = segment.start;
  }

  const weakestPhase = EXPECTED_PHASES.reduce((weakest, phase) => phaseScores[phase] < phaseScores[weakest] ? phase : weakest, EXPECTED_PHASES[0]);
  const orderPurity = EXPECTED_PHASES.length / Math.max(EXPECTED_PHASES.length, cycleSeed.observedSegments.length);
  const coordinationScore = clamp(100 - calibration.overlapRatio * 180, 0, 100);
  const phaseAverage = avg(EXPECTED_PHASES.map((phase) => phaseScores[phase]));
  const qualityScore = Math.round(clamp(
    phaseAverage * 0.5
      + calibration.visibilityAvg * 100 * 0.1
      + calibration.recognizedRatio * 100 * 0.05
      + coordinationScore * 0.1
      + orderPurity * 100 * 0.25,
    0,
    100,
  ));

  const pullSegment = selectedSegments.find((segment) => segment.phase === "pull");
  const glideSegment = selectedSegments.find((segment) => segment.phase === "glide");
  const glidePullRatio = pullSegment && glideSegment ? phaseDuration(glideSegment) / Math.max(1 / SAMPLE_FPS, phaseDuration(pullSegment)) : 0;
  const issues = [];
  const extraSegments = Math.max(0, cycleSeed.observedSegments.length - EXPECTED_PHASES.length);
  if (extraSegments > 0) issues.push(`Có ${extraSegments} đoạn pha chen sai thứ tự trong chu kỳ.`);
  if (calibration.overlapRatio > 0.18) issues.push("Tay và chân chồng pha nhiều trong chu kỳ này.");
  if (calibration.recognizedRatio < 0.85) issues.push("Một phần chu kỳ chưa được nhận dạng pha ổn định.");
  if (calibration.visibilityAvg < 0.7) issues.push("Độ rõ pose của chu kỳ này thấp.");
  if (glidePullRatio > 0 && glidePullRatio < 0.45) issues.push("Pha lướt của chu kỳ này ngắn so với pha kéo tay.");
  if (phaseScores[weakestPhase] < 75) issues.push(`Pha “${PHASE_LABEL[weakestPhase]}” có tín hiệu yếu nhất; nên xem lại đúng mốc thời gian.`);

  return {
    index: index + 1,
    start,
    end,
    duration: Math.max(1 / SAMPLE_FPS, end - start + 1 / SAMPLE_FPS),
    qualityScore,
    status: cycleStatus(qualityScore),
    weakestPhase,
    weakestPhaseScore: phaseScores[weakestPhase],
    phaseScores,
    phaseStarts,
    visibilityAvg: calibration.visibilityAvg,
    recognizedRatio: calibration.recognizedRatio,
    overlapRatio: calibration.overlapRatio,
    orderPurity,
    issues,
  };
}

export function analyzePhaseSequence(frames) {
  const smoothed = smoothPhases(frames);
  const sequence = segmentsFor(smoothed);
  const visible = sequence.filter((segment) => segment.phase !== "unclear");
  let expectedIndex = 0;
  let matched = 0;
  let activeSegments = [];
  let observedSegments = [];
  const cycleSeeds = [];

  for (const segment of visible) {
    if (segment.phase === EXPECTED_PHASES[expectedIndex]) {
      matched += 1;
      activeSegments.push(segment);
      observedSegments.push(segment);
      expectedIndex += 1;
      if (expectedIndex === EXPECTED_PHASES.length) {
        cycleSeeds.push({ segments: activeSegments, observedSegments });
        expectedIndex = 0;
        activeSegments = [];
        observedSegments = [];
      }
    } else if (segment.phase === "pull") {
      expectedIndex = 1;
      matched += 1;
      activeSegments = [segment];
      observedSegments = [segment];
    } else if (expectedIndex > 0) {
      observedSegments.push(segment);
    }
  }

  const completeCycles = cycleSeeds.length;
  const phaseDurations = {
    pull: 0,
    breath: 0,
    "leg-recovery": 0,
    kick: 0,
    glide: 0,
  };
  for (const segment of visible) phaseDurations[segment.phase] += phaseDuration(segment);

  const warnings = [];
  const phasesSeen = new Set(visible.map((segment) => segment.phase));
  for (const phase of EXPECTED_PHASES) {
    if (!phasesSeen.has(phase)) warnings.push(`Chưa nhận dạng ổn định pha “${PHASE_LABEL[phase]}”.`);
  }

  const calibration = summarizeCalibration(smoothed);
  if (calibration.overlapRatio > 0.18) warnings.push("Tay và chân có dấu hiệu cùng thu mạnh trong một khoảng dài; cần kiểm tra nhịp phối hợp.");
  if (completeCycles === 0) warnings.push("Chưa thấy trọn một chu kỳ 5 pha; nên quay đủ ít nhất 2 nhịp bơi liên tiếp.");
  if (phaseDurations.glide > 0 && phaseDurations.glide < phaseDurations.pull * 0.45) warnings.push("Pha lướt khá ngắn so với pha kéo tay; có thể đang vào nhịp mới quá sớm.");

  const confidence = Math.round(clamp((calibration.visibilityAvg * 0.55 + calibration.recognizedRatio * 0.45) * 100, 0, 100));
  const orderScore = Math.round(clamp(matched / Math.max(EXPECTED_PHASES.length, visible.length) * 100, 0, 100));
  const cycles = cycleSeeds.map((cycle, index) => buildCycleQuality(smoothed, cycle, index));
  const cycleQualityAvg = cycles.length ? Math.round(avg(cycles.map((cycle) => cycle.qualityScore))) : 0;

  return {
    confidence,
    completeCycles,
    orderScore,
    cycleQualityAvg,
    cycles,
    sequence,
    phaseDurations,
    warnings,
  };
}
