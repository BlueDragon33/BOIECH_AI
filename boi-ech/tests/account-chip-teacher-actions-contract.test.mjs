import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const accountCss = fs.readFileSync(new URL("../app/multi-account-switcher.css", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../app/teacher-action-bridge.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("account switch is visually attached to learner or teacher identity chip", () => {
  assert.match(accountCss, /topbar-actions \.learner-chip/);
  assert.match(accountCss, /topbar-actions > \.multi-account-trigger/);
  assert.match(accountCss, /border-top-right-radius: 0/);
  assert.match(accountCss, /border-radius: 0 12px 12px 0/);
  assert.doesNotMatch(accountCss, /data-teacher-role-ui="active"\] \.multi-account-trigger \{\s*position: fixed/);
});

test("teacher editor shortcut reuses the live personal editor or permission request", () => {
  assert.match(bridge, /\.personal-edit-trigger/);
  assert.match(bridge, /\.editor-request-link/);
  assert.match(bridge, /window\.location\.assign\("\/bien-tap-noi-dung"\)/);
});

test("teacher capability cards are real keyboard-accessible actions", () => {
  assert.match(bridge, /CAPABILITY_TARGETS/);
  assert.match(bridge, /"Học viên", "Phân tích video", "Báo cáo", "Biên tập bài giảng"/);
  assert.match(bridge, /setAttribute\("role", "button"\)/);
  assert.match(bridge, /event\.key !== "Enter" && event\.key !== " "/);
});

test("teacher action bridge is mounted globally with role shells", () => {
  assert.match(layout, /TeacherActionBridge/);
  assert.match(layout, /<TeacherActionBridge \/>/);
});
