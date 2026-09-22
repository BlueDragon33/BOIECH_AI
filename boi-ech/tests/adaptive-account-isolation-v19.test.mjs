import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const adaptive = fs.readFileSync(new URL("../app/student-adaptive-coach.tsx", import.meta.url), "utf8");

test("adaptive coach invalidates requests when learner role leaves the surface", () => {
  const inactive = adaptive.indexOf("if (!nextMount)");
  const invalidate = adaptive.indexOf("requestRef.current += 1;", inactive);
  const clearDevice = adaptive.indexOf('deviceRef.current = "";', inactive);
  const clearData = adaptive.indexOf("setData(null);", inactive);
  assert.ok(inactive >= 0);
  assert.ok(invalidate > inactive && invalidate < clearData);
  assert.ok(clearDevice > invalidate && clearDevice < clearData);
});

test("adaptive coach clears previous learner data before loading a different device", () => {
  const changed = adaptive.indexOf("if (!deviceId || deviceRef.current === deviceId) return;");
  const assign = adaptive.indexOf("deviceRef.current = deviceId;", changed);
  const request = adaptive.indexOf("const requestId = ++requestRef.current;", assign);
  const clear = adaptive.indexOf("setData(null);", request);
  const load = adaptive.indexOf("loadAdaptiveProfile(deviceId)", clear);
  assert.ok(changed >= 0);
  assert.ok(assign > changed);
  assert.ok(request > assign);
  assert.ok(clear > request && clear < load);
});

test("adaptive coach ignores stale responses after an account generation changes", () => {
  assert.ok(adaptive.includes("if (requestRef.current === requestId) setData(next)"));
  assert.ok(adaptive.includes("if (requestRef.current === requestId) setData(null)"));
});
