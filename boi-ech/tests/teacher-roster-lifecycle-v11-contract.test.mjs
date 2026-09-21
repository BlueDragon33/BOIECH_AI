import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const manager = fs.readFileSync(new URL("../app/teacher-roster-manager.tsx", import.meta.url), "utf8");

test("roster sync guards teacher role before deriving identity or calling roster API", () => {
  const syncStart = manager.indexOf("const syncRoster = async");
  const syncEnd = manager.indexOf("const mutate = async", syncStart);
  const syncBlock = manager.slice(syncStart, syncEnd);
  const syncGuard = syncBlock.indexOf('document.body.dataset.teacherRoleUi !== "active"');
  const syncRequest = syncBlock.indexOf('requestRoster(deviceId, "list")');
  assert.ok(syncGuard >= 0);
  assert.ok(syncRequest > syncGuard);

  const ensureStart = manager.indexOf("const ensureTeacherDeviceSynced = async () => {");
  const ensureEnd = manager.indexOf("const updateMounts", ensureStart);
  const ensureBlock = manager.slice(ensureStart, ensureEnd);
  const ensureGuard = ensureBlock.indexOf('document.body.dataset.teacherRoleUi !== "active"');
  const derive = ensureBlock.indexOf("deriveDeviceId()");
  assert.ok(ensureGuard >= 0);
  assert.ok(derive > ensureGuard);
});

test("leaving teacher role clears roster state and invalidates in-flight requests", () => {
  assert.match(manager, /syncGenerationRef\.current \+= 1/);
  assert.match(manager, /clearRosterState\(\)/);
  assert.match(manager, /setData\(\{ roster: \[\], counts: \{ pending: 0, approved: 0, blocked: 0 \}, syncedAt: "" \}\)/);
  assert.match(manager, /teacherActiveRef\.current = false/);
});

test("account switching detects device identity changes immediately", () => {
  assert.match(manager, /changedDevice = Boolean\(deviceIdRef\.current && deviceIdRef\.current !== deviceId\)/);
  assert.match(manager, /attributeFilter: \["data-teacher-role-ui", "class", "title", "data-device-id"\]/);
  assert.match(manager, /syncedDeviceRef\.current !== deviceId/);
  assert.match(manager, /deviceIdRef\.current = deviceId/);
});

test("generation guards prevent stale account responses from replacing the current roster", () => {
  assert.match(manager, /const generation = syncGenerationRef\.current/);
  assert.match(manager, /generation !== syncGenerationRef\.current \|\| deviceIdRef\.current !== deviceId/);
  assert.match(manager, /if \(generation === syncGenerationRef\.current\)/);
});

test("only one roster request is allowed at a time for the active account", () => {
  assert.match(manager, /if \(syncingRef\.current\) return;/);
  assert.match(manager, /const alreadySynced = await ensureTeacherDeviceSynced\(\)/);
  assert.match(manager, /if \(!alreadySynced\) await syncRoster\("auto"\)/);
  assert.doesNotMatch(manager, /ensureTeacherDeviceSynced\(\)\.then\(\(\) => void syncRoster/);
});

test("visible-tab auto refresh remains at the requested 60-second cadence", () => {
  assert.match(manager, /window\.setInterval\([\s\S]*60_000/);
  assert.match(manager, /document\.visibilityState === "visible"/);
  assert.match(manager, /document\.addEventListener\("visibilitychange", onVisible\)/);
});
