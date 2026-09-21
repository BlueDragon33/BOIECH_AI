import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const manager = fs.readFileSync(new URL("../app/teacher-roster-manager.tsx", import.meta.url), "utf8");

test("roster sync never calls the teacher endpoint while teacher role UI is inactive", () => {
  assert.match(manager, /if \(document\.body\.dataset\.teacherRoleUi !== "active"\) return;/);
  const effectStart = manager.indexOf("useEffect(() =>");
  const intervalStart = manager.indexOf("window.setInterval", effectStart);
  const effectPrefix = manager.slice(effectStart, intervalStart);
  assert.doesNotMatch(effectPrefix, /deriveDeviceId\(\)\.then\([\s\S]*syncRoster\("auto"\)/);
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
  assert.match(manager, /document\.visibilityState !== "visible"/);
  assert.match(manager, /document\.addEventListener\("visibilitychange", onVisible\)/);
});
