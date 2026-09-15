const METRIC_LABELS = Object.freeze({
  detectionRate: "Pose liên tục",
  visibility: "Độ rõ",
  bodyCoverage: "Đủ lớn",
  edgeSafety: "Không sát mép",
  stability: "Ổn định",
});

const CHECK_LABELS = Object.freeze({
  poseContinuity: "Pose liên tục",
  visibility: "Độ rõ",
  bodyCoverage: "Đủ lớn",
  edgeSafety: "Không sát mép",
  stability: "Ổn định",
  viewEvidence: "Bằng chứng theo góc quay",
});

const STATUS_RANK = Object.freeze({ retry: 0, review: 1, good: 2 });
const finite = (value) => Number.isFinite(value) ? value : 0;
const percentPoint = (value) => Math.round(finite(value) * 100);

function metricChanges(previousMetrics = {}, currentMetrics = {}) {
  return Object.entries(METRIC_LABELS).map(([key, label]) => {
    const before = finite(previousMetrics[key]);
    const after = finite(currentMetrics[key]);
    const delta = after - before;
    return {
      key,
      label,
      before,
      after,
      delta,
      direction: delta >= 0.05 ? "improved" : delta <= -0.05 ? "regressed" : "stable",
    };
  });
}

function changedChecks(previousChecks = {}, currentChecks = {}) {
  const resolved = [];
  const regressed = [];
  const remaining = [];
  Object.entries(CHECK_LABELS).forEach(([key, label]) => {
    const before = Boolean(previousChecks[key]);
    const after = Boolean(currentChecks[key]);
    if (!before && after) resolved.push({ key, label });
    else if (before && !after) regressed.push({ key, label });
    else if (!after) remaining.push({ key, label });
  });
  return { resolved, regressed, remaining };
}

export function compareRetakeGuidance(previous, current) {
  if (!previous || !current) return null;
  const scoreBefore = Math.max(0, Math.min(100, Math.round(finite(previous.score))));
  const scoreAfter = Math.max(0, Math.min(100, Math.round(finite(current.score))));
  const scoreDelta = scoreAfter - scoreBefore;
  const metrics = metricChanges(previous.metrics, current.metrics);
  const checks = changedChecks(previous.checks, current.checks);
  const previousRank = STATUS_RANK[previous.status] ?? 0;
  const currentRank = STATUS_RANK[current.status] ?? 0;
  const statusImproved = currentRank > previousRank;
  const statusRegressed = currentRank < previousRank;
  const improvedMetricCount = metrics.filter((item) => item.direction === "improved").length;
  const regressedMetricCount = metrics.filter((item) => item.direction === "regressed").length;

  let outcome = "stable";
  if (current.ready && !previous.ready) outcome = "ready";
  else if (statusImproved || scoreDelta > 0 || checks.resolved.length > checks.regressed.length || improvedMetricCount > regressedMetricCount) outcome = "improved";
  else if (statusRegressed || scoreDelta < 0 || checks.regressed.length > checks.resolved.length || regressedMetricCount > improvedMetricCount) outcome = "regressed";

  const summary = outcome === "ready"
    ? `Clip quay lại đã vượt preflight: ${scoreBefore}% → ${scoreAfter}%.`
    : outcome === "improved"
      ? `Clip quay lại đã cải thiện: ${scoreBefore}% → ${scoreAfter}%.`
      : outcome === "regressed"
        ? `Clip quay lại đang kém hơn: ${scoreBefore}% → ${scoreAfter}%.`
        : `Clip quay lại gần như không đổi: ${scoreBefore}% → ${scoreAfter}%.`;

  return {
    outcome,
    readyNow: Boolean(current.ready),
    scoreBefore,
    scoreAfter,
    scoreDelta,
    metrics,
    resolvedChecks: checks.resolved,
    regressedChecks: checks.regressed,
    remainingChecks: checks.remaining,
    summary,
    metricSummary: metrics.map((item) => ({
      ...item,
      beforePercent: percentPoint(item.before),
      afterPercent: percentPoint(item.after),
      deltaPercentPoints: percentPoint(item.delta),
    })),
  };
}
