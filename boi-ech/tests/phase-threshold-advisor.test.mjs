import assert from "node:assert/strict";
import test from "node:test";

import { PHASE_THRESHOLDS } from "../app/phan-tich-video/phase-cycle-core.mjs";
import { adviseThresholds, simulateThresholds } from "../app/phan-tich-video/phase-threshold-advisor.mjs";

function frame(time, phase, values) {
  return { time, phase, visibility: 0.94, ankleSpread: 1.1, ...values };
}

function truthKey(time) {
  return Number(time).toFixed(3);
}

function buildCalibrationSet() {
  const frames = [];
  const labels = {};
  let time = 0;
  const push = (truth, values, aiPhase = truth) => {
    frames.push(frame(time, aiPhase, values));
    labels[truthKey(time)] = truth;
    time += 0.2;
  };

  // Pull is deliberately just below the current arm-flexion threshold (48°),
  // so the advisor should discover that a conservative reduction improves fit.
  for (let i = 0; i < 4; i += 1) push("pull", { armFlexion: 45, kneeFlexion: 18, wristSpread: 1.36 }, "breath");
  for (let i = 0; i < 3; i += 1) push("breath", { armFlexion: 34, kneeFlexion: 18, wristSpread: 1.0 });
  for (let i = 0; i < 3; i += 1) push("leg-recovery", { armFlexion: 18, kneeFlexion: 62, wristSpread: 1.0 });
  for (let i = 0; i < 3; i += 1) push("glide", { armFlexion: 10, kneeFlexion: 12, wristSpread: 1.0 });
  return { frames, labels };
}

test("simulates annotated ground truth without mutating engine thresholds", () => {
  const { frames, labels } = buildCalibrationSet();
  const before = { ...PHASE_THRESHOLDS };
  const result = simulateThresholds(frames, labels, PHASE_THRESHOLDS);
  assert.equal(result.annotated, 13);
  assert.ok(result.accuracy < 1);
  assert.deepEqual(PHASE_THRESHOLDS, before);
});

test("requires a minimum amount of ground truth before suggesting thresholds", () => {
  const { frames, labels } = buildCalibrationSet();
  const shortFrames = frames.slice(0, 6);
  const shortLabels = Object.fromEntries(shortFrames.map((item) => [truthKey(item.time), labels[truthKey(item.time)]]));
  const advisor = adviseThresholds(shortFrames, shortLabels, PHASE_THRESHOLDS);
  assert.equal(advisor.ready, false);
  assert.equal(advisor.minimumAnnotations, 10);
  assert.deepEqual(advisor.recommendations, []);
});

test("proposes a pull threshold adjustment only as a preview", () => {
  const { frames, labels } = buildCalibrationSet();
  const advisor = adviseThresholds(frames, labels, PHASE_THRESHOLDS);
  assert.equal(advisor.ready, true);
  const pull = advisor.recommendations.find((item) => item.key === "pullArmFlexionMin");
  assert.ok(pull);
  assert.ok(pull.suggested < PHASE_THRESHOLDS.pullArmFlexionMin);
  assert.ok(pull.gain >= 0.02);
  assert.ok(advisor.preview.accuracy >= advisor.baseline.accuracy);
  assert.equal(PHASE_THRESHOLDS.pullArmFlexionMin, 48);
});

test("advisor does not emit server or persistence behavior", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../app/phan-tich-video/phase-threshold-advisor.mjs", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /fetch\(|localStorage|indexedDB|\/api\//i);
  assert.match(source, /engine chưa bị thay đổi/);
});
