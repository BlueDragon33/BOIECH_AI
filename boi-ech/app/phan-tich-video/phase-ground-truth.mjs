const SCORED_PHASES = ["pull", "breath", "leg-recovery", "kick", "glide"];

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function metricStats(values) {
  const safe = values.map(Number).filter(Number.isFinite);
  if (!safe.length) return { min: 0, max: 0, avg: 0 };
  return { min: Math.min(...safe), max: Math.max(...safe), avg: avg(safe) };
}

export function summarizeGroundTruth(frames, labelsByTime) {
  const safeFrames = Array.isArray(frames) ? frames : [];
  const labels = labelsByTime && typeof labelsByTime === "object" ? labelsByTime : {};
  const annotations = [];

  for (const frame of safeFrames) {
    const key = Number(frame.time).toFixed(3);
    const truthPhase = labels[key];
    if (!SCORED_PHASES.includes(truthPhase)) continue;
    annotations.push({
      time: frame.time,
      aiPhase: frame.phase,
      truthPhase,
      armFlexion: frame.armFlexion,
      kneeFlexion: frame.kneeFlexion,
      wristSpread: frame.wristSpread,
      ankleSpread: frame.ankleSpread,
      visibility: frame.visibility,
    });
  }

  const matrix = Object.fromEntries(
    ["pull", "breath", "leg-recovery", "kick", "glide", "unclear"].map((aiPhase) => [
      aiPhase,
      Object.fromEntries(SCORED_PHASES.map((truthPhase) => [truthPhase, 0])),
    ]),
  );

  for (const item of annotations) {
    if (!matrix[item.aiPhase]) matrix[item.aiPhase] = Object.fromEntries(SCORED_PHASES.map((phase) => [phase, 0]));
    matrix[item.aiPhase][item.truthPhase] += 1;
  }

  const matches = annotations.filter((item) => item.aiPhase === item.truthPhase).length;
  const mistakes = [];
  for (const [aiPhase, row] of Object.entries(matrix)) {
    for (const [truthPhase, count] of Object.entries(row)) {
      if (count > 0 && aiPhase !== truthPhase) mistakes.push({ aiPhase, truthPhase, count });
    }
  }
  mistakes.sort((a, b) => b.count - a.count || a.aiPhase.localeCompare(b.aiPhase));

  const phaseMetrics = {};
  for (const phase of SCORED_PHASES) {
    const rows = annotations.filter((item) => item.truthPhase === phase);
    const correct = rows.filter((item) => item.aiPhase === phase).length;
    phaseMetrics[phase] = {
      annotated: rows.length,
      correct,
      recall: rows.length ? correct / rows.length : 0,
      metrics: {
        armFlexion: metricStats(rows.map((item) => item.armFlexion)),
        kneeFlexion: metricStats(rows.map((item) => item.kneeFlexion)),
        wristSpread: metricStats(rows.map((item) => item.wristSpread)),
        ankleSpread: metricStats(rows.map((item) => item.ankleSpread)),
      },
    };
  }

  return {
    annotated: annotations.length,
    matches,
    corrections: annotations.length - matches,
    accuracy: annotations.length ? matches / annotations.length : 0,
    matrix,
    mistakes,
    phaseMetrics,
    annotations,
  };
}

export const GROUND_TRUTH_PHASES = SCORED_PHASES;
