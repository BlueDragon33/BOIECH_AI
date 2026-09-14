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
  assert.equal(report.cycles.length, 2);
  assert.equal(report.orderScore, 100);
  assert.ok(report.confidence >= 90);
  assert.ok(report.cycleQualityAvg >= 85);
  assert.ok(report.cycles.every((item) => item.status === "good"));
  assert.deepEqual(report.warnings, []);
});

test("does not claim a complete cycle when a phase is missing", () => {
  const report = analyzePhaseSequence(phaseFrames(["pull", "breath", "leg-recovery", "glide"]));
  assert.equal(report.completeCycles, 0);
  assert.equal(report.cycles.length, 0);
  assert.ok(report.orderScore < 100);
  assert.ok(report.warnings.some((warning) => warning.includes("Đạp chân")));
  assert.ok(report.warnings.some((warning) => warning.includes("Chưa thấy trọn một chu kỳ")));
});

test("penalizes out-of-order phase noise instead of silently scoring it perfect", () => {
  const report = analyzePhaseSequence(phaseFrames(["pull", "leg-recovery", "breath", "leg-recovery", "kick", "glide"]));
  assert.equal(report.completeCycles, 1);
  assert.equal(report.cycles.length, 1);
  assert.ok(report.orderScore < 100);
  assert.ok(report.cycles[0].orderPurity < 1);
  assert.ok(report.cycles[0].issues.some((issue) => issue.includes("chen sai thứ tự")));
});

test("warns when arm and leg recovery overlap for too long", () => {
  const frames = phaseFrames(["pull", "breath", "leg-recovery", "kick", "glide"]);
  for (let index = 2; index < 6; index += 1) {
    frames[index] = { ...frames[index], armFlexion: 52, kneeFlexion: 58 };
  }
  const report = analyzePhaseSequence(frames);
  assert.ok(report.warnings.some((warning) => warning.includes("cùng thu mạnh")));
  assert.ok(report.cycles[0].issues.some((issue) => issue.includes("chồng pha")));
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

test("scores each complete cycle independently and identifies a weaker cycle", () => {
  const cycle = ["pull", "breath", "leg-recovery", "kick", "glide"];
  const frames = phaseFrames([...cycle, ...cycle]);
  for (const frame of frames) {
    if (frame.time < 2) continue;
    frame.visibility = 0.45;
    if (frame.phase === "pull") Object.assign(frame, { armFlexion: 49, wristSpread: 1.13 });
    if (frame.phase === "breath") Object.assign(frame, { armFlexion: 24.5, kneeFlexion: 41 });
    if (frame.phase === "leg-recovery") Object.assign(frame, { kneeFlexion: 43 });
    if (frame.phase === "kick") Object.assign(frame, { kneeFlexion: 37 });
    if (frame.phase === "glide") Object.assign(frame, { armFlexion: 23, kneeFlexion: 21, wristSpread: 1.17, ankleSpread: 1.34 });
  }

  const report = analyzePhaseSequence(frames);
  assert.equal(report.cycles.length, 2);
  assert.ok(report.cycles[0].qualityScore > report.cycles[1].qualityScore);
  assert.equal(report.cycles[0].status, "good");
  assert.notEqual(report.cycles[1].status, "good");
  assert.ok(report.cycles[1].weakestPhaseScore < 75);
  assert.ok(report.cycles[1].issues.some((issue) => issue.includes("tín hiệu yếu nhất")));
});

test("cycle quality keeps exact local timestamps for phase review", () => {
  const report = analyzePhaseSequence(phaseFrames(["pull", "breath", "leg-recovery", "kick", "glide"]));
  const cycle = report.cycles[0];
  assert.equal(cycle.index, 1);
  assert.equal(cycle.start, 0);
  assert.ok(cycle.end > cycle.start);
  assert.equal(cycle.phaseStarts.pull, 0);
  assert.ok(cycle.phaseStarts.glide > cycle.phaseStarts.kick);
  assert.ok(Object.keys(cycle.phaseScores).includes(cycle.weakestPhase));
});
