import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { assessCameraGuidance, CAMERA_GUIDANCE_RULES } from "../app/phan-tich-video/camera-guidance-core.mjs";

function sample(overrides = {}) {
  return {
    detected: true,
    visibility: 0.88,
    leftVisibility: 0.86,
    rightVisibility: 0.85,
    bodySpan: 0.55,
    edgeSafe: true,
    ...overrides,
  };
}

test("rear guidance passes only with stable bilateral evidence", () => {
  const report = assessCameraGuidance(Array.from({ length: 10 }, (_, index) => sample({ bodySpan: 0.5 + index * 0.002 })), "rear");
  assert.equal(report.ready, true);
  assert.equal(report.status, "good");
  assert.equal(report.checks.viewEvidence, true);
  assert.equal(report.score, 100);
});

test("rear guidance rejects a persistently obscured side before full analysis", () => {
  const report = assessCameraGuidance(Array.from({ length: 10 }, () => sample({ leftVisibility: 0.35, rightVisibility: 0.88 })), "rear");
  assert.equal(report.ready, false);
  assert.equal(report.status, "retry");
  assert.equal(report.checks.viewEvidence, false);
  assert.match(report.issues.join(" "), /hai bên|che/i);
});

test("side guidance tolerates a weaker far side when one side stays clear", () => {
  const report = assessCameraGuidance(Array.from({ length: 10 }, () => sample({ leftVisibility: 0.42, rightVisibility: 0.84 })), "side");
  assert.equal(report.checks.viewEvidence, true);
  assert.notEqual(report.status, "retry");
});

test("small or edge-clipped body is surfaced before analysis", () => {
  const report = assessCameraGuidance(Array.from({ length: 10 }, () => sample({ bodySpan: 0.2, edgeSafe: false })), "side");
  assert.equal(report.ready, false);
  assert.equal(report.checks.bodyCoverage, false);
  assert.equal(report.checks.edgeSafety, false);
  assert.match(report.issues.join(" "), /quá nhỏ|mép/i);
});

test("pose instability is detected independently of average visibility", () => {
  const spans = [0.32, 0.7, 0.3, 0.72, 0.31, 0.69, 0.29, 0.71];
  const report = assessCameraGuidance(spans.map((bodySpan) => sample({ bodySpan })), "rear");
  assert.equal(report.checks.visibility, true);
  assert.equal(report.checks.stability, false);
  assert.match(report.issues.join(" "), /rung|zoom|ổn định/i);
});

test("guidance refuses to claim readiness without a declared view", () => {
  const report = assessCameraGuidance(Array.from({ length: CAMERA_GUIDANCE_RULES.minimumSamples }, () => sample()), "");
  assert.equal(report.ready, false);
  assert.equal(report.status, "retry");
});

test("camera guidance core stays local-only and non-scoring", () => {
  const source = fs.readFileSync(new URL("../app/phan-tich-video/camera-guidance-core.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|localStorage|sessionStorage|indexedDB|\/api\//i);
  assert.doesNotMatch(source, /PHASE_THRESHOLDS|qualityScore|serverPayload/);
});
