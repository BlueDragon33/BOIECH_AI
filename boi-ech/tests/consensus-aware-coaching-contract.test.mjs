import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = fs.readFileSync(new URL("../app/phan-tich-video/video-analyzer.tsx", import.meta.url), "utf8");
const panel = fs.readFileSync(new URL("../app/phan-tich-video/consensus-aware-coaching-panel.tsx", import.meta.url), "utf8");
const core = fs.readFileSync(new URL("../app/phan-tich-video/consensus-aware-coaching-core.mjs", import.meta.url), "utf8");

test("coaching is wired after cross-module consistency as the final interpretation layer", () => {
  assert.match(root, /<EvidenceTracePanel\s*\/>[\s\S]*<CrossModuleConsistencyPanel\s*\/>[\s\S]*<ConsensusAwareCoachingPanel\s*\/>/);
});

test("coaching consumes consistency status and unified trust instead of re-running detector logic", () => {
  assert.match(panel, /\[data-cross-module-consistency\]/);
  assert.match(panel, /\[data-consistency-domain\]/);
  assert.match(panel, /dataset\.consistencyStatus/);
  assert.match(panel, /dataset\.unifiedTrustLevel/);
  assert.doesNotMatch(panel, /styles\.errorList|data-bilateral-symmetry-local-only|data-cycle-quality-local-only/);
});

test("only corroborated usable evidence is rendered as train-first while conflicts stay verify-first", () => {
  assert.match(core, /status === STATUS\.CORROBORATED/);
  assert.match(core, /COACHING_BUCKET\.PRIORITY/);
  assert.match(core, /status === STATUS\.CONFLICT/);
  assert.match(core, /status === STATUS\.SINGLE_SOURCE/);
  assert.match(core, /COACHING_BUCKET\.VERIFY/);
  assert.match(panel, /Tập trước/);
  assert.match(panel, /Cần kiểm tra lại trước khi dùng làm bài tập chính/);
});

test("reference trust cannot produce a main coaching priority", () => {
  assert.match(core, /trustLevel === COACHING_TRUST\.HIGH \|\| trustLevel === COACHING_TRUST\.CAUTION/);
  assert.match(core, /Unified Trust chỉ ở mức tham khảo\/chưa xác định/);
});

test("coaching marks workflow ordering as non-biomechanical and remains local-only", () => {
  assert.match(panel, /data-consensus-aware-coaching="local-only"/);
  assert.match(panel, /data-consensus-coaching-non-scoring/);
  assert.match(core, /không phải xếp hạng mức độ nghiêm trọng sinh cơ học/);
  const combined = `${panel}\n${core}`;
  assert.doesNotMatch(combined, /fetch\s*\(|\/api\//i);
  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(combined, /PHASE_THRESHOLDS|serverPayload|scoreCategories/);
});
