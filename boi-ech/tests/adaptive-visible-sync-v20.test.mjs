import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const adaptive = fs.readFileSync(new URL("../app/student-adaptive-coach.tsx", import.meta.url), "utf8");

test("adaptive coach refreshes conservatively while the learner tab is visible", () => {
  assert.ok(adaptive.includes("window.setInterval(refreshVisibleAdaptive, 120_000)"));
  assert.ok(adaptive.includes('document.visibilityState === "visible"'));
  assert.ok(adaptive.includes('document.addEventListener("visibilitychange", refreshVisibleAdaptive)'));
  assert.ok(adaptive.includes('document.removeEventListener("visibilitychange", refreshVisibleAdaptive)'));
});

test("adaptive coach blocks duplicate signed bootstrap requests", () => {
  assert.ok(adaptive.includes("const loadingRef = useRef(false)"));
  assert.ok(adaptive.includes("if (!deviceId || loadingRef.current) return;"));
  assert.ok(adaptive.includes("loadingRef.current = true;"));
  assert.ok(adaptive.includes("loadingRef.current = false;"));
});

test("adaptive refresh cannot write a stale learner response", () => {
  assert.ok(adaptive.includes("requestRef.current === requestId && deviceRef.current === deviceId"));
  assert.ok(adaptive.includes("requestRef.current += 1;"));
  assert.ok(adaptive.includes("refresh(false);"));
});

test("transient background refresh failures preserve the current learner model", () => {
  assert.ok(adaptive.includes("const refresh = useCallback((preserveData = true)"));
  assert.ok(adaptive.includes("if (requestRef.current === requestId)"));
  assert.ok(adaptive.includes("if (!preserveData) setData(null);"));
});
