import assert from "node:assert/strict";
import test from "node:test";

import { GROUND_TRUTH_PHASES, summarizeGroundTruth } from "../app/phan-tich-video/phase-ground-truth.mjs";

function frame(time, phase, metrics = {}) {
  return {
    time,
    phase,
    armFlexion: metrics.armFlexion ?? 30,
    kneeFlexion: metrics.kneeFlexion ?? 25,
    wristSpread: metrics.wristSpread ?? 1.1,
    ankleSpread: metrics.ankleSpread ?? 1.2,
    visibility: metrics.visibility ?? 0.9,
  };
}

test("ground truth keeps AI prediction separate and measures corrections", () => {
  const frames = [
    frame(0, "pull", { armFlexion: 60 }),
    frame(0.2, "kick", { kneeFlexion: 30 }),
    frame(0.4, "glide", { kneeFlexion: 12 }),
  ];
  const labels = {
    "0.000": "pull",
    "0.200": "leg-recovery",
    "0.400": "glide",
  };
  const summary = summarizeGroundTruth(frames, labels);
  assert.equal(summary.annotated, 3);
  assert.equal(summary.matches, 2);
  assert.equal(summary.corrections, 1);
  assert.equal(summary.accuracy, 2 / 3);
  assert.equal(summary.matrix.kick["leg-recovery"], 1);
  assert.deepEqual(summary.mistakes[0], { aiPhase: "kick", truthPhase: "leg-recovery", count: 1 });
  assert.equal(frames[1].phase, "kick");
});

test("ground truth reports phase recall and observed metric ranges", () => {
  const frames = [
    frame(0, "pull", { armFlexion: 58, wristSpread: 1.3 }),
    frame(0.2, "breath", { armFlexion: 34, wristSpread: 1.0 }),
    frame(0.4, "pull", { armFlexion: 50, wristSpread: 1.15 }),
  ];
  const labels = {
    "0.000": "pull",
    "0.200": "pull",
    "0.400": "pull",
  };
  const summary = summarizeGroundTruth(frames, labels);
  assert.equal(summary.phaseMetrics.pull.annotated, 3);
  assert.equal(summary.phaseMetrics.pull.correct, 2);
  assert.equal(summary.phaseMetrics.pull.recall, 2 / 3);
  assert.equal(summary.phaseMetrics.pull.metrics.armFlexion.min, 34);
  assert.equal(summary.phaseMetrics.pull.metrics.armFlexion.max, 58);
});

test("ground truth ignores missing or unsupported labels", () => {
  const frames = [frame(0, "pull"), frame(0.2, "breath")];
  const summary = summarizeGroundTruth(frames, { "0.000": "unknown" });
  assert.equal(summary.annotated, 0);
  assert.equal(summary.accuracy, 0);
  assert.deepEqual(GROUND_TRUTH_PHASES, ["pull", "breath", "leg-recovery", "kick", "glide"]);
});
