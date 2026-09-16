import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildConsensusAwareCoaching, COACHING_BUCKET } from "../app/phan-tich-video/consensus-aware-coaching-core.mjs";

const domains = (entries) => entries.map(([domain, status]) => ({ domain, status }));

test("corroborated evidence becomes a coaching priority only when trust is usable", () => {
  const report = buildConsensusAwareCoaching({
    trustLevel: "high",
    domains: domains([["arm-symmetry", "corroborated"]]),
  });
  assert.equal(report.priority.length, 1);
  assert.equal(report.priority[0].bucket, COACHING_BUCKET.PRIORITY);
  assert.equal(report.priority[0].domain, "arm-symmetry");
});

test("caution trust can coach a corroborated issue but keeps a caution reason", () => {
  const report = buildConsensusAwareCoaching({
    trustLevel: "caution",
    domains: domains([["leg-symmetry", "corroborated"]]),
  });
  assert.equal(report.priority.length, 1);
  assert.match(report.priority[0].reason, /thận trọng/i);
});

test("reference trust demotes even corroborated evidence to verify-first", () => {
  const report = buildConsensusAwareCoaching({
    trustLevel: "reference",
    domains: domains([["coordination", "corroborated"]]),
  });
  assert.equal(report.priority.length, 0);
  assert.equal(report.verify.length, 1);
  assert.equal(report.verify[0].bucket, COACHING_BUCKET.VERIFY);
});

test("conflict and single-source findings are never promoted to the main drill list", () => {
  const report = buildConsensusAwareCoaching({
    trustLevel: "high",
    domains: domains([
      ["arm-symmetry", "conflict"],
      ["leg-symmetry", "single-source"],
    ]),
  });
  assert.equal(report.priority.length, 0);
  assert.deepEqual(report.verify.map((item) => item.domain), ["leg-symmetry", "arm-symmetry"]);
});

test("clear evidence is monitored instead of inventing a corrective drill", () => {
  const report = buildConsensusAwareCoaching({
    trustLevel: "high",
    domains: domains([["coordination", "clear"]]),
  });
  assert.equal(report.monitor.length, 1);
  assert.equal(report.monitor[0].bucket, COACHING_BUCKET.MONITOR);
});

test("equal corroboration uses a stable workflow tie-break rather than pretending to rank biomechanical severity", () => {
  const report = buildConsensusAwareCoaching({
    trustLevel: "high",
    domains: domains([
      ["arm-symmetry", "corroborated"],
      ["leg-symmetry", "corroborated"],
      ["coordination", "corroborated"],
    ]),
  });
  assert.deepEqual(report.priority.map((item) => item.domain), ["coordination", "leg-symmetry", "arm-symmetry"]);
  assert.deepEqual(report.priority.map((item) => item.priority), [1, 2, 3]);
  assert.match(report.note, /không phải xếp hạng mức độ nghiêm trọng/i);
});

test("coaching core stays local-only, non-persistent and non-scoring", () => {
  const source = fs.readFileSync(new URL("../app/phan-tich-video/consensus-aware-coaching-core.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|\/api\//i);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(source, /PHASE_THRESHOLDS|serverPayload|scoreCategories|qualityScore\s*=/);
  assert.doesNotMatch(source, /unifiedTrustLevel\s*=/);
});
