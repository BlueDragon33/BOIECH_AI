import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildEvidenceTrace,
  cameraProfileLabel,
  EVIDENCE_KIND,
  evidenceTraceSignature,
  parseEvidenceTime,
} from "../app/phan-tich-video/evidence-trace-core.mjs";

test("camera trace names the three shared camera profiles without inventing a view", () => {
  assert.equal(cameraProfileLabel("side"), "Ngang thân");
  assert.equal(cameraProfileLabel("rear"), "Từ sau");
  assert.equal(cameraProfileLabel("front-oblique"), "Trước / chéo");
  assert.equal(cameraProfileLabel(""), "Chưa chọn góc quay");
});

test("parses both clock labels and local second markers", () => {
  assert.equal(parseEvidenceTime("00:12.4 · quan sát"), 12.4);
  assert.equal(parseEvidenceTime("Xem mốc bất đối xứng lớn nhất · 3.6s"), 3.6);
  assert.equal(parseEvidenceTime(""), null);
});

test("v1 trace exposes observation, reference, confidence and capture gate", () => {
  const trace = buildEvidenceTrace({
    kind: EVIDENCE_KIND.V1_ERROR,
    trustLevel: "high",
    cameraProfile: "rear",
    timeSec: 4.2,
    confidence: 88,
    observed: "gối lệch 21°",
    expected: "≤ 14°",
    captureQuality: "good",
  });
  assert.equal(trace.timeSec, 4.2);
  assert.ok(trace.facts.some((item) => item.value === "Từ sau"));
  assert.ok(trace.facts.some((item) => item.value === "gối lệch 21°"));
  assert.ok(trace.facts.some((item) => item.value === "88%"));
  assert.ok(trace.gates.some((item) => item.name === "Capture Quality" && item.label === "Đạt"));
  assert.ok(trace.gates.some((item) => item.name === "Unified Trust" && item.label === "Đạt mạnh"));
});

test("cycle trace keeps numeric evidence while reference trust blocks strong interpretation", () => {
  const trace = buildEvidenceTrace({
    kind: EVIDENCE_KIND.CYCLE,
    trustLevel: "reference",
    cameraProfile: "side",
    timeSec: 2.2,
    range: "2.2–4.8s",
    cycleIndex: 2,
    qualityScore: 61,
    visibility: 79,
    recognized: 84,
    overlap: 20,
    weakestPhase: "Thu chân · 54%",
    viewQuality: "review",
  });
  assert.ok(trace.facts.some((item) => item.label === "Quality signal" && item.value === "61%"));
  assert.ok(trace.facts.some((item) => item.label === "Pha cần xem" && item.value.includes("Thu chân")));
  assert.ok(trace.gates.some((item) => item.name === "View Quality" && item.label === "Cần kiểm tra"));
  assert.match(trace.conclusion, /chỉ dùng để khoanh vùng/i);
});

test("bilateral trace ties asymmetry metrics to its worst local timestamp", () => {
  const trace = buildEvidenceTrace({
    kind: EVIDENCE_KIND.BILATERAL,
    trustLevel: "caution",
    cameraProfile: "rear",
    timeSec: 6.4,
    cycleIndex: 3,
    evidenceConfidence: 86,
    bilateralVisibility: 91,
    armDelta: "8° / 17°",
    kneeDelta: "12° / 25°",
    kickTiming: "0.2s",
    viewQuality: "strong",
  });
  assert.equal(trace.timeSec, 6.4);
  assert.ok(trace.facts.some((item) => item.value === "86%"));
  assert.ok(trace.facts.some((item) => item.value === "12° / 25°"));
  assert.ok(trace.gates.some((item) => item.name === "View Quality" && item.label === "Đạt mạnh"));
});

test("advisor trace shows coverage and both calibration and view gates", () => {
  const trace = buildEvidenceTrace({
    kind: EVIDENCE_KIND.ADVISOR,
    trustLevel: "caution",
    cameraProfile: "front-oblique",
    coverageScore: 83,
    coverageReady: false,
    advisorStatus: "Coverage chưa đạt",
    viewQuality: "review",
  });
  assert.ok(trace.facts.some((item) => item.label === "Calibration coverage" && item.value === "83%"));
  assert.ok(trace.gates.some((item) => item.name === "Calibration Coverage" && item.label === "Cần kiểm tra"));
  assert.ok(trace.gates.some((item) => item.name === "Unified Trust" && item.label === "Cần kiểm tra"));
});

test("trace signatures change when evidence or gate state changes", () => {
  const first = buildEvidenceTrace({ kind: EVIDENCE_KIND.CYCLE, trustLevel: "high", qualityScore: 80 });
  const second = buildEvidenceTrace({ kind: EVIDENCE_KIND.CYCLE, trustLevel: "reference", qualityScore: 80 });
  assert.notEqual(evidenceTraceSignature(first), evidenceTraceSignature(second));
});

test("evidence trace core remains local-only and non-scoring", () => {
  const source = fs.readFileSync(new URL("../app/phan-tich-video/evidence-trace-core.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|\/api\//i);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(source, /PHASE_THRESHOLDS|serverPayload|scoreCategories|qualityScore\s*=/);
});
