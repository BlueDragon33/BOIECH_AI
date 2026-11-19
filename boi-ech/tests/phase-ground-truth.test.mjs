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

test("phase F1 penalizes false positives and uncertain frames without inventing accuracy for absent labels",()=>{
 const frames=[frame(0,"pull"),frame(.2,"pull"),frame(.4,"unclear"),frame(.6,"kick")];
 const labels={"0.000":"pull","0.200":"breath","0.400":"breath","0.600":"kick"};
 const summary=summarizeGroundTruth(frames,labels);
 assert.equal(summary.phaseMetrics.pull.precision,.5);
 assert.equal(summary.phaseMetrics.pull.recall,1);
 assert.equal(summary.phaseMetrics.pull.f1,2/3);
 assert.equal(summary.phaseMetrics.breath.f1,0);
 assert.equal(summary.abstained,1);
 assert.equal(summary.macroF1,(2/3+0+1)/3);
 assert.equal(summarizeGroundTruth(frames,{}).macroF1,null);
});

test("transition evaluation measures a one-frame delay, unmatched transitions and label coverage",()=>{
 const frames=[frame(0,"pull"),frame(.2,"pull"),frame(.4,"breath"),frame(.6,"breath"),frame(.8,"breath")];
 const labels={"0.000":"pull","0.200":"breath","0.400":"breath","0.600":"kick","0.800":"kick"};
 const result=summarizeGroundTruth(frames,labels);
 assert.equal(result.transitions.expected,2);
 assert.equal(result.transitions.matched,1);
 assert.equal(result.transitions.missed,1);
 assert.equal(result.transitions.extra,0);
 assert.ok(Math.abs(result.transitions.meanAbsoluteSeconds-.2)<1e-9);
 assert.equal(result.labelCoverage,1);
});

test("sparse labels and missing sampled frames cannot fabricate a transition time",()=>{
 const sparse=summarizeGroundTruth([frame(0,"pull"),frame(.2,"breath"),frame(.4,"kick")],{"0.000":"pull","0.400":"kick"});
 assert.equal(sparse.transitions.expected,0);
 assert.equal(sparse.transitions.meanAbsoluteSeconds,null);
 assert.equal(sparse.labelCoverage,2/3);
 const gap=summarizeGroundTruth([frame(0,"pull"),frame(1,"kick")],{"0.000":"pull","1.000":"kick"});
 assert.equal(gap.transitions.expected,0);
 const segmented=summarizeGroundTruth([frame(0,"pull"),frame(.2,"pull"),frame(.4,"unclear"),frame(.6,"pull"),frame(.8,"breath")],
  {"0.000":"pull","0.200":"breath","0.600":"breath","0.800":"breath"});
 assert.equal(segmented.transitions.matched,0);
});
