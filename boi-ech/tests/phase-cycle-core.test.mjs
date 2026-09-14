import assert from "node:assert/strict";
import test from "node:test";

import { analyzePhaseSequence, classifyPhase, PHASE_THRESHOLDS, summarizeCalibration } from "../app/phan-tich-video/phase-cycle-core.mjs";

function phaseFrames(phases, options = {}) {
  const frames = [];
  let time = 0;
  const visibility = options.visibility ?? 0.92;
  const metrics = {
    pull: { armFlexion: 62, kneeFlexion: 18, wristSpread: 1.4, ankleSpread: 1.1 },
    breath: { armFlexion: 36, kneeFlexion: 20, wristSpread: 1.05, ankleSpread: 1.1 },
    "leg-recovery": { armFlexion: 20, kneeFlexion: 64, wristSpread: 1.0, ankleSpread: 1.1 },
    kick: { armFlexion: 18, kneeFlexion: 28, wristSpread: 1.0, ankleSpread: 1.55 },
    glide: { armFlexion: 10, kneeFlexion: 12, wristSpread: 1.0, ankleSpread: 1.1 },
    unclear: { armFlexion: 22, kneeFlexion: 30, wristSpread: 1.0, ankleSpread: 1.1 },
  };
  for (const phase of phases) {
    const metric = metrics[phase];
    for (let index = 0; index < 2; index += 1) {
      frames.push({ time, phase, visibility, ...metric });
      time += 0.2;
    }
  }
  return frames;
}

test("classifies representative breaststroke phase metrics", () => {
  assert.equal(classifyPhase({ armFlexion: 60, kneeFlexion: 20, wristSpread: 1.4, ankleSpread: 1.1, previousKneeFlexion: 20 }), "pull");
  assert.equal(classifyPhase({ armFlexion: 35, kneeFlexion: 20, wristSpread: 1.0, ankleSpread: 1.1, previousKneeFlexion: 20 }), "breath");
  assert.equal(classifyPhase({ armFlexion: 20, kneeFlexion: 60, wristSpread: 1.0, ankleSpread: 1.1, previousKneeFlexion: 60 }), "leg-recovery");
  assert.equal(classifyPhase({ armFlexion: 18, kneeFlexion: 30, wristSpread: 1.0, ankleSpread: 1.5, previousKneeFlexion: 48 }), "kick");
  assert.equal(classifyPhase({ armFlexion: 10, kneeFlexion: 12, wristSpread: 1.0, ankleSpread: 1.1, previousKneeFlexion: 12 }), "glide");
});

test("recognizes two complete ordered breaststroke cycles", () => {
  const cycle = ["pull", "breath", "leg-recovery", "kick", "glide"];
  const report = analyzePhaseSequence(phaseFrames([...cycle, ...cycle]));
  assert.equal(report.completeCycles, 2);
  assert.equal(report.orderScore, 100);
  assert.ok(report.confidence >= 90);
  assert.deepEqual(report.warnings, []);
});

test("does not claim a complete cycle when a phase is missing", () => {
  const report = analyzePhaseSequence(phaseFrames(["pull", "breath", "leg-recovery", "glide"]));
  assert.equal(report.completeCycles, 0);
  assert.ok(report.orderScore < 100);
  assert.ok(report.warnings.some((warning) => warning.includes("Đạp chân")));
  assert.ok(report.warnings.some((warning) => warning.includes("Chưa thấy trọn một chu kỳ")));
});

test("penalizes out-of-order phase noise instead of silently scoring it perfect", () => {
  const report = analyzePhaseSequence(phaseFrames(["pull", "leg-recovery", "breath", "leg-recovery", "kick", "glide"]));
  assert.equal(report.completeCycles, 1);
  assert.ok(report.orderScore < 100);
});

test("warns when arm and leg recovery overlap for too long", () => {
  const frames = phaseFrames(["pull", "breath", "leg-recovery", "kick", "glide"]);
  for (let index = 2; index < 6; index += 1) {
    frames[index] = { ...frames[index], armFlexion: 52, kneeFlexion: 58 };
  }
  const report = analyzePhaseSequence(frames);
  assert.ok(report.warnings.some((warning) => warning.includes("cùng thu mạnh")));
});

test("summarizes local calibration metrics without changing phase thresholds", () => {
  const frames = phaseFrames(["pull", "breath", "leg-recovery", "kick", "glide", "unclear"]);
  const summary = summarizeCalibration(frames);
  assert.equal(summary.sampledFrames, 12);
  assert.equal(summary.phases.pull, 2);
  assert.equal(summary.phases.unclear, 2);
  assert.ok(summary.recognizedRatio > 0.8 && summary.recognizedRatio < 0.9);
  assert.equal(summary.visibilityAvg, 0.92);
  assert.equal(summary.metrics.armFlexion.max, 62);
  assert.equal(summary.metrics.kneeFlexion.max, 64);
  assert.equal(PHASE_THRESHOLDS.pullArmFlexionMin, 48);
  assert.equal(PHASE_THRESHOLDS.legRecoveryKneeFlexionMin, 42);
});
