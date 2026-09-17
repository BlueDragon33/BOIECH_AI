import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { assessViewQuality, VIEW_QUALITY_RULES } from "../app/phan-tich-video/phase-view-quality.mjs";

function frames({ count = 15, visibility = 0.82, left = 0.82, right = 0.82, jitter = 0 } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    time: index * 0.2,
    phase: "glide",
    visibility: Math.max(0, Math.min(1, visibility + (index % 2 ? jitter : -jitter))),
    leftVisibility: left,
    rightVisibility: right,
  }));
}

test("rear view opens strong conclusions only with stable bilateral evidence", () => {
  const report = assessViewQuality(frames(), "rear");
  assert.equal(report.ready, true);
  assert.equal(report.status, "strong");
  assert.equal(report.allowStrongConclusions, true);
  assert.equal(report.allowCalibrationReview, true);
  assert.ok(report.qualityScore >= 70);
  assert.equal(report.issues.length, 0);
});

test("rear view blocks strong conclusions when one side is persistently obscured", () => {
  const report = assessViewQuality(frames({ left: 0.86, right: 0.38 }), "rear");
  assert.equal(report.allowStrongConclusions, false);
  assert.equal(report.allowCalibrationReview, false);
  assert.equal(report.checks.bilateralVisibility, false);
  assert.match(report.issues.join(" "), /Một bên cơ thể bị che\/mờ/);
});

test("side view can remain usable when the far side is less visible", () => {
  const report = assessViewQuality(frames({ visibility: 0.76, left: 0.84, right: 0.36 }), "side");
  assert.equal(VIEW_QUALITY_RULES.side.minimumBilateralVisibility, 0);
  assert.equal(report.checks.bilateralVisibility, true);
  assert.equal(report.allowStrongConclusions, true);
});

test("unstable or discontinuous pose blocks the gate even with a declared view", () => {
  const unstable = frames({ count: 14, visibility: 0.72, left: 0.76, right: 0.76, jitter: 0.28 }).map((frame, index) => ({
    ...frame,
    time: index < 7 ? index * 0.2 : 2.8 + (index - 7) * 0.2,
  }));
  const report = assessViewQuality(unstable, "rear");
  assert.equal(report.allowStrongConclusions, false);
  assert.ok(report.checks.poseCoverage === false || report.checks.stability === false);
});

test("no selected camera profile never produces a strong view-quality conclusion", () => {
  const report = assessViewQuality(frames(), "");
  assert.equal(report.ready, false);
  assert.equal(report.status, "unselected");
  assert.equal(report.allowStrongConclusions, false);
});

test("view quality core remains local-only and non-scoring", () => {
  const source = fs.readFileSync(new URL("../app/phan-tich-video/phase-view-quality.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|localStorage|sessionStorage|indexedDB|\/api\//i);
  assert.doesNotMatch(source, /qualityScore\s*=\s*cycle|serverPayload|PHASE_THRESHOLDS/);
});
