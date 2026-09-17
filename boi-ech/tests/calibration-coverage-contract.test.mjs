import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panelUrl = new URL("../app/phan-tich-video/threshold-advisor-panel.tsx", import.meta.url);
const coverageUrl = new URL("../app/phan-tich-video/phase-calibration-coverage.mjs", import.meta.url);
const sessionUrl = new URL("../app/phan-tich-video/camera-profile-session.tsx", import.meta.url);

test("coverage gate is visible, shared-view-aware and cannot claim global calibration readiness", async () => {
  const [panel, coverage, session] = await Promise.all([
    readFile(panelUrl, "utf8"),
    readFile(coverageUrl, "utf8"),
    readFile(sessionUrl, "utf8"),
  ]);
  assert.match(panel, /data-calibration-coverage-gate/);
  assert.match(panel, /Góc quay chung đang dùng/);
  assert.match(panel, /useCameraProfile\(\)/);
  assert.match(panel, /Coverage chưa đạt/);
  assert.match(panel, /Ngưỡng chung toàn hệ thống vẫn bị khóa/);
  assert.match(panel, /analyzePhaseSequence\(frames\)/);
  assert.match(session, /Góc quay chung cho toàn bộ phân tích/);
  assert.match(coverage, /readyForThresholdReview/);
  assert.match(coverage, /globalReady: false/);
  assert.match(coverage, /minimumCompleteCycles: 2/);
  assert.match(coverage, /minimumPerPhase: 3/);
  assert.match(coverage, /minimumTemporalCoverage: 0\.5/);
});

test("coverage gate, shared camera profile and advisor remain local-only", async () => {
  const [panel, coverage, session] = await Promise.all([
    readFile(panelUrl, "utf8"),
    readFile(coverageUrl, "utf8"),
    readFile(sessionUrl, "utf8"),
  ]);
  assert.doesNotMatch(panel, /fetch\(|localStorage|indexedDB|\/api\//i);
  assert.doesNotMatch(coverage, /fetch\(|localStorage|indexedDB|\/api\//i);
  assert.doesNotMatch(session, /fetch\(|localStorage|sessionStorage|indexedDB|\/api\//i);
});
