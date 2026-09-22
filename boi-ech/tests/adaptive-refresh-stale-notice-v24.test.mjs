import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const adaptive = fs.readFileSync(new URL("../app/student-adaptive-coach.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/student-adaptive-coach.css", import.meta.url), "utf8");

test("preserving refresh failures retain data and surface a stale notice", () => {
  assert.ok(adaptive.includes("if (!preserveData) setData(null);"));
  assert.ok(adaptive.includes('setError(caught instanceof Error ? caught.message : "Không thể tải Learner Model.")'));
  assert.ok(adaptive.includes('className="student-adaptive-stale"'));
  assert.ok(adaptive.includes("Hệ thống đang giữ dữ liệu gần nhất để bạn tiếp tục học."));
});

test("stale refresh state is passed only alongside an existing Adaptive Coach", () => {
  assert.ok(adaptive.includes("refreshError: string;"));
  assert.ok(adaptive.includes("refreshError={error}"));
  assert.ok(adaptive.includes("{refreshError ? ("));
});

test("successful refresh clears stale notice state", () => {
  const success = adaptive.indexOf("setData(next);");
  const clear = adaptive.indexOf('setError("");', success);
  assert.ok(success >= 0);
  assert.ok(clear > success);
});

test("initial bootstrap failure still clears data and renders the recoverable V22 error", () => {
  assert.ok(adaptive.includes("if (!preserveData) setData(null);"));
  assert.ok(adaptive.includes('if (error && !data)'));
  assert.ok(adaptive.includes('className="student-adaptive-coach student-adaptive-error"'));
});

test("stale notice has dedicated non-destructive styling", () => {
  assert.ok(styles.includes(".student-adaptive-stale"));
  assert.ok(styles.includes("background: #fff8eb;"));
});
