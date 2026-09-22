import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("authorized device profile refreshes when the learner app becomes active", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /let presenceRunning = false/);
  assert.match(page, /if \(cancelled \|\| presenceRunning \|\| !navigator\.onLine\) return/);
  assert.match(page, /document\.addEventListener\("visibilitychange", syncVisibleDeviceProfile\)/);
  assert.match(page, /window\.addEventListener\("focus", syncVisibleDeviceProfile\)/);
  assert.match(page, /window\.addEventListener\("online", syncVisibleDeviceProfile\)/);
  assert.match(page, /window\.setInterval\(sendPresence, 60_000\)/);
});

test("live device profile listeners are fully cleaned up", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /document\.removeEventListener\("visibilitychange", syncVisibleDeviceProfile\)/);
  assert.match(page, /window\.removeEventListener\("focus", syncVisibleDeviceProfile\)/);
  assert.match(page, /window\.removeEventListener\("online", syncVisibleDeviceProfile\)/);
  assert.match(page, /window\.clearInterval\(timer\)/);
});

test("student role snapshot observes device-managed shell attributes", async () => {
  const shell = await readFile(new URL("../app/student-role-shell.tsx", import.meta.url), "utf8");

  for (const attribute of ["data-device-id", "data-device-type", "data-device-platform", "data-device-browser"]) {
    assert.ok(shell.includes(`"${attribute}"`), `missing observed ${attribute}`);
  }
  assert.match(shell, /classifiedType = shell\.dataset\.deviceType/);
  assert.match(shell, /platform: shell\.dataset\.devicePlatform \?\? ""/);
  assert.match(shell, /browser: shell\.dataset\.deviceBrowser \?\? ""/);
});
