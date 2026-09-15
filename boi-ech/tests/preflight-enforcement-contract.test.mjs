import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const panel = fs.readFileSync(new URL("../app/phan-tich-video/preflight-enforcement-panel.tsx", import.meta.url), "utf8");
const analyzer = fs.readFileSync(new URL("../app/phan-tich-video/video-analyzer.tsx", import.meta.url), "utf8");

test("preflight enforcement is wired beside camera guidance without changing the scoring engine", () => {
  assert.match(analyzer, /PreflightEnforcementPanel/);
  assert.match(analyzer, /<CameraGuidancePanel\s*\/>[\s\S]*<PreflightEnforcementPanel\s*\/>/);
  assert.doesNotMatch(analyzer, /qualityScore|PHASE_THRESHOLDS|serverPayload/);
});

test("soft lock only reacts to the explicit retry label and intercepts the main analyze action", () => {
  assert.match(panel, /labels\.includes\("Nên quay lại"\)/);
  assert.match(panel, /styles\.analyzeButton/);
  assert.match(panel, /data-preflight-enforcement-local-only/);
  assert.match(panel, /preflightSoftLocked/);
  assert.match(panel, /event\.preventDefault\(\)/);
  assert.match(panel, /event\.stopImmediatePropagation\(\)/);
  assert.match(panel, /Vẫn phân tích thử/);
});

test("override is bound to the current local video source and is cleared on source change", () => {
  assert.match(panel, /video\?\.currentSrc \|\| video\?\.src/);
  assert.match(panel, /overrideSource === source/);
  assert.match(panel, /nextSource !== sourceRef\.current/);
  assert.match(panel, /setOverrideSource\(""\)/);
  assert.match(panel, /Chỉ áp dụng cho đúng video local hiện tại/);
});

test("an overridden retry analysis is visibly marked as low-input-quality", () => {
  assert.match(panel, /data-preflight-input-quality-low/);
  assert.match(panel, /Chất lượng đầu vào thấp/);
  assert.match(panel, /chủ động bỏ qua preflight/);
  assert.match(panel, /styles\.report/);
  assert.match(panel, /insertBefore\(banner, report\.firstChild\)/);
});

test("preflight enforcement remains RAM and DOM only", () => {
  assert.doesNotMatch(panel, /localStorage|sessionStorage|indexedDB|\/api\//i);
  assert.doesNotMatch(panel, /fetch\s*\(/);
  assert.doesNotMatch(panel, /PHASE_THRESHOLDS|qualityScore|serverPayload/);
});
