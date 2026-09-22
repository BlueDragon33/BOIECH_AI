import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const adaptive = fs.readFileSync(new URL("../app/student-adaptive-coach.tsx", import.meta.url), "utf8");

test("automatic adaptive refresh skips work while the browser is offline", () => {
  assert.ok(adaptive.includes('document.visibilityState === "visible" && navigator.onLine'));
  assert.ok(adaptive.includes("window.setInterval(refreshVisibleAdaptive, 120_000)"));
});

test("adaptive model refreshes when connectivity returns", () => {
  assert.ok(adaptive.includes('window.addEventListener("online", refreshVisibleAdaptive)'));
  assert.ok(adaptive.includes('window.removeEventListener("online", refreshVisibleAdaptive)'));
});

test("network-aware sync keeps the existing V20 request and visibility guards", () => {
  assert.ok(adaptive.includes("if (!deviceId || loadingRef.current) return;"));
  assert.ok(adaptive.includes("requestRef.current === requestId && deviceRef.current === deviceId"));
  assert.ok(adaptive.includes('document.addEventListener("visibilitychange", refreshVisibleAdaptive)'));
});
