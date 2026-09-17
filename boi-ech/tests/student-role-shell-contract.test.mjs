import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../app/student-role-shell.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/student-role-shell.css", import.meta.url), "utf8");

test("learner dashboard activates only for the registered learner role", () => {
  assert.match(shell, /role === "Học viên"/);
  assert.doesNotMatch(shell, /role === "Giảng viên"/);
  assert.match(shell, /document\.body\.dataset\.studentRoleUi = "active"/);
  assert.match(css, /body\[data-student-role-ui="active"\]/);
});

test("student navigation reuses existing course controls instead of bypassing progression logic", () => {
  assert.match(shell, /findOriginalNav/);
  assert.match(shell, /\.sidebar nav button/);
  assert.match(shell, /originalLessonButtons\(\)\[index\]\?\.click\(\)/);
  assert.doesNotMatch(shell, /setProgress\(/);
  assert.doesNotMatch(shell, /markComplete\(/);
  assert.doesNotMatch(shell, /serverScores/);
});

test("video analysis entry uses the canonical local-first workspace", () => {
  const matches = shell.match(/window\.location\.assign\("\/phan-tich-video"\)/g) ?? [];
  assert.ok(matches.length >= 2);
  assert.match(shell, /Phân tích video/);
  assert.match(shell, /LOCAL-FIRST/);
  assert.doesNotMatch(shell, /fetch\(/);
});

test("student role shell exposes learner capabilities without teacher or admin controls", () => {
  for (const label of ["Lộ trình học", "Bài học", "Thực hành", "Phân tích video", "Ôn tập", "Kiểm tra", "Kết quả", "Hồ sơ", "Frog AI"]) {
    assert.ok(shell.includes(label), `missing learner capability: ${label}`);
  }
  assert.doesNotMatch(shell, /Xin quyền chỉnh sửa|Sửa bản riêng|Duyệt video|Quản trị|Giảng viên Pro/);
});

test("root layout mounts the role adapter once and keeps styling isolated", () => {
  assert.match(layout, /import StudentRoleShell from "\.\/student-role-shell"/);
  assert.match(layout, /import "\.\/student-role-shell\.css"/);
  assert.equal((layout.match(/<StudentRoleShell \/>/g) ?? []).length, 1);
  assert.match(css, /data-student-section="overview"/);
  assert.match(css, /\.page-overview \{ display: none !important; \}/);
});
