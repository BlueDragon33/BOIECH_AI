import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { assessBilateralSymmetry, BILATERAL_SYMMETRY_RULES } from "../app/phan-tich-video/phase-bilateral-symmetry.mjs";

function frame(time, phase, leftArm, rightArm, leftKnee, rightKnee, visibility = 0.94) {
  return {
    time,
    phase,
    leftArmFlexion: leftArm,
    rightArmFlexion: rightArm,
    leftKneeFlexion: leftKnee,
    rightKneeFlexion: rightKnee,
    leftVisibility: visibility,
    rightVisibility: visibility,
  };
}

const cycle = { index: 1, start: 0, end: 1 };

test("rear view accepts a balanced bilateral cycle with strong evidence", () => {
  const frames = [
    frame(0, "pull", 52, 54, 18, 20),
    frame(0.2, "breath", 38, 40, 20, 22),
    frame(0.4, "leg-recovery", 28, 30, 62, 64),
    frame(0.6, "kick", 24, 25, 48, 50),
    frame(0.8, "kick", 20, 21, 28, 30),
    frame(1, "glide", 12, 13, 12, 13),
  ];
  const result = assessBilateralSymmetry(frames, [cycle], "rear");
  assert.equal(result.ready, true);
  assert.equal(result.trustedCycles, 1);
  assert.equal(result.cycles[0].status, "balanced");
  assert.ok(result.cycles[0].evidenceConfidence >= 90);
  assert.ok(result.cycles[0].kneeAverageDeg < BILATERAL_SYMMETRY_RULES.kneeReviewAvgDeg);
});

test("rear view flags meaningful knee asymmetry and separated kick peaks", () => {
  const frames = [
    frame(0, "pull", 52, 55, 18, 20),
    frame(0.2, "breath", 38, 41, 20, 22),
    frame(0.4, "leg-recovery", 28, 31, 70, 48),
    frame(0.6, "kick", 24, 27, 42, 46),
    frame(0.8, "kick", 20, 23, 38, 20),
    frame(1, "glide", 12, 14, 14, 12),
  ];
  const result = assessBilateralSymmetry(frames, [cycle], "rear");
  const assessment = result.cycles[0];
  assert.ok(["review", "weak"].includes(assessment.status));
  assert.ok(assessment.kneeAverageDeg >= BILATERAL_SYMMETRY_RULES.kneeReviewAvgDeg);
  assert.ok(assessment.kickTimingLagSec >= BILATERAL_SYMMETRY_RULES.kickTimingReviewSec);
  assert.ok(assessment.issues.some((issue) => issue.includes("Gối trái–phải")));
  assert.ok(assessment.issues.some((issue) => issue.includes("Đỉnh đạp hai chân")));
});

test("side view never makes a strong bilateral conclusion from the same asymmetry", () => {
  const frames = [
    frame(0, "pull", 60, 30, 18, 20),
    frame(0.2, "breath", 55, 25, 20, 22),
    frame(0.4, "leg-recovery", 28, 31, 72, 42),
    frame(0.6, "kick", 24, 27, 38, 44),
    frame(0.8, "kick", 20, 23, 20, 18),
    frame(1, "glide", 12, 14, 12, 12),
  ];
  const result = assessBilateralSymmetry(frames, [cycle], "side");
  assert.equal(result.cycles[0].status, "uncertain");
  assert.ok(result.cycles[0].evidenceConfidence < BILATERAL_SYMMETRY_RULES.trustedEvidenceMin * 100);
  assert.equal(result.trustedCycles, 0);
});

test("low visibility on either side suppresses rear-view symmetry conclusions", () => {
  const frames = [
    frame(0, "pull", 60, 30, 18, 20, 0.18),
    frame(0.2, "breath", 55, 25, 20, 22, 0.18),
    frame(0.4, "leg-recovery", 28, 31, 72, 42, 0.18),
    frame(0.6, "kick", 24, 27, 38, 44, 0.18),
    frame(0.8, "kick", 20, 23, 20, 18, 0.18),
    frame(1, "glide", 12, 14, 12, 12, 0.18),
  ];
  const result = assessBilateralSymmetry(frames, [cycle], "rear");
  assert.equal(result.cycles[0].status, "uncertain");
  assert.equal(result.trustedCycles, 0);
  assert.ok(result.cycles[0].issues[0].includes("visibility"));
});

test("bilateral symmetry core is local-only and contains no persistence/server behavior", () => {
  const source = fs.readFileSync(new URL("../app/phan-tich-video/phase-bilateral-symmetry.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /localStorage|indexedDB|\/api\//i);
});
