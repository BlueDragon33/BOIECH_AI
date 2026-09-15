import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { assessCameraGuidance, CAMERA_GUIDANCE_RULES } from "../app/phan-tich-video/camera-guidance-core.mjs";

function sample(overrides = {}) {
  return {
    time: 1,
    detected: true,
    visibility: 0.88,
    leftVisibility: 0.86,
    rightVisibility: 0.85,
    bodySpan: 0.55,
    edgeSafe: true,
    minX: 0.2,
    maxX: 0.8,
    minY: 0.12,
    maxY: 0.88,
    ...overrides,
  };
}

test("rear guidance passes only with stable bilateral evidence", () => {
  const report = assessCameraGuidance(Array.from({ length: 10 }, (_, index) => sample({ time: index, bodySpan: 0.5 + index * 0.002 })), "rear");
  assert.equal(report.ready, true);
  assert.equal(report.status, "good");
  assert.equal(report.checks.viewEvidence, true);
  assert.equal(report.score, 100);
  assert.deepEqual(report.retakeMoments, []);
});

test("rear guidance rejects a persistently obscured side before full analysis", () => {
  const report = assessCameraGuidance(Array.from({ length: 10 }, (_, index) => sample({ time: index * 0.5, leftVisibility: 0.35, rightVisibility: 0.88 })), "rear");
  assert.equal(report.ready, false);
  assert.equal(report.status, "retry");
  assert.equal(report.checks.viewEvidence, false);
  assert.match(report.issues.join(" "), /hai bên|che/i);
  assert.ok(report.retakeMoments.some((moment) => moment.code === "VIEW_OCCLUSION"));
  assert.match(report.retakeMoments.find((moment) => moment.code === "VIEW_OCCLUSION")?.guidance ?? "", /bên trái|che/i);
});

test("side guidance tolerates a weaker far side when one side stays clear", () => {
  const report = assessCameraGuidance(Array.from({ length: 10 }, (_, index) => sample({ time: index, leftVisibility: 0.42, rightVisibility: 0.84 })), "side");
  assert.equal(report.checks.viewEvidence, true);
  assert.notEqual(report.status, "retry");
});

test("small or edge-clipped body is surfaced before analysis", () => {
  const report = assessCameraGuidance(Array.from({ length: 10 }, (_, index) => sample({ time: index, bodySpan: 0.2, edgeSafe: false, minX: 0.005 })), "side");
  assert.equal(report.ready, false);
  assert.equal(report.checks.bodyCoverage, false);
  assert.equal(report.checks.edgeSafety, false);
  assert.match(report.issues.join(" "), /quá nhỏ|mép/i);
  const edgeMoment = report.retakeMoments.find((moment) => moment.code === "EDGE_CLIP");
  assert.ok(edgeMoment);
  assert.match(edgeMoment.guidance, /mép trái|sang trái/i);
});

test("pose instability is detected independently of average visibility", () => {
  const spans = [0.32, 0.7, 0.3, 0.72, 0.31, 0.69, 0.29, 0.71];
  const report = assessCameraGuidance(spans.map((bodySpan, index) => sample({ time: index * 0.8, bodySpan })), "rear");
  assert.equal(report.checks.visibility, true);
  assert.equal(report.checks.stability, false);
  assert.match(report.issues.join(" "), /rung|zoom|ổn định/i);
  assert.ok(report.retakeMoments.some((moment) => moment.code === "CAMERA_INSTABILITY"));
});

test("guided retake keeps the exact worst timestamp and gives a concrete recovery action", () => {
  const samples = Array.from({ length: 8 }, (_, index) => sample({ time: index * 1.25, bodySpan: 0.26 }));
  samples[4] = sample({ time: 5, detected: false, visibility: 0, leftVisibility: 0, rightVisibility: 0, bodySpan: 0, edgeSafe: false });
  const report = assessCameraGuidance(samples, "rear");
  assert.notEqual(report.status, "good");
  const missing = report.retakeMoments.find((moment) => moment.code === "POSE_MISSING");
  assert.ok(missing);
  assert.equal(missing.time, 5);
  assert.match(missing.guidance, /toàn thân|giảm rung|che/i);
  assert.match(report.retakeSummary, /Ưu tiên sửa/);
});

test("guided retake returns at most three distinct problem types", () => {
  const samples = Array.from({ length: 8 }, (_, index) => sample({
    time: index,
    visibility: 0.35,
    leftVisibility: 0.3,
    rightVisibility: 0.32,
    bodySpan: 0.18,
    edgeSafe: false,
    minX: 0.005,
  }));
  const report = assessCameraGuidance(samples, "rear");
  assert.ok(report.retakeMoments.length <= 3);
  assert.equal(new Set(report.retakeMoments.map((moment) => moment.code)).size, report.retakeMoments.length);
});

test("guidance refuses to claim readiness without a declared view", () => {
  const report = assessCameraGuidance(Array.from({ length: CAMERA_GUIDANCE_RULES.minimumSamples }, () => sample()), "");
  assert.equal(report.ready, false);
  assert.equal(report.status, "retry");
  assert.deepEqual(report.retakeMoments, []);
});

test("camera guidance core stays local-only and non-scoring", () => {
  const source = fs.readFileSync(new URL("../app/phan-tich-video/camera-guidance-core.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|localStorage|sessionStorage|indexedDB|\/api\//i);
  assert.doesNotMatch(source, /PHASE_THRESHOLDS|qualityScore|serverPayload/);
});
