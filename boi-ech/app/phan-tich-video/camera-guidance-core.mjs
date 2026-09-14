const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const avg = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const CAMERA_GUIDANCE_RULES = Object.freeze({
  minimumSamples: 6,
  rear: Object.freeze({ detectionRate: 0.75, visibility: 0.65, bodyCoverage: 0.7, edgeSafety: 0.7, stability: 0.65, bilateralVisibility: 0.62 }),
  side: Object.freeze({ detectionRate: 0.7, visibility: 0.6, bodyCoverage: 0.65, edgeSafety: 0.65, stability: 0.6, primarySideVisibility: 0.6 }),
  "front-oblique": Object.freeze({ detectionRate: 0.72, visibility: 0.62, bodyCoverage: 0.68, edgeSafety: 0.68, stability: 0.62, bilateralVisibility: 0.54 }),
});

function stabilityFrom(samples) {
  const spans = samples.filter((sample) => sample.detected && Number.isFinite(sample.bodySpan)).map((sample) => sample.bodySpan);
  if (spans.length < 2) return spans.length ? 0.7 : 0;
  const deltas = spans.slice(1).map((value, index) => Math.abs(value - spans[index]));
  return clamp01(1 - avg(deltas) / 0.24);
}

function issueList(metrics, view, checks) {
  const issues = [];
  if (!checks.poseContinuity) issues.push("Pose bị đứt quãng; giữ người bơi trong khung và tránh rung camera.");
  if (!checks.visibility) issues.push("Điểm khớp chưa đủ rõ; tăng ánh sáng và giảm phản chiếu/che khuất.");
  if (!checks.bodyCoverage) issues.push("Cơ thể quá nhỏ hoặc thiếu tay/chân ở nhiều mốc; đặt camera gần hơn nhưng vẫn giữ toàn thân trong khung.");
  if (!checks.edgeSafety) issues.push("Tay/chân chạm sát mép ở nhiều mốc; lùi camera hoặc căn người bơi vào giữa khung.");
  if (!checks.stability) issues.push("Kích thước pose thay đổi mạnh; cố định camera và hạn chế zoom/rung trong đoạn quay.");
  if (view === "rear" && !checks.viewEvidence) issues.push("Góc từ sau cần thấy rõ đồng thời hai bên tay/chân; tránh để một bên bị che kéo dài.");
  if (view === "side" && !checks.viewEvidence) issues.push("Góc ngang cần ít nhất một bên cơ thể hiện rõ liên tục để đọc nhịp tay–thân–chân.");
  if (view === "front-oblique" && !checks.viewEvidence) issues.push("Góc trước/chéo cần đủ bằng chứng hai bên; giảm góc xiên hoặc che khuất nếu có thể.");
  if (!issues.length) issues.push("Khung quay đủ ổn định cho bước phân tích tiếp theo.");
  return issues;
}

export function assessCameraGuidance(samples = [], view = "") {
  const total = samples.length;
  const detected = samples.filter((sample) => sample.detected);
  const detectionRate = total ? detected.length / total : 0;
  const visibility = avg(detected.map((sample) => clamp01(sample.visibility)));
  const bodyCoverage = detected.length ? detected.filter((sample) => sample.bodySpan >= 0.28).length / detected.length : 0;
  const edgeSafety = detected.length ? detected.filter((sample) => sample.edgeSafe).length / detected.length : 0;
  const leftVisibility = avg(detected.map((sample) => clamp01(sample.leftVisibility)));
  const rightVisibility = avg(detected.map((sample) => clamp01(sample.rightVisibility)));
  const bilateralVisibility = Math.min(leftVisibility, rightVisibility);
  const primarySideVisibility = Math.max(leftVisibility, rightVisibility);
  const stability = stabilityFrom(samples);
  const rules = CAMERA_GUIDANCE_RULES[view] ?? null;

  if (!rules || total < CAMERA_GUIDANCE_RULES.minimumSamples) {
    return {
      ready: false,
      status: "retry",
      score: 0,
      metrics: { detectionRate, visibility, bodyCoverage, edgeSafety, stability, leftVisibility, rightVisibility, bilateralVisibility, primarySideVisibility },
      checks: { enoughSamples: total >= CAMERA_GUIDANCE_RULES.minimumSamples, poseContinuity: false, visibility: false, bodyCoverage: false, edgeSafety: false, stability: false, viewEvidence: false },
      issues: [!rules ? "Chưa chọn góc quay để kiểm tra khung hình." : "Chưa có đủ mốc video để đánh giá khung quay."],
    };
  }

  const viewEvidence = view === "side"
    ? primarySideVisibility >= rules.primarySideVisibility
    : bilateralVisibility >= rules.bilateralVisibility;
  const checks = {
    enoughSamples: true,
    poseContinuity: detectionRate >= rules.detectionRate,
    visibility: visibility >= rules.visibility,
    bodyCoverage: bodyCoverage >= rules.bodyCoverage,
    edgeSafety: edgeSafety >= rules.edgeSafety,
    stability: stability >= rules.stability,
    viewEvidence,
  };
  const checkValues = [checks.poseContinuity, checks.visibility, checks.bodyCoverage, checks.edgeSafety, checks.stability, checks.viewEvidence];
  const score = Math.round(checkValues.filter(Boolean).length / checkValues.length * 100);
  const hardRetry = detectionRate < 0.52 || visibility < 0.48 || bodyCoverage < 0.45 || edgeSafety < 0.45 || stability < 0.45 || (view === "rear" && bilateralVisibility < 0.45) || (view === "side" && primarySideVisibility < 0.45);
  const ready = checkValues.every(Boolean);
  const status = ready ? "good" : hardRetry ? "retry" : "review";

  return {
    ready,
    status,
    score,
    metrics: { detectionRate, visibility, bodyCoverage, edgeSafety, stability, leftVisibility, rightVisibility, bilateralVisibility, primarySideVisibility },
    checks,
    issues: issueList({ detectionRate, visibility, bodyCoverage, edgeSafety, stability }, view, checks),
  };
}
