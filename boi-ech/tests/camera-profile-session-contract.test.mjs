import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const session = fs.readFileSync(new URL("../app/phan-tich-video/camera-profile-session.tsx", import.meta.url), "utf8");
const bilateral = fs.readFileSync(new URL("../app/phan-tich-video/bilateral-symmetry-panel.tsx", import.meta.url), "utf8");
const advisor = fs.readFileSync(new URL("../app/phan-tich-video/threshold-advisor-panel.tsx", import.meta.url), "utf8");
const analyzer = fs.readFileSync(new URL("../app/phan-tich-video/phase-cycle-analyzer.tsx", import.meta.url), "utf8");

test("camera profile is a single session-memory source shared by all analysis panels", () => {
  assert.match(session, /let currentView: CameraView = ""/);
  assert.match(session, /useSyncExternalStore/);
  assert.match(session, /data-shared-camera-profile-control/);
  assert.match(bilateral, /useCameraProfile\(\)/);
  assert.match(advisor, /useCameraProfile\(\)/);
  assert.doesNotMatch(bilateral, /useState\(\s*""\s*\)/);
  assert.doesNotMatch(advisor, /useState\(\s*""\s*\)/);
});

test("only one shared camera selector is rendered for a given cycle state", () => {
  assert.match(analyzer, /report\.cycles\.length \? <BilateralSymmetryPanel/);
  assert.match(bilateral, /<SharedCameraProfileControl compact \/>/);
  assert.match(advisor, /derivedCycles === 0 \? <SharedCameraProfileControl compact \/> : null/);
  assert.doesNotMatch(bilateral, /<select aria-label="Góc quay cho đối xứng trái phải"/);
  assert.doesNotMatch(advisor, /<select aria-label="Góc quay clip calibration"/);
});

test("shared camera profile remains session-only and has no server or persistence behavior", () => {
  assert.doesNotMatch(session, /localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|\/api\//i);
  assert.doesNotMatch(session, /PHASE_THRESHOLDS|qualityScore|serverPayload/);
  assert.match(session, /setCameraProfile/);
  assert.match(session, /listeners/);
});

test("coverage, view-aware analysis and bilateral symmetry consume the same view", () => {
  assert.match(advisor, /assessCalibrationCoverage\(frames, labelsByTime, \{ completeCycles: derivedCycles, view \}\)/);
  assert.match(advisor, /assessCycleByView\(cycle, view\)/);
  assert.match(bilateral, /assessBilateralSymmetry\(frames, cycles, view\)/);
  assert.match(advisor, /SharedCameraProfileStatus/);
  assert.match(bilateral, /SharedCameraProfileStatus/);
});
