import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const adaptive = fs.readFileSync(new URL("../app/student-adaptive-coach.tsx", import.meta.url), "utf8");

test("manual Adaptive Coach refresh exposes loading feedback without clearing current data", () => {
  assert.ok(adaptive.includes("loading: boolean;"));
  assert.ok(adaptive.includes('disabled={loading}>{loading ? "Đang cập nhật…" : "Cập nhật"}</button>'));
  assert.ok(adaptive.includes("<AdaptiveCoach data={data}"));
  assert.ok(adaptive.includes("reload={refresh}"));
  assert.ok(adaptive.includes("loading={loading}"));
});

test("manual refresh feedback reuses the existing duplicate-request guard", () => {
  assert.ok(adaptive.includes("if (!deviceId || loadingRef.current) return;"));
  assert.ok(adaptive.includes("loadingRef.current = true;"));
  assert.ok(adaptive.includes("loadingRef.current = false;"));
});

test("background refresh still preserves the current learner model", () => {
  assert.ok(adaptive.includes("refresh(true)"));
  assert.ok(adaptive.includes("if (requestRef.current === requestId)"));
  assert.ok(adaptive.includes("if (!preserveData) setData(null);"));
});
