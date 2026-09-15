import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = fs.readFileSync(new URL("../app/phan-tich-video/video-analyzer.tsx", import.meta.url), "utf8");
const unified = fs.readFileSync(new URL("../app/phan-tich-video/unified-trust-panel.tsx", import.meta.url), "utf8");
const panel = fs.readFileSync(new URL("../app/phan-tich-video/trust-aware-interpretation-panel.tsx", import.meta.url), "utf8");
const core = fs.readFileSync(new URL("../app/phan-tich-video/trust-aware-interpretation-core.mjs", import.meta.url), "utf8");

test("trust-aware interpretation is wired after unified trust at the analysis root", () => {
  assert.match(root, /<UnifiedTrustPanel\s*\/>[\s\S]*<TrustAwareInterpretationPanel\s*\/>/);
  assert.match(unified, /root\.dataset\.unifiedTrustLevel = trust\.level/);
  assert.match(panel, /data-unified-trust-level/);
});

test("interpretation gate covers v1, cycle, bilateral and threshold advisor surfaces", () => {
  assert.match(panel, /styles\.report/);
  assert.match(panel, /data-cycle-quality-local-only/);
  assert.match(panel, /data-bilateral-symmetry-local-only/);
  assert.match(panel, /data-threshold-advisor-local-only/);
  assert.match(panel, /data-trust-aware-advisor-guard/);
});

test("reference language removes strong labels instead of changing measurements", () => {
  assert.match(core, /Tín hiệu cần kiểm tra/);
  assert.match(core, /Pha nên xem lại/);
  assert.match(core, /Có tín hiệu lệch cần kiểm tra/);
  assert.match(core, /Chỉ mô phỏng · không đủ trust/);
  assert.match(core, /Chưa đủ trust để xem xét hiệu chỉnh/);
});

test("original wording is reversible when trust improves", () => {
  assert.match(panel, /trustOriginalText/);
  assert.match(panel, /trustAppliedText/);
  assert.match(panel, /restoreInterpretations/);
  assert.match(core, /trust === INTERPRETATION_TRUST\.HIGH\) return original/);
});

test("unified trust reads explicit gate labels to avoid interpretation feedback loops", () => {
  assert.match(unified, /guidance\.querySelectorAll\("b"\)/);
  assert.match(unified, /data-view-quality-gate\] strong/);
  assert.match(unified, /data-view-quality-gate-consumer\] b/);
});

test("trust-aware interpretation remains local-only and non-scoring", () => {
  const combined = `${panel}\n${core}`;
  assert.doesNotMatch(combined, /fetch\s*\(|\/api\//i);
  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(combined, /PHASE_THRESHOLDS|qualityScore|serverPayload|scoreCategories/);
});
