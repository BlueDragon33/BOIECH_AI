import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const panel = fs.readFileSync(new URL("../app/phan-tich-video/camera-guidance-panel.tsx", import.meta.url), "utf8");
const core = fs.readFileSync(new URL("../app/phan-tich-video/camera-guidance-core.mjs", import.meta.url), "utf8");
const composer = fs.readFileSync(new URL("../app/phan-tich-video/video-analyzer.tsx", import.meta.url), "utf8");

test("camera guidance samples a bounded local preflight and restores playback", () => {
  assert.match(panel, /const sampleCount = 12/);
  assert.match(panel, /capturePlaybackState\(video\)/);
  assert.match(panel, /restorePlaybackState\(video, playbackState, seek\)/);
  assert.match(panel, /assessCameraGuidance\(samples, effectiveView\)/);
  assert.match(panel, /data-camera-guidance-local-only/);
  assert.match(composer, /<CameraGuidancePanel \/>/);
});

test("camera guidance sits immediately before analyze and reuses the existing AI view choice", () => {
  assert.match(panel, /insertBefore\(host, analyzeButton\)/);
  assert.match(panel, /createPortal\(content, portalHost\)/);
  assert.match(panel, /selectedLegacyView/);
  assert.match(panel, /setCameraProfile\(inferredView\)/);
  assert.match(panel, /selectedLegacyView\(root\) \|\| view/);
  assert.match(panel, /useCameraProfile\(\)/);
  assert.doesNotMatch(panel, /SharedCameraProfileControl/);
});

test("camera guidance reports framing evidence without creating another scoring path", () => {
  assert.match(panel, /Đủ lớn/);
  assert.match(panel, /Không sát mép/);
  assert.match(panel, /Ổn định/);
  assert.match(core, /bodyCoverage/);
  assert.match(core, /edgeSafety/);
  assert.match(core, /bilateralVisibility/);
});

test("camera guidance does not capture images, persist results or call application APIs", () => {
  for (const source of [panel, core]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/i);
    assert.doesNotMatch(source, /\/api\//i);
    assert.doesNotMatch(source, /toDataURL|drawImage|canvas/i);
    assert.doesNotMatch(source, /serverPayload|qualityScore\s*=|PHASE_THRESHOLDS\s*\./);
  }
});
