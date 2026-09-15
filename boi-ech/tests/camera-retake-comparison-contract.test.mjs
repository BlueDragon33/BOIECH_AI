import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const panel = fs.readFileSync(new URL("../app/phan-tich-video/camera-guidance-panel.tsx", import.meta.url), "utf8");
const comparisonCore = fs.readFileSync(new URL("../app/phan-tich-video/camera-retake-comparison.mjs", import.meta.url), "utf8");

test("retake comparison uses a different local video source with the same camera profile", () => {
  assert.match(panel, /run\.source !== source && run\.view === effectiveView/);
  assert.match(panel, /compareRetakeGuidance\(previous\.report, next\)/);
  assert.match(panel, /runHistoryRef = useRef<GuidanceRun\[]>\(\[\]\)/);
  assert.match(panel, /slice\(-4\)/);
  assert.match(panel, /attributeFilter: \["class", "src"\]/);
});

test("retake comparison resets visible results when the local source changes", () => {
  assert.match(panel, /setCurrentVideoSource\(videoSource\(video\)\)/);
  assert.match(panel, /\[view, hasVideo, currentVideoSource\]/);
  assert.match(panel, /setComparison\(null\)/);
});

test("retake comparison shows before-after evidence and remaining fixes", () => {
  assert.match(panel, /data-retake-comparison-local-only/);
  assert.match(panel, /Retake Comparison · so với clip trước/);
  assert.match(panel, /Đã khắc phục:/);
  assert.match(panel, /Mới kém đi:/);
  assert.match(panel, /Còn cần sửa:/);
  assert.match(panel, /Clip mới đã đủ điều kiện preflight/);
});

test("retake comparison remains RAM-only and cannot change scoring or thresholds", () => {
  for (const source of [panel, comparisonCore]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/i);
    assert.doesNotMatch(source, /\/api\//i);
    assert.doesNotMatch(source, /PHASE_THRESHOLDS|serverPayload|qualityScore\s*=/);
  }
});
