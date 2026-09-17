import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  assessCrossModuleConsistency,
  CONSISTENCY_DOMAIN,
  CONSISTENCY_SIGNAL,
  CONSISTENCY_STATUS,
} from "../app/phan-tich-video/cross-module-consistency-core.mjs";

function finding(domain, module, signal, detail = "") {
  return { domain, module, signal, detail };
}

function domain(report, name) {
  return report.domains.find((item) => item.domain === name);
}

test("two independent arm findings corroborate instead of being added as extra score", () => {
  const report = assessCrossModuleConsistency([
    finding(CONSISTENCY_DOMAIN.ARM_SYMMETRY, "v1", CONSISTENCY_SIGNAL.POSITIVE),
    finding(CONSISTENCY_DOMAIN.ARM_SYMMETRY, "bilateral", CONSISTENCY_SIGNAL.POSITIVE),
  ]);
  assert.equal(domain(report, CONSISTENCY_DOMAIN.ARM_SYMMETRY).status, CONSISTENCY_STATUS.CORROBORATED);
  assert.equal(report.status, CONSISTENCY_STATUS.CORROBORATED);
});

test("positive v1 arm finding conflicts with a trusted negative bilateral finding", () => {
  const report = assessCrossModuleConsistency([
    finding(CONSISTENCY_DOMAIN.ARM_SYMMETRY, "v1", CONSISTENCY_SIGNAL.POSITIVE),
    finding(CONSISTENCY_DOMAIN.ARM_SYMMETRY, "bilateral", CONSISTENCY_SIGNAL.NEGATIVE),
  ]);
  const arm = domain(report, CONSISTENCY_DOMAIN.ARM_SYMMETRY);
  assert.equal(arm.status, CONSISTENCY_STATUS.CONFLICT);
  assert.match(arm.conclusion, /Không nên cộng dồn thành kết luận mạnh/);
});

test("leg asymmetry needs an independent bilateral source before it is considered corroborated", () => {
  const report = assessCrossModuleConsistency([
    finding(CONSISTENCY_DOMAIN.LEG_SYMMETRY, "v1", CONSISTENCY_SIGNAL.POSITIVE),
    finding(CONSISTENCY_DOMAIN.LEG_SYMMETRY, "bilateral", CONSISTENCY_SIGNAL.UNKNOWN),
  ]);
  assert.equal(domain(report, CONSISTENCY_DOMAIN.LEG_SYMMETRY).status, CONSISTENCY_STATUS.SINGLE_SOURCE);
});

test("coordination compares v1 overlap with the five-phase engine", () => {
  const report = assessCrossModuleConsistency([
    finding(CONSISTENCY_DOMAIN.COORDINATION, "v1", CONSISTENCY_SIGNAL.POSITIVE),
    finding(CONSISTENCY_DOMAIN.COORDINATION, "phase", CONSISTENCY_SIGNAL.POSITIVE),
  ]);
  assert.equal(domain(report, CONSISTENCY_DOMAIN.COORDINATION).status, CONSISTENCY_STATUS.CORROBORATED);
});

test("two eligible negative detectors are consistent clear evidence rather than a positive claim", () => {
  const report = assessCrossModuleConsistency([
    finding(CONSISTENCY_DOMAIN.LEG_SYMMETRY, "v1", CONSISTENCY_SIGNAL.NEGATIVE),
    finding(CONSISTENCY_DOMAIN.LEG_SYMMETRY, "bilateral", CONSISTENCY_SIGNAL.NEGATIVE),
  ]);
  const leg = domain(report, CONSISTENCY_DOMAIN.LEG_SYMMETRY);
  assert.equal(leg.status, CONSISTENCY_STATUS.CLEAR);
  assert.match(leg.conclusion, /không phải chứng minh kỹ thuật hoàn hảo/i);
});

test("an ineligible detector cannot create a false conflict", () => {
  const report = assessCrossModuleConsistency([
    finding(CONSISTENCY_DOMAIN.ARM_SYMMETRY, "v1", CONSISTENCY_SIGNAL.POSITIVE),
    { ...finding(CONSISTENCY_DOMAIN.ARM_SYMMETRY, "bilateral", CONSISTENCY_SIGNAL.NEGATIVE), eligible: false },
  ]);
  assert.equal(domain(report, CONSISTENCY_DOMAIN.ARM_SYMMETRY).status, CONSISTENCY_STATUS.SINGLE_SOURCE);
});

test("duplicate records from one module never count as two independent sources", () => {
  const report = assessCrossModuleConsistency([
    finding(CONSISTENCY_DOMAIN.COORDINATION, "v1", CONSISTENCY_SIGNAL.POSITIVE),
    finding(CONSISTENCY_DOMAIN.COORDINATION, "v1", CONSISTENCY_SIGNAL.POSITIVE),
  ]);
  const coordination = domain(report, CONSISTENCY_DOMAIN.COORDINATION);
  assert.equal(coordination.status, CONSISTENCY_STATUS.SINGLE_SOURCE);
  assert.deepEqual(coordination.positives, ["v1"]);
});

test("a conflict outranks corroboration in the overall consistency label", () => {
  const report = assessCrossModuleConsistency([
    finding(CONSISTENCY_DOMAIN.ARM_SYMMETRY, "v1", CONSISTENCY_SIGNAL.POSITIVE),
    finding(CONSISTENCY_DOMAIN.ARM_SYMMETRY, "bilateral", CONSISTENCY_SIGNAL.POSITIVE),
    finding(CONSISTENCY_DOMAIN.COORDINATION, "v1", CONSISTENCY_SIGNAL.POSITIVE),
    finding(CONSISTENCY_DOMAIN.COORDINATION, "phase", CONSISTENCY_SIGNAL.NEGATIVE),
  ]);
  assert.equal(report.status, CONSISTENCY_STATUS.CONFLICT);
});

test("consistency core stays local-only and cannot change scoring, thresholds or trust", () => {
  const source = fs.readFileSync(new URL("../app/phan-tich-video/cross-module-consistency-core.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|\/api\//i);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(source, /PHASE_THRESHOLDS|serverPayload|scoreCategories|qualityScore\s*=/);
  assert.doesNotMatch(source, /unifiedTrustLevel\s*=/);
});
