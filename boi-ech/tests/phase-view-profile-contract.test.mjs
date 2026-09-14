import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panelUrl = new URL("../app/phan-tich-video/threshold-advisor-panel.tsx", import.meta.url);
const profileUrl = new URL("../app/phan-tich-video/phase-view-profile.mjs", import.meta.url);
const coreUrl = new URL("../app/phan-tich-video/phase-cycle-core.mjs", import.meta.url);
const sessionUrl = new URL("../app/phan-tich-video/camera-profile-session.tsx", import.meta.url);

test("view-aware analysis consumes the shared camera profile and keeps canonical cycle quality separate", async () => {
  const [panel, profile, core, session] = await Promise.all([
    readFile(panelUrl, "utf8"),
    readFile(profileUrl, "utf8"),
    readFile(coreUrl, "utf8"),
    readFile(sessionUrl, "utf8"),
  ]);
  assert.match(panel, /data-view-aware-cycle-analysis/);
  assert.match(panel, /Góc quay chung đang dùng/);
  assert.match(panel, /useCameraProfile\(\)/);
  assert.match(panel, /Điểm tín hiệu theo góc · không phải điểm chính/);
  assert.match(panel, /Chỉ tham khảo/);
  assert.match(session, /Góc quay chung cho toàn bộ phân tích/);
  assert.match(profile, /reliability >= 0\.7/);
  assert.match(profile, /không thay thế qualityScore/i);
  assert.match(core, /qualityScore/);
  assert.doesNotMatch(core, /assessCycleByView|phase-view-profile/);
});

test("view profiles and shared camera session stay local-only and cannot alter thresholds or server sync", async () => {
  const [panel, profile, session] = await Promise.all([
    readFile(panelUrl, "utf8"),
    readFile(profileUrl, "utf8"),
    readFile(sessionUrl, "utf8"),
  ]);
  assert.doesNotMatch(profile, /fetch\(|localStorage|indexedDB|\/api\//i);
  assert.doesNotMatch(panel, /fetch\(|localStorage|indexedDB|\/api\/video-analysis/i);
  assert.doesNotMatch(session, /fetch\(|localStorage|sessionStorage|indexedDB|\/api\//i);
  assert.doesNotMatch(profile, /PHASE_THRESHOLDS/);
  assert.doesNotMatch(profile, /serverPayload/);
});
