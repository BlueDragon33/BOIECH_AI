import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = fs.readFileSync(new URL("../app/phan-tich-video/video-analyzer.tsx", import.meta.url), "utf8");
const panel = fs.readFileSync(new URL("../app/phan-tich-video/cross-module-consistency-panel.tsx", import.meta.url), "utf8");
const core = fs.readFileSync(new URL("../app/phan-tich-video/cross-module-consistency-core.mjs", import.meta.url), "utf8");

test("cross-module consistency is wired after evidence trace without replacing trust", () => {
  assert.match(root, /<EvidenceTracePanel\s*\/>[\s\S]*<CrossModuleConsistencyPanel\s*\/>/);
  assert.match(panel, /data-cross-module-consistency="local-only"/);
  assert.match(panel, /Unified Trust hiện tại/);
  assert.doesNotMatch(panel, /dataset\.unifiedTrustLevel\s*=/);
});

test("consistency compares only matching detector domains", () => {
  assert.match(panel, /Hai tay thu\/duỗi thiếu đối xứng/);
  assert.match(panel, /Hai chân gập không đồng đều/);
  assert.match(panel, /Tay và chân có dấu hiệu chồng pha/);
  assert.match(panel, /CONSISTENCY_DOMAIN\.ARM_SYMMETRY/);
  assert.match(panel, /CONSISTENCY_DOMAIN\.LEG_SYMMETRY/);
  assert.match(panel, /CONSISTENCY_DOMAIN\.COORDINATION/);
});

test("body tilt and wide-knee findings are explicitly left unpaired", () => {
  assert.match(panel, /Hai gối mở rộng kéo dài khi thu chân/);
  assert.match(panel, /Trục vai–hông thay đổi lớn/);
  assert.match(panel, /chưa có detector độc lập tương đương/i);
});

test("bilateral evidence must pass view quality and evidence confidence before contradicting v1", () => {
  assert.match(panel, /viewStrong/);
  assert.match(panel, /item\.evidence >= 70/);
  assert.match(panel, /armAvg >= 10 \|\| armPeak >= 20/);
  assert.match(panel, /kneeAvg >= 10 \|\| kneePeak >= 20 \|\| timing >= 0\.2 \|\| strength >= 8/);
});

test("phase coordination uses usable complete-cycle evidence rather than raw text votes", () => {
  assert.match(panel, /item\.pose \?\? 0\) >= 70/);
  assert.match(panel, /item\.recognized \?\? 0\) >= 85/);
  assert.match(panel, /maxOverlap > 18/);
  assert.match(panel, /Chồng pha/);
});

test("consistency observer ignores its own rendered panel mutations", () => {
  assert.match(panel, /closest\("\[data-cross-module-consistency\]"\)/);
  assert.match(panel, /signatureRef/);
});

test("cross-module consistency remains local-only, non-persistent and non-scoring", () => {
  const combined = `${panel}\n${core}`;
  assert.doesNotMatch(combined, /fetch\s*\(|\/api\//i);
  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(combined, /PHASE_THRESHOLDS|serverPayload|scoreCategories/);
  assert.doesNotMatch(combined, /qualityScore\s*=/);
});
