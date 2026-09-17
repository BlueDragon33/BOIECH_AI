import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const analyzerUrl = new URL("../app/phan-tich-video/phase-cycle-analyzer.tsx", import.meta.url);
const panelUrl = new URL("../app/phan-tich-video/threshold-advisor-panel.tsx", import.meta.url);
const advisorUrl = new URL("../app/phan-tich-video/phase-threshold-advisor.mjs", import.meta.url);

test("threshold advisor is visible inside ground truth calibration but remains preview-only", async () => {
  const [analyzer, panel, advisor] = await Promise.all([
    readFile(analyzerUrl, "utf8"),
    readFile(panelUrl, "utf8"),
    readFile(advisorUrl, "utf8"),
  ]);
  assert.match(analyzer, /<ThresholdAdvisorPanel frames=\{calibrationFrames\} labelsByTime=\{groundTruthLabels\} \/>/);
  assert.match(panel, /data-threshold-advisor-local-only/);
  assert.match(panel, /Không tự sửa engine/);
  assert.match(advisor, /minimumAnnotations: 10/);
  assert.match(advisor, /gain >= 0\.02/);
  assert.doesNotMatch(panel, /fetch\(|localStorage|indexedDB|\/api\//i);
  assert.doesNotMatch(advisor, /fetch\(|localStorage|indexedDB|\/api\//i);
});

test("experimental UI does not expose internal version labels", async () => {
  const analyzer = await readFile(analyzerUrl, "utf8");
  assert.doesNotMatch(analyzer, /V2\.1|V2\.2|v2\.1|v2\.2/);
  assert.match(analyzer, /PHÂN TÍCH CHU KỲ · THỬ NGHIỆM/);
});
