export const SAMPLE_FPS = 5;

export const PHASE_LABEL = {
  pull: "Kéo tay",
  breath: "Lấy hơi / trả tay",
  "leg-recovery": "Thu chân",
  kick: "Đạp chân",
  glide: "Lướt",
  unclear: "Chưa rõ",
};

const EXPECTED_PHASES = ["pull", "breath", "leg-recovery", "kick", "glide"];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function classifyPhase({ armFlexion, kneeFlexion, wristSpread, ankleSpread, previousKneeFlexion = null }) {
  const kickVelocity = previousKneeFlexion === null ? 0 : previousKneeFlexion - kneeFlexion;
  if (armFlexion < 24 && kneeFlexion < 22 && wristSpread < 1.18 && ankleSpread < 1.35) return "glide";
  if (kickVelocity > 5 && kneeFlexion >= 10) return "kick";
  if (kneeFlexion > 42) return "leg-recovery";
  if (armFlexion > 48 && wristSpread > 1.12) return "pull";
  if (armFlexion > 24 && armFlexion <= 48 && kneeFlexion < 42) return "breath";
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

  const overlapping = smoothed.filter((frame) => frame.armFlexion > 38 && frame.kneeFlexion > 42).length / Math.max(1, smoothed.length);
  if (overlapping > 0.18) warnings.push("Tay và chân có dấu hiệu cùng thu mạnh trong một khoảng dài; cần kiểm tra nhịp phối hợp.");
  if (completeCycles === 0) warnings.push("Chưa thấy trọn một chu kỳ 5 pha; nên quay đủ ít nhất 2 nhịp bơi liên tiếp.");
  if (phaseDurations.glide > 0 && phaseDurations.glide < phaseDurations.pull * 0.45) warnings.push("Pha lướt khá ngắn so với pha kéo tay; có thể đang vào nhịp mới quá sớm.");

  const recognizedRatio = smoothed.filter((frame) => frame.phase !== "unclear").length / Math.max(1, smoothed.length);
  const confidence = Math.round(clamp((avg(smoothed.map((frame) => frame.visibility)) * 0.55 + recognizedRatio * 0.45) * 100, 0, 100));
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
