import assert from "node:assert/strict";
import test from "node:test";

import { assessCalibrationCoverage, CALIBRATION_COVERAGE_RULES } from "../app/phan-tich-video/phase-calibration-coverage.mjs";

const PHASES = ["pull", "breath", "leg-recovery", "kick", "glide"];

function key(time) {
  return Number(time).toFixed(3);
}

function balancedSet() {
  const frames = [];
  const labels = {};
  let time = 0;
  for (let round = 0; round < 4; round += 1) {
    for (const phase of PHASES) {
      frames.push({ time, phase, armFlexion: 30, kneeFlexion: 30, wristSpread: 1, ankleSpread: 1, visibility: 0.9 });
      labels[key(time)] = phase;
      time += 0.2;
    }
  }
  return { frames, labels };
}

test("passes a balanced single-clip calibration set with cycles, temporal coverage and view", () => {
  const { frames, labels } = balancedSet();
  const result = assessCalibrationCoverage(frames, labels, { completeCycles: 2, view: "side" });
  assert.equal(result.annotated, 20);
  assert.equal(result.readyForThresholdReview, true);
  assert.equal(result.globalReady, false);
  assert.equal(result.scope, "single-clip");
  assert.equal(result.coveredPhases.length, 5);
  assert.equal(result.viewSelected, true);
  assert.ok(result.temporalCoverage >= CALIBRATION_COVERAGE_RULES.minimumTemporalCoverage);
});

test("rejects phase imbalance even when total annotation count is high", () => {
  const { frames, labels } = balancedSet();
  let time = frames.at(-1).time + 0.2;
  for (let index = 0; index < 18; index += 1) {
    frames.push({ time, phase: "pull", armFlexion: 60, kneeFlexion: 15, wristSpread: 1.4, ankleSpread: 1, visibility: 0.9 });
    labels[key(time)] = "pull";
    time += 0.2;
  }
  const result = assessCalibrationCoverage(frames, labels, { completeCycles: 3, view: "side" });
  assert.equal(result.checks.balancedPhases, false);
  assert.equal(result.readyForThresholdReview, false);
  assert.ok(result.dominantShare > CALIBRATION_COVERAGE_RULES.maximumDominantPhaseShare);
});

test("requires every phase, at least two complete cycles and a declared view", () => {
  const { frames, labels } = balancedSet();
  for (const frame of frames.filter((item) => item.phase === "kick")) delete labels[key(frame.time)];
  const result = assessCalibrationCoverage(frames, labels, { completeCycles: 1, view: "" });
  assert.equal(result.checks.phaseCoverage, false);
  assert.equal(result.checks.enoughCycles, false);
  assert.equal(result.checks.viewSelected, false);
  assert.equal(result.readyForThresholdReview, false);
  assert.ok(result.missingPhases.includes("kick"));
});

test("coverage gate stays local and contains no persistence or server behavior", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../app/phan-tich-video/phase-calibration-coverage.mjs", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /fetch\(|localStorage|indexedDB|\/api\//i);
  assert.match(source, /globalReady: false/);
  assert.match(source, /single-clip/);
});
