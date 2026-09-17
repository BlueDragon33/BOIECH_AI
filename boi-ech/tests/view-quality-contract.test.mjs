import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const quality = fs.readFileSync(new URL("../app/phan-tich-video/phase-view-quality.mjs", import.meta.url), "utf8");
const bilateral = fs.readFileSync(new URL("../app/phan-tich-video/bilateral-symmetry-panel.tsx", import.meta.url), "utf8");
const advisor = fs.readFileSync(new URL("../app/phan-tich-video/threshold-advisor-panel.tsx", import.meta.url), "utf8");

test("view quality gate is shared by bilateral, view-aware and calibration decisions", () => {
  assert.match(bilateral, /assessViewQuality\(frames, view\)/);
  assert.match(advisor, /assessViewQuality\(frames, view\)/);
  assert.match(advisor, /trustedForClip = advisor\.ready && coverage\.readyForThresholdReview && viewQuality\.allowCalibrationReview/);
  assert.match(advisor, /viewQuality\.allowStrongConclusions \? \(assessment\.signalScore/);
  assert.match(bilateral, /strongAllowed \? report\.trustedCycles : 0/);
});

test("view quality gate measures continuity, visibility, body coverage and stability", () => {
  assert.match(quality, /temporalPoseCoverage/);
  assert.match(quality, /visibilityAvg/);
  assert.match(quality, /bodyCoverage/);
  assert.match(quality, /stability/);
  assert.match(quality, /bilateralVisibility/);
  assert.match(quality, /sideBodyVisibility/);
});

test("view quality remains local-only and never mutates primary scoring or thresholds", () => {
  for (const source of [quality, bilateral, advisor]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|\/api\/video-analysis/i);
  }
  assert.doesNotMatch(quality, /fetch\s*\(|serverPayload|PHASE_THRESHOLDS/);
  assert.doesNotMatch(bilateral, /qualityScore\s*=/);
  assert.doesNotMatch(advisor, /qualityScore\s*=/);
});
