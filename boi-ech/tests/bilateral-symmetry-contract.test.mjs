import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const analyzer = fs.readFileSync(new URL("../app/phan-tich-video/phase-cycle-analyzer.tsx", import.meta.url), "utf8");
const panel = fs.readFileSync(new URL("../app/phan-tich-video/bilateral-symmetry-panel.tsx", import.meta.url), "utf8");
const core = fs.readFileSync(new URL("../app/phan-tich-video/phase-bilateral-symmetry.mjs", import.meta.url), "utf8");
const quality = fs.readFileSync(new URL("../app/phan-tich-video/phase-view-quality.mjs", import.meta.url), "utf8");

test("analyzer preserves left and right pose signals separately for bilateral review", () => {
  assert.match(analyzer, /leftArmFlexion/);
  assert.match(analyzer, /rightArmFlexion/);
  assert.match(analyzer, /leftKneeFlexion/);
  assert.match(analyzer, /rightKneeFlexion/);
  assert.match(analyzer, /leftVisibility/);
  assert.match(analyzer, /rightVisibility/);
  assert.match(analyzer, /<BilateralSymmetryPanel frames=\{calibrationFrames\} cycles=\{report\.cycles\} onJump=\{jumpToFrame\}/);
});

test("bilateral panel is view-gated, timestamp-linked and explicitly non-scoring", () => {
  assert.match(panel, /Đối xứng trái–phải/);
  assert.match(panel, /Góc từ sau là bằng chứng mạnh nhất/);
  assert.match(panel, /Không thay đổi qualityScore hay điểm chính/);
  assert.match(panel, /onJump\(cycle\.worstTime\)/);
  assert.match(panel, /data-bilateral-symmetry-local-only/);
});

test("view quality gate suppresses strong bilateral labels when clip evidence is weak", () => {
  assert.match(panel, /assessViewQuality\(frames, view\)/);
  assert.match(panel, /data-view-quality-gate/);
  assert.match(panel, /const strongAllowed = viewQuality\.allowStrongConclusions/);
  assert.match(panel, /strongAllowed \? statusLabel\(cycle\.status\) : "Chưa đủ tin cậy"/);
  assert.match(panel, /Không gắn nhãn “cân bằng\/lệch rõ”/);
  assert.match(quality, /allowStrongConclusions/);
  assert.match(quality, /minimumBilateralVisibility/);
});

test("bilateral feature and view quality gate remain local-only and cannot alter thresholds or server sync", () => {
  for (const source of [panel, core, quality]) {
    assert.doesNotMatch(source, /fetch\s*\(/);
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|\/api\//i);
    assert.doesNotMatch(source, /PHASE_THRESHOLDS\s*\.[A-Za-z0-9_]+\s*=/);
  }
  assert.doesNotMatch(panel, /serverPayload|qualityScore\s*=/);
});
