import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { compareRetakeGuidance } from "../app/phan-tich-video/camera-retake-comparison.mjs";

function report(overrides = {}) {
  return {
    ready: false,
    status: "review",
    score: 50,
    metrics: {
      detectionRate: 0.68,
      visibility: 0.62,
      bodyCoverage: 0.55,
      edgeSafety: 0.58,
      stability: 0.6,
    },
    checks: {
      poseContinuity: false,
      visibility: true,
      bodyCoverage: false,
      edgeSafety: false,
      stability: true,
      viewEvidence: true,
    },
    ...overrides,
  };
}

test("retake comparison marks a new clip ready and lists resolved checks", () => {
  const previous = report();
  const current = report({
    ready: true,
    status: "good",
    score: 100,
    metrics: { detectionRate: 0.91, visibility: 0.84, bodyCoverage: 0.88, edgeSafety: 0.92, stability: 0.85 },
    checks: { poseContinuity: true, visibility: true, bodyCoverage: true, edgeSafety: true, stability: true, viewEvidence: true },
  });
  const comparison = compareRetakeGuidance(previous, current);
  assert.equal(comparison.outcome, "ready");
  assert.equal(comparison.readyNow, true);
  assert.equal(comparison.scoreDelta, 50);
  assert.deepEqual(comparison.resolvedChecks.map((item) => item.key).sort(), ["bodyCoverage", "edgeSafety", "poseContinuity"]);
  assert.match(comparison.summary, /vượt preflight/i);
});

test("retake comparison surfaces regressions instead of always claiming improvement", () => {
  const previous = report({ score: 83, status: "review", metrics: { detectionRate: 0.88, visibility: 0.8, bodyCoverage: 0.82, edgeSafety: 0.84, stability: 0.81 } });
  const current = report({ score: 50, status: "retry", metrics: { detectionRate: 0.56, visibility: 0.52, bodyCoverage: 0.49, edgeSafety: 0.5, stability: 0.48 } });
  const comparison = compareRetakeGuidance(previous, current);
  assert.equal(comparison.outcome, "regressed");
  assert.ok(comparison.metricSummary.some((item) => item.direction === "regressed"));
  assert.match(comparison.summary, /kém hơn/i);
});

test("small changes remain stable and use percentage-point deltas", () => {
  const previous = report({ score: 67 });
  const current = report({
    score: 67,
    metrics: { detectionRate: 0.7, visibility: 0.64, bodyCoverage: 0.57, edgeSafety: 0.6, stability: 0.62 },
  });
  const comparison = compareRetakeGuidance(previous, current);
  assert.equal(comparison.outcome, "stable");
  assert.equal(comparison.metricSummary.find((item) => item.key === "detectionRate").deltaPercentPoints, 2);
});

test("retake comparison core remains local-only and non-scoring", () => {
  const source = fs.readFileSync(new URL("../app/phan-tich-video/camera-retake-comparison.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|localStorage|sessionStorage|indexedDB|\/api\//i);
  assert.doesNotMatch(source, /PHASE_THRESHOLDS|qualityScore|serverPayload/);
});
