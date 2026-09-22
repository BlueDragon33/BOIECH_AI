import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const inbox = fs.readFileSync(new URL("../app/student-teacher-inbox.tsx", import.meta.url), "utf8");

test("learner inbox refreshes every 60 seconds only while visible", () => {
  assert.ok(inbox.includes("window.setInterval(refreshVisibleInbox, 60_000)"));
  assert.ok(inbox.includes('document.visibilityState === "visible"'));
  assert.ok(inbox.includes('document.addEventListener("visibilitychange", refreshVisibleInbox)'));
  assert.ok(inbox.includes('document.removeEventListener("visibilitychange", refreshVisibleInbox)'));
});

test("learner inbox prevents duplicate signed fetches for the same device", () => {
  assert.ok(inbox.includes('const inFlightDeviceRef = useRef("")'));
  assert.ok(inbox.includes("if (inFlightDeviceRef.current === deviceId) return;"));
  assert.ok(inbox.includes("inFlightDeviceRef.current = deviceId;"));
  assert.ok(inbox.includes('if (requestRef.current === requestId) inFlightDeviceRef.current = "";'));
});

test("learner inbox rejects stale account responses and preserves data on transient auto-refresh failure", () => {
  assert.ok(inbox.includes("requestRef.current += 1;"));
  assert.ok(inbox.includes("requestRef.current === requestId && deviceRef.current === deviceId"));
  assert.ok(inbox.includes("requestRef.current === requestId && !forceRefresh"));
});
