import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const switcher = readFileSync(new URL("../app/multi-account-switcher.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/multi-account-switcher.css", import.meta.url), "utf8");

test("multi-account control is attached to learner and teacher identity chips", () => {
  assert.match(styles, /body\[data-student-role-ui="active"\] \.topbar-actions \.learner-chip/);
  assert.match(styles, /body\[data-teacher-role-ui="active"\] \.topbar-actions \.learner-chip/);
  assert.match(styles, /body\[data-student-role-ui="active"\] \.topbar-actions > \.multi-account-trigger/);
  assert.match(styles, /body\[data-teacher-role-ui="active"\] \.topbar-actions > \.multi-account-trigger/);
  assert.match(styles, /border-top-right-radius:\s*0/);
  assert.match(styles, /border-radius:\s*0 12px 12px 0/);
});

test("role dashboards no longer pin the account switch as a fixed floating button", () => {
  const roleBlock = styles.slice(styles.indexOf("/* Gắn thao tác tài khoản trực tiếp"), styles.indexOf(".multi-account-overlay"));
  assert.doesNotMatch(roleBlock, /position:\s*fixed/);
  assert.doesNotMatch(roleBlock, /bottom:\s*18px/);
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
