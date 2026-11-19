const SCORED_PHASES = ["pull", "breath", "leg-recovery", "kick", "glide"];

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function metricStats(values) {
  const safe = values.map(Number).filter(Number.isFinite);
  if (!safe.length) return { min: 0, max: 0, avg: 0 };
  return { min: Math.min(...safe), max: Math.max(...safe), avg: avg(safe) };
}

function transitionErrors(frames, labels) {
  const truth = [], predicted = [];
  let segment = 0;
  for (let index = 1; index < frames.length; index++) {
    const before = frames[index - 1], after = frames[index];
    const gap = after.time - before.time;
    const from = labels[Number(before.time).toFixed(3)], to = labels[Number(after.time).toFixed(3)];
    // A boundary requires adjacent labelled samples. Gaps cannot establish when
    // a phase changed. Sampling remains 5 Hz, so report frame-time error only.
    if (gap <= 0 || gap > 0.25 || !SCORED_PHASES.includes(from) || !SCORED_PHASES.includes(to)) { segment++; continue; }
    if (from !== to) truth.push({from, to, time: after.time, segment});
    if (before.phase !== after.phase && SCORED_PHASES.includes(before.phase) && SCORED_PHASES.includes(after.phase))
      predicted.push({from: before.phase, to: after.phase, time: after.time, segment});
  }
  const remaining = new Set(predicted.map((_, index) => index));
  const errors = [];
  for (const boundary of truth) {
    const match = [...remaining].filter(index => predicted[index].segment === boundary.segment
      && predicted[index].from === boundary.from && predicted[index].to === boundary.to
      && Math.abs(predicted[index].time - boundary.time) <= 0.6)
      .sort((a, b) => Math.abs(predicted[a].time - boundary.time) - Math.abs(predicted[b].time - boundary.time))[0];
    if (match === undefined) continue;
    remaining.delete(match);
    errors.push(Math.abs(predicted[match].time - boundary.time));
  }
  return {expected: truth.length, matched: errors.length, missed: truth.length - errors.length,
    extra: remaining.size, meanAbsoluteSeconds: errors.length ? avg(errors) : null};
}

export function summarizeGroundTruth(frames, labelsByTime) {
  const safeFrames = Array.isArray(frames) ? frames.filter(frame => Number.isFinite(frame?.time) && frame.time >= 0)
    .slice().sort((a, b) => a.time - b.time) : [];
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

  /** @type {Record<string, { annotated: number; correct: number; recall: number; precision: number | null; f1: number | null; metrics: Record<"armFlexion" | "kneeFlexion" | "wristSpread" | "ankleSpread", { min: number; max: number; avg: number }> }>} */
  const phaseMetrics = {};
  for (const phase of SCORED_PHASES) {
    const rows = annotations.filter((item) => item.truthPhase === phase);
    const correct = rows.filter((item) => item.aiPhase === phase).length;
    const predicted = annotations.filter(item => item.aiPhase === phase).length;
    phaseMetrics[phase] = {
      annotated: rows.length,
      correct,
      recall: rows.length ? correct / rows.length : 0,
      precision: predicted ? correct / predicted : rows.length ? 0 : null,
      f1: rows.length + predicted ? 2 * correct / (rows.length + predicted) : null,
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
    macroF1: Object.values(phaseMetrics).some(row => row.f1 !== null)
      ? avg(Object.values(phaseMetrics).flatMap(row => row.f1 === null ? [] : [row.f1])) : null,
    abstained: annotations.filter(item => !SCORED_PHASES.includes(item.aiPhase)).length,
    labelCoverage: safeFrames.length ? annotations.length / safeFrames.length : 0,
    transitions: transitionErrors(safeFrames, labels),
    matrix,
    mistakes,
    phaseMetrics,
    annotations,
  };
}

export const GROUND_TRUTH_PHASES = SCORED_PHASES;
