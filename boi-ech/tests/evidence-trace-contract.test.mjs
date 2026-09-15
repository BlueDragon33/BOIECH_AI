import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = fs.readFileSync(new URL("../app/phan-tich-video/video-analyzer.tsx", import.meta.url), "utf8");
const panel = fs.readFileSync(new URL("../app/phan-tich-video/evidence-trace-panel.tsx", import.meta.url), "utf8");
const core = fs.readFileSync(new URL("../app/phan-tich-video/evidence-trace-core.mjs", import.meta.url), "utf8");

test("evidence traceability is wired after analysis and trust interpretation", () => {
  assert.match(root, /<TrustAwareInterpretationPanel\s*\/>[\s\S]*<PhaseCycleAnalyzer\s*\/>[\s\S]*<EvidenceTracePanel\s*\/>/);
  assert.match(panel, /root\.dataset\.evidenceTraceability = "local-only"/);
});

test("traceability covers v1 errors, cycle quality, bilateral evidence and threshold advisor", () => {
  assert.match(panel, /styles\.errorList/);
  assert.match(panel, /data-cycle-quality-local-only/);
  assert.match(panel, /data-bilateral-symmetry-local-only/);
  assert.match(panel, /data-threshold-advisor-local-only/);
  assert.match(panel, /EVIDENCE_KIND\.V1_ERROR/);
  assert.match(panel, /EVIDENCE_KIND\.CYCLE/);
  assert.match(panel, /EVIDENCE_KIND\.BILATERAL/);
  assert.match(panel, /EVIDENCE_KIND\.ADVISOR/);
});

test("traceability exposes exact local timestamps and can jump back to learner video", () => {
  assert.match(panel, /parseEvidenceTime/);
  assert.match(panel, /Xem bằng chứng tại/);
  assert.match(panel, /video\[playsinline\]/);
  assert.match(panel, /video\.currentTime/);
  assert.match(panel, /video\.pause\(\)/);
});

test("traceability reads unified trust and explicit quality gates without becoming a gate itself", () => {
  assert.match(panel, /dataset\.unifiedTrustLevel/);
  assert.match(panel, /Capture Quality/);
  assert.match(panel, /data-view-quality-gate/);
  assert.doesNotMatch(panel, /dataset\.unifiedTrustLevel\s*=/);
  assert.doesNotMatch(core, /allowStrongConclusions\s*=/);
});

test("trace UI is idempotent and ignores its own DOM mutations", () => {
  assert.match(panel, /evidenceTraceSignature/);
  assert.match(panel, /dataset\.evidenceSignature === signature/);
  assert.match(panel, /closest\("\[data-evidence-trace\]"\)/);
});

test("traceability remains local-only, non-persistent and non-scoring", () => {
  const combined = `${panel}\n${core}`;
  assert.doesNotMatch(combined, /fetch\s*\(|\/api\//i);
  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(combined, /PHASE_THRESHOLDS|serverPayload|scoreCategories/);
});
