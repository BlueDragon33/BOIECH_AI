import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/teacher/overview/route.ts", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/teacher-role-shell.css", import.meta.url), "utf8");

test("teacher shell activates only for the registered teacher role", () => {
  assert.match(shell, /role === "Giảng viên"/);
  assert.doesNotMatch(shell, /role === "Học viên"/);
  assert.match(shell, /document\.body\.dataset\.teacherRoleUi = "active"/);
  assert.match(css, /body\[data-teacher-role-ui="active"\]/);
});

test("teacher oversight API requires signed teacher access and scopes learners to assigned classes", () => {
  assert.match(route, /verifyDeviceRequest\(payload, previewRequest\)/);
  assert.match(route, /teacher\.personRole !== "teacher"/);
  assert.match(route, /TEACHER_ROLE_REQUIRED/);
  assert.match(route, /teacherClassNames\(teacher\.className\)/);
  assert.match(route, /da\.person_role = 'learner'/);
  assert.match(route, /lower\(trim\(da\.class_name\)\) IN \(\$\{classPlaceholders\}\)/);
  assert.match(route, /\.bind\(\.\.\.teacherClasses\)/);
});

test("teacher supervision returns learning evidence without learner phone or original media", () => {
  assert.match(route, /completed_json/);
  assert.match(route, /scores_json/);
  assert.match(route, /total_active_seconds/);
  assert.match(route, /video_ai_analysis/);
  assert.match(route, /mediaStored: false/);
  assert.doesNotMatch(route, /SELECT[^`]*da\.phone/s);
  assert.doesNotMatch(route, /videoBlob|base64|thumbnail|imageData|frameData/);
});

test("teacher UI exposes supervision functions and keeps video review media-free", () => {
  for (const label of ["Tổng quan", "Lớp học", "Học viên", "Phân tích video", "Báo cáo", "Lịch giám sát", "Hồ sơ", "Biên tập bài giảng"]) {
    assert.ok(shell.includes(label), `missing teacher capability: ${label}`);
  }
  assert.match(shell, /Video gốc không được lưu trên máy chủ/);
  assert.match(shell, /\/phan-tich-video/);
  assert.match(shell, /\/bien-tap-noi-dung/);
  assert.doesNotMatch(shell, /Duyệt video học viên|Tải video học viên từ server/);
});

test("root layout mounts learner and teacher role adapters exactly once", () => {
  assert.match(layout, /import TeacherRoleShell from "\.\/teacher-role-shell"/);
  assert.match(layout, /import "\.\/teacher-role-shell\.css"/);
  assert.equal((layout.match(/<TeacherRoleShell \/>/g) ?? []).length, 1);
  assert.equal((layout.match(/<StudentRoleShell \/>/g) ?? []).length, 1);
});

test("teacher dashboard derives support flags without changing learner scoring", () => {
  assert.match(route, /progress < 50/);
  assert.match(route, /analysis\.confidence < 70/);
  assert.doesNotMatch(route, /UPDATE device_profiles/);
  assert.doesNotMatch(route, /UPDATE course_activity_events/);
  assert.doesNotMatch(route, /PHASE_THRESHOLDS|qualityScore/);
});
