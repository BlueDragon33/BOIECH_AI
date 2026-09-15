const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const avg = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const VIEW_QUALITY_RULES = Object.freeze({
  side: Object.freeze({
    minimumFrames: 10,
    minimumPoseCoverage: 0.72,
    minimumVisibility: 0.60,
    minimumBodyCoverage: 0.64,
    minimumStability: 0.72,
    minimumBilateralVisibility: 0,
  }),
  rear: Object.freeze({
    minimumFrames: 10,
    minimumPoseCoverage: 0.72,
    minimumVisibility: 0.64,
    minimumBodyCoverage: 0.62,
    minimumStability: 0.74,
    minimumBilateralVisibility: 0.62,
  }),
  "front-oblique": Object.freeze({
    minimumFrames: 10,
    minimumPoseCoverage: 0.68,
    minimumVisibility: 0.61,
    minimumBodyCoverage: 0.56,
    minimumStability: 0.72,
    minimumBilateralVisibility: 0.56,
  }),
});

function sortedFrames(frames) {
  return [...(frames ?? [])]
    .filter((frame) => Number.isFinite(frame?.time) && Number.isFinite(frame?.visibility))
    .sort((a, b) => a.time - b.time);
}

function bilateralVisibility(frame) {
  const left = Number.isFinite(frame.leftVisibility) ? frame.leftVisibility : frame.visibility;
  const right = Number.isFinite(frame.rightVisibility) ? frame.rightVisibility : frame.visibility;
  return clamp01(Math.min(left, right));
}

function sideBodyVisibility(frame) {
  const left = Number.isFinite(frame.leftVisibility) ? frame.leftVisibility : frame.visibility;
  const right = Number.isFinite(frame.rightVisibility) ? frame.rightVisibility : frame.visibility;
  return clamp01(Math.max(left, right));
}

function continuityScore(frames, sampleFps) {
  if (frames.length < 2) return 0;
  const expectedStep = 1 / sampleFps;
  const deltas = [];
  for (let index = 1; index < frames.length; index += 1) deltas.push(Math.max(0, frames[index].time - frames[index - 1].time));
  const excess = avg(deltas.map((delta) => Math.max(0, delta - expectedStep) / Math.max(expectedStep, 0.001)));
  return clamp01(1 - excess * 0.18);
}

function temporalPoseCoverage(frames, sampleFps) {
  if (!frames.length) return 0;
  if (frames.length === 1) return 0.1;
  const span = Math.max(0, frames.at(-1).time - frames[0].time);
  const expected = Math.max(frames.length, Math.round(span * sampleFps) + 1);
  return clamp01(frames.length / Math.max(1, expected));
}

function visibilityStability(frames) {
  if (frames.length < 2) return 0;
  const deltas = [];
  for (let index = 1; index < frames.length; index += 1) deltas.push(Math.abs(frames[index].visibility - frames[index - 1].visibility));
  return clamp01(1 - avg(deltas) * 1.5);
}

export function assessViewQuality(frames, view, options = {}) {
  const prepared = sortedFrames(frames);
  const rule = VIEW_QUALITY_RULES[view] ?? null;
  const sampleFps = Number.isFinite(options.sampleFps) && options.sampleFps > 0 ? options.sampleFps : 5;
  const selectedView = Boolean(rule);
  const poseCoverage = temporalPoseCoverage(prepared, sampleFps);
  const visibilityAvg = clamp01(avg(prepared.map((frame) => frame.visibility)));
  const bilateralAvg = clamp01(avg(prepared.map(bilateralVisibility)));
  const bodyCoverage = clamp01(avg(prepared.map((frame) => view === "side" ? sideBodyVisibility(frame) : bilateralVisibility(frame))));
  const continuity = continuityScore(prepared, sampleFps);
  const stability = clamp01(visibilityStability(prepared) * 0.65 + continuity * 0.35);

  if (!selectedView) {
    return {
      ready: false,
      status: "unselected",
      allowStrongConclusions: false,
      allowCalibrationReview: false,
      qualityScore: 0,
      frameCount: prepared.length,
      poseCoverage,
      visibilityAvg,
      bilateralVisibility: bilateralAvg,
      bodyCoverage,
      stability,
      checks: { viewSelected: false },
      issues: ["Chưa chọn góc quay chung nên chưa thể xác nhận chất lượng bằng chứng theo góc."],
      note: "View Quality Gate đang chờ camera profile.",
    };
  }

  const checks = {
    viewSelected: true,
    enoughFrames: prepared.length >= rule.minimumFrames,
    poseCoverage: poseCoverage >= rule.minimumPoseCoverage,
    visibility: visibilityAvg >= rule.minimumVisibility,
    bodyCoverage: bodyCoverage >= rule.minimumBodyCoverage,
    stability: stability >= rule.minimumStability,
    bilateralVisibility: rule.minimumBilateralVisibility <= 0 || bilateralAvg >= rule.minimumBilateralVisibility,
  };

  const allowStrongConclusions = Object.values(checks).every(Boolean);
  const severeFailure = prepared.length < Math.ceil(rule.minimumFrames * 0.6)
    || poseCoverage < 0.5
    || visibilityAvg < Math.max(0.42, rule.minimumVisibility - 0.14)
    || bodyCoverage < Math.max(0.4, rule.minimumBodyCoverage - 0.16)
    || stability < 0.5;
  const qualityScore = Math.round(clamp01(
    poseCoverage * 0.28
    + visibilityAvg * 0.25
    + bodyCoverage * 0.27
    + stability * 0.20,
  ) * 100);

  const issues = [];
  if (!checks.enoughFrames) issues.push(`Chỉ có ${prepared.length} frame pose hợp lệ; cần ít nhất ${rule.minimumFrames} frame để đánh giá góc ổn định.`);
  if (!checks.poseCoverage) issues.push("Pose bị đứt quãng nhiều trong phần video đã nhận dạng; cần quay liên tục và giữ người bơi trong vùng nhìn của camera.");
  if (!checks.visibility) issues.push("Visibility tổng thể còn thấp; cơ thể có thể bị nước, người khác hoặc góc máy che khuất.");
  if (!checks.bodyCoverage) issues.push(view === "side" ? "Độ phủ cơ thể theo góc ngang chưa đủ ổn định; cần thấy rõ chuỗi vai–tay và hông–gối–cổ chân." : "Độ phủ hai bên cơ thể chưa đủ; cần giữ cả hai bên vai–tay và hông–gối–cổ chân rõ trong khung.");
  if (!checks.stability) issues.push("Pose/visibility dao động mạnh hoặc có khoảng mất dấu; chưa nên dùng clip này cho kết luận mạnh.");
  if (!checks.bilateralVisibility) issues.push("Một bên cơ thể bị che/mờ quá nhiều so với yêu cầu của góc quay này.");

  const status = allowStrongConclusions ? "strong" : severeFailure ? "poor" : "review";
  return {
    ready: true,
    status,
    allowStrongConclusions,
    allowCalibrationReview: allowStrongConclusions,
    qualityScore,
    frameCount: prepared.length,
    poseCoverage,
    visibilityAvg,
    bilateralVisibility: bilateralAvg,
    bodyCoverage,
    stability,
    checks,
    issues,
    note: allowStrongConclusions
      ? "Tín hiệu pose đủ ổn định cho các diễn giải mạnh trong phạm vi góc quay đã khai báo."
      : status === "review"
        ? "Có thể xem số đo chẩn đoán, nhưng View Quality Gate đang khóa kết luận mạnh và hiệu chỉnh ngưỡng."
        : "Chất lượng bằng chứng chưa đủ; nên quay lại clip rõ và ổn định hơn trước khi diễn giải kỹ thuật.",
  };
}
