import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const adaptive = fs.readFileSync(new URL("../app/student-adaptive-coach.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/student-adaptive-coach.css", import.meta.url), "utf8");

test("initial Adaptive Coach failures surface a recoverable learner-visible error", () => {
  assert.ok(adaptive.includes('const [error, setError] = useState("")'));
  assert.ok(adaptive.includes('setError(caught instanceof Error ? caught.message : "Không thể tải Learner Model.")'));
  assert.ok(adaptive.includes('className="student-adaptive-coach student-adaptive-error"'));
  assert.ok(adaptive.includes('role="alert"'));
});

test("retry uses a non-preserving bootstrap so another failure remains visible", () => {
  assert.ok(adaptive.includes('onClick={() => refresh(false)}>Thử lại</button>'));
  assert.ok(adaptive.includes('if (!preserveData) setError("")'));
});

test("background refresh failures still preserve the current learner model", () => {
  assert.ok(adaptive.includes("if (requestRef.current === requestId && !preserveData)"));
  assert.ok(adaptive.includes("refresh(true)"));
});

test("account or role changes clear stale bootstrap errors", () => {
  const inactive = adaptive.indexOf("if (!nextMount)");
  const clearInactiveError = adaptive.indexOf('setError("");', inactive);
  const deviceChanged = adaptive.indexOf("if (!deviceId || deviceRef.current === deviceId) return;");
  const clearDeviceError = adaptive.indexOf('setError("");', deviceChanged);
  assert.ok(clearInactiveError > inactive);
  assert.ok(clearDeviceError > deviceChanged);
});

test("recoverable bootstrap state has dedicated compact styling", () => {
  assert.ok(styles.includes(".student-adaptive-error"));
  assert.ok(styles.includes(".student-adaptive-error > button"));
});
