import assert from "node:assert/strict";
import test from "node:test";
import { assessUnifiedTrust } from "../app/phan-tich-video/unified-trust-core.mjs";

test("all required gates must pass before trust can be high", () => {
  const report = assessUnifiedTrust({
    preflight: "good",
    captureQuality: "good",
    viewQuality: "strong",
    cameraProfileSelected: true,
    overrideActive: false,
  });
  assert.equal(report.level, "high");
  assert.equal(report.label, "Tin cậy cao");
  assert.equal(report.highConfidence, true);
  assert.deepEqual(report.blockers, []);
  assert.deepEqual(report.warnings, []);
});

test("any review gate lowers the unified label to caution", () => {
  const report = assessUnifiedTrust({
    preflight: "good",
    captureQuality: "review",
    viewQuality: "strong",
    cameraProfileSelected: true,
  });
  assert.equal(report.level, "caution");
  assert.equal(report.label, "Cần thận trọng");
  assert.equal(report.blockers.length, 0);
  assert.ok(report.warnings.some((item) => item.includes("Capture Quality")));
});

test("retry or poor evidence lowers the unified label to reference", () => {
  const preflight = assessUnifiedTrust({ preflight: "retry", captureQuality: "good", viewQuality: "strong", cameraProfileSelected: true });
  const capture = assessUnifiedTrust({ preflight: "good", captureQuality: "retry", viewQuality: "strong", cameraProfileSelected: true });
  const view = assessUnifiedTrust({ preflight: "good", captureQuality: "good", viewQuality: "poor", cameraProfileSelected: true });
  assert.equal(preflight.level, "reference");
  assert.equal(capture.level, "reference");
  assert.equal(view.level, "reference");
});

test("explicit preflight override can never produce a high-trust result", () => {
  const report = assessUnifiedTrust({
    preflight: "retry",
    captureQuality: "good",
    viewQuality: "strong",
    cameraProfileSelected: true,
    overrideActive: true,
  });
  assert.equal(report.level, "reference");
  assert.equal(report.label, "Chỉ tham khảo");
  assert.ok(report.blockers.some((item) => item.includes("bỏ qua preflight")));
});

test("missing camera or unfinished evidence stays conservative", () => {
  const noCamera = assessUnifiedTrust({ preflight: "good", captureQuality: "good", viewQuality: "strong", cameraProfileSelected: false });
  const unfinished = assessUnifiedTrust({ preflight: "good", captureQuality: "unknown", viewQuality: "unknown", cameraProfileSelected: true });
  assert.equal(noCamera.level, "reference");
  assert.equal(unfinished.level, "caution");
});
