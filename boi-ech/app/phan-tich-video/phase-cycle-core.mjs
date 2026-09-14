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

export function analyzePhaseSequence(frames) {
  const smoothed = smoothPhases(frames);
  const sequence = segmentsFor(smoothed);
  const visible = sequence.filter((segment) => segment.phase !== "unclear");
  let expectedIndex = 0;
  let matched = 0;
  let completeCycles = 0;

  for (const segment of visible) {
    if (segment.phase === EXPECTED_PHASES[expectedIndex]) {
      matched += 1;
      expectedIndex += 1;
      if (expectedIndex === EXPECTED_PHASES.length) {
        completeCycles += 1;
        expectedIndex = 0;
      }
    } else if (segment.phase === "pull") {
      expectedIndex = 1;
      matched += 1;
    }
  }

  const phaseDurations = {
    pull: 0,
    breath: 0,
    "leg-recovery": 0,
    kick: 0,
    glide: 0,
  };
  for (const segment of visible) {
    if (segment.phase === "unclear") continue;
    phaseDurations[segment.phase] += Math.max(1 / SAMPLE_FPS, segment.end - segment.start + 1 / SAMPLE_FPS);
  }

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

  return {
    confidence,
    completeCycles,
    orderScore,
    sequence,
    phaseDurations,
    warnings,
  };
}
