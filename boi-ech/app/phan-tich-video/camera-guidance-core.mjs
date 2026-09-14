const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const avg = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const finiteTime = (value) => Number.isFinite(value) && value >= 0 ? value : 0;

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

function issueList(view, checks) {
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

function edgeGuidance(sample) {
  if (Number.isFinite(sample.minX) && sample.minX < 0.02) return "Người bơi sát mép trái; căn camera sang trái để chừa thêm khoảng trống phía trái.";
  if (Number.isFinite(sample.maxX) && sample.maxX > 0.98) return "Người bơi sát mép phải; căn camera sang phải để chừa thêm khoảng trống phía phải.";
  if (Number.isFinite(sample.minY) && sample.minY < 0.02) return "Tay/đầu sát mép trên; nâng hướng camera hoặc lùi nhẹ để chừa khoảng trống phía trên.";
  if (Number.isFinite(sample.maxY) && sample.maxY > 0.98) return "Chân sát mép dưới; hạ hướng camera hoặc lùi nhẹ để giữ trọn chân trong khung.";
  return "Cơ thể chạm sát mép; lùi camera nhẹ và đặt người bơi gần giữa khung hơn.";
}

function viewEvidenceGuidance(sample, view) {
  const left = clamp01(sample.leftVisibility);
  const right = clamp01(sample.rightVisibility);
  if (view === "rear") {
    const weakSide = left <= right ? "trái" : "phải";
    return `Góc từ sau đang mất rõ bên ${weakSide}; đổi vị trí máy hoặc đường bơi để hai tay/chân không che nhau.`;
  }
  if (view === "side") return "Góc ngang chưa giữ được một bên cơ thể rõ liên tục; đặt máy vuông hơn với thành bể và tránh vật che người bơi.";
  return "Góc trước/chéo bị che hoặc xiên nhiều; giảm góc xiên để hai bên cơ thể dễ nhìn hơn.";
}

function sampleCandidates(samples, view, rules) {
  const candidates = [];
  samples.forEach((sample, index) => {
    const time = finiteTime(sample.time);
    if (!sample.detected) {
      candidates.push({ time, severity: 100, code: "POSE_MISSING", label: "Mất pose", guidance: "AI mất dấu người bơi tại mốc này; giữ toàn thân trong khung, giảm rung và tránh người/vật che ngang." });
      return;
    }
    const visibility = clamp01(sample.visibility);
    if (visibility < rules.visibility) {
      candidates.push({ time, severity: 70 + Math.round((rules.visibility - visibility) * 50), code: "LOW_VISIBILITY", label: "Pose chưa rõ", guidance: "Tăng ánh sáng, giảm phản chiếu mặt nước và tránh để tay/chân bị che ở mốc này." });
    }
    if (Number.isFinite(sample.bodySpan) && sample.bodySpan < 0.28) {
      candidates.push({ time, severity: 66 + Math.round((0.28 - sample.bodySpan) * 100), code: "BODY_TOO_SMALL", label: "Người bơi quá nhỏ", guidance: "Đưa camera gần hơn hoặc dùng tiêu cự dài hơn một chút, nhưng vẫn phải giữ trọn tay và chân trong khung." });
    }
    if (!sample.edgeSafe) {
      candidates.push({ time, severity: 74, code: "EDGE_CLIP", label: "Sát mép khung", guidance: edgeGuidance(sample) });
    }
    const viewValue = view === "side"
      ? Math.max(clamp01(sample.leftVisibility), clamp01(sample.rightVisibility))
      : Math.min(clamp01(sample.leftVisibility), clamp01(sample.rightVisibility));
    const viewLimit = view === "side" ? rules.primarySideVisibility : rules.bilateralVisibility;
    if (viewValue < viewLimit) {
      candidates.push({ time, severity: 72 + Math.round((viewLimit - viewValue) * 40), code: "VIEW_OCCLUSION", label: "Che khuất theo góc quay", guidance: viewEvidenceGuidance(sample, view) });
    }
    if (index > 0 && sample.detected && samples[index - 1]?.detected) {
      const previousSpan = samples[index - 1].bodySpan;
      if (Number.isFinite(previousSpan) && Number.isFinite(sample.bodySpan)) {
        const jump = Math.abs(sample.bodySpan - previousSpan);
        if (jump > 0.18) {
          candidates.push({ time, severity: 68 + Math.min(25, Math.round(jump * 60)), code: "CAMERA_INSTABILITY", label: "Khung thay đổi đột ngột", guidance: "Kích thước người bơi đổi mạnh giữa hai mốc; cố định điện thoại/camera, tắt zoom tay và tránh lia máy theo người bơi." });
        }
      }
    }
  });
  return candidates;
}

function retakeMoments(samples, view, rules) {
  const ranked = sampleCandidates(samples, view, rules).sort((a, b) => b.severity - a.severity || a.time - b.time);
  const selected = [];
  const seenCodes = new Set();
  for (const candidate of ranked) {
    if (seenCodes.has(candidate.code)) continue;
    selected.push(candidate);
    seenCodes.add(candidate.code);
    if (selected.length === 3) break;
  }
  return selected.sort((a, b) => a.time - b.time);
}

function retakeSummary(moments, status) {
  if (status === "good") return "Không cần quay lại theo preflight hiện tại.";
  if (!moments.length) return "Nên quay lại clip sau khi chỉnh khung và ánh sáng theo các cảnh báo phía trên.";
  const first = moments[0];
  return `Ưu tiên sửa từ mốc ${first.time.toFixed(1)}s: ${first.label.toLowerCase()}.`;
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
      retakeMoments: [],
      retakeSummary: !rules ? "Chọn góc quay trước khi tạo hướng dẫn quay lại." : "Cần thêm mốc video trước khi tạo hướng dẫn quay lại.",
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
  const moments = status === "good" ? [] : retakeMoments(samples, view, rules);

  return {
    ready,
    status,
    score,
    metrics: { detectionRate, visibility, bodyCoverage, edgeSafety, stability, leftVisibility, rightVisibility, bilateralVisibility, primarySideVisibility },
    checks,
    issues: issueList(view, checks),
    retakeMoments: moments,
    retakeSummary: retakeSummary(moments, status),
  };
}
