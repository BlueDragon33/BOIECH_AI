import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const panel = fs.readFileSync(new URL("../app/phan-tich-video/unified-trust-panel.tsx", import.meta.url), "utf8");
const core = fs.readFileSync(new URL("../app/phan-tich-video/unified-trust-core.mjs", import.meta.url), "utf8");
const analyzer = fs.readFileSync(new URL("../app/phan-tich-video/video-analyzer.tsx", import.meta.url), "utf8");

test("unified trust is wired once at the analysis root", () => {
  assert.match(analyzer, /UnifiedTrustPanel/);
  assert.match(analyzer, /<PreflightEnforcementPanel\s*\/>[\s\S]*<UnifiedTrustPanel\s*\/>[\s\S]*<PhaseCycleAnalyzer\s*\/>/);
});

test("the same trust badge is propagated across main analysis surfaces", () => {
  assert.match(panel, /data-camera-guidance-local-only/);
  assert.match(panel, /styles\.report/);
  assert.match(panel, /data-cycle-quality-local-only/);
  assert.match(panel, /data-bilateral-symmetry-local-only/);
  assert.match(panel, /data-threshold-advisor-local-only/);
  assert.match(panel, /data-unified-trust-badge/);
  assert.match(panel, /Mức tin cậy chung/);
});

test("trust combines existing gates conservatively instead of averaging them", () => {
  assert.match(core, /overrideActive/);
  assert.match(core, /preflight === "retry"/);
  assert.match(core, /captureQuality === "retry"/);
  assert.match(core, /viewQuality === "poor" \|\| viewQuality === "unselected"/);
  assert.match(core, /if \(blockers\.length\) level = TRUST_LEVEL\.REFERENCE/);
  assert.match(core, /else if \(warnings\.length\) level = TRUST_LEVEL\.CAUTION/);
  assert.doesNotMatch(core, /average|weighted|mean|qualityScore/);
});

test("unified trust remains local, interpretive and non-scoring", () => {
  const combined = `${panel}\n${core}`;
  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB|\/api\//i);
  assert.doesNotMatch(combined, /fetch\s*\(/);
  assert.doesNotMatch(combined, /PHASE_THRESHOLDS|serverPayload|scoreCategories/);
  assert.match(core, /không phải xác nhận sinh cơ học đã hiệu chuẩn/);
});
