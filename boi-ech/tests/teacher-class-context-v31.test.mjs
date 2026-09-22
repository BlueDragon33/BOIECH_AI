import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../app/teacher-class-workspace.tsx", import.meta.url), "utf8");
const videoPage = fs.readFileSync(new URL("../app/phan-tich-video/page.tsx", import.meta.url), "utf8");
const editorPage = fs.readFileSync(new URL("../app/bien-tap-noi-dung/page.tsx", import.meta.url), "utf8");

test("V31 scopes quick alerts to the selected class", () => {
  assert.match(workspace, /selected\?\.learners\.filter\(\(item\) => item\.needsSupport\)/);
  assert.doesNotMatch(workspace, /const supportLearners = learners\.filter/);
  assert.match(workspace, /Không có học viên cần can thiệp trong lớp đang chọn/);
});

test("V31 keeps selected class outside the class-tab component", () => {
  assert.match(workspace, /selectedClass: string/);
  assert.match(workspace, /onSelectedClassChange: \(className: string\) => void/);
  assert.doesNotMatch(workspace, /const \[selectedClass,\s*setSelectedClass\]\s*=\s*useState/);
  assert.match(workspace, /onSelectedClassChange\(item\.name\)/);
  assert.match(shell, /selectedClass=\{selectedClass\}/);
  assert.match(shell, /onSelectedClassChange=\{setSelectedClass\}/);
});

test("V31 persists selected class across teacher tab and full-page return flows", () => {
  assert.match(shell, /boi-ech-teacher-selected-class-v31/);
  assert.match(shell, /window\.sessionStorage\.setItem/);
  assert.match(shell, /params\.get\("class"\)/);
  assert.match(shell, /setSelectedClass\(requestedClass\)/);
  assert.match(shell, /openTeacherEditor\("01", "class", selectedClass\)/);
});

test("V31 propagates class context through editor and video return links", () => {
  assert.match(shell, /classQuery = className\.trim\(\)/);
  assert.match(editorPage, /params\.class/);
  assert.match(editorPage, /classQuery/);
  assert.match(editorPage, /workspace=teacher&tab=/);
  assert.match(videoPage, /searchParams\.get\("class"\)/);
  assert.match(videoPage, /classQuery/);
  assert.match(videoPage, /workspace=teacher&tab=/);
});

test("V31 still bounds class query input", () => {
  assert.match(shell, /\.trim\(\)\.slice\(0, 100\)/);
  assert.match(editorPage, /\.trim\(\)\.slice\(0, 100\)/);
  assert.match(videoPage, /\.trim\(\)\.slice\(0, 100\)/);
});
