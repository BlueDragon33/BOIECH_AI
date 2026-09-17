import assert from "node:assert/strict";
import test from "node:test";
import { ANALYSIS_VIEW_OPTIONS, assessCycleByView, viewProfile } from "../app/phan-tich-video/phase-view-profile.mjs";

function cycle(overrides = {}) {
  return {
    index: 1,
    visibilityAvg: 0.9,
    phaseScores: {
      pull: 84,
      breath: 62,
      "leg-recovery": 78,
      kick: 80,
      glide: 88,
    },
    ...overrides,
  };
}

test("defines the same three explicit camera views used by calibration", () => {
  assert.deepEqual(ANALYSIS_VIEW_OPTIONS.map((item) => item.value), ["", "side", "rear", "front-oblique"]);
});

test("rear view trusts leg phases but limits breath conclusions", () => {
  const result = assessCycleByView(cycle(), "rear");
  assert.equal(result.ready, true);
  assert.equal(result.phaseEvidence["leg-recovery"].usable, true);
  assert.equal(result.phaseEvidence.kick.usable, true);
  assert.equal(result.phaseEvidence.breath.usable, false);
  assert.ok(result.limitedPhases.includes("breath"));
  assert.deepEqual(result.focusPhases, ["leg-recovery", "kick"]);
});

test("side view keeps breath and glide as high-confidence evidence", () => {
  const result = assessCycleByView(cycle(), "side");
  assert.equal(result.phaseEvidence.breath.reliabilityPercent, 100);
  assert.equal(result.phaseEvidence.glide.reliabilityPercent, 100);
  assert.equal(result.limitedPhases.length, 0);
  assert.equal(result.weakestTrustedPhase, "breath");
});

test("view-aware score never mutates the original cycle quality", () => {
  const input = cycle();
  const before = structuredClone(input);
  const result = assessCycleByView(input, "front-oblique");
  assert.equal(typeof result.signalScore, "number");
  assert.deepEqual(input, before);
  assert.equal(input.phaseScores.breath, 62);
});

test("no selected view produces no view-specific conclusion", () => {
  const result = assessCycleByView(cycle(), "");
  assert.equal(result.ready, false);
  assert.equal(result.signalScore, null);
  assert.equal(result.weakestTrustedPhase, null);
});

test("profile copy states the rear-view limitation explicitly", () => {
  const rear = viewProfile("rear");
  assert.match(rear.limitations, /lấy hơi/i);
});
