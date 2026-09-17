import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const switcher = readFileSync(new URL("../app/multi-account-switcher.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/multi-account-switcher.css", import.meta.url), "utf8");

test("multi-account control is visibly pinned for learner and teacher role shells", () => {
  assert.match(styles, /body\[data-student-role-ui="active"\] \.multi-account-trigger/);
  assert.match(styles, /body\[data-teacher-role-ui="active"\] \.multi-account-trigger/);
  assert.match(styles, /position:\s*fixed/);
  assert.match(styles, /bottom:\s*18px/);
  assert.match(styles, /z-index:\s*1550/);
});

test("visible account control still opens switching and new registration flow", () => {
  assert.match(switcher, />Đổi tài khoản</);
  assert.match(switcher, />Đăng ký tài khoản mới</);
  assert.match(switcher, /onClick=\{\(\) => void logout\(\)\}/);
  assert.match(switcher, /onClick=\{\(\) => void addAccount\(\)\}/);
});

test("additional registration still requires manual review", () => {
  assert.match(switcher, /boi-ech-additional-account-manual-review-v1/);
  assert.match(switcher, /ADDITIONAL_REVIEW_TOKEN/);
});
