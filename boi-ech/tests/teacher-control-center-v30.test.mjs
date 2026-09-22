import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const classWorkspace = fs.readFileSync(new URL("../app/teacher-class-workspace.tsx", import.meta.url), "utf8");
const overview = fs.readFileSync(new URL("../app/api/teacher/overview/route.ts", import.meta.url), "utf8");
const action = fs.readFileSync(new URL("../app/api/teacher/action/route.ts", import.meta.url), "utf8");
const roster = fs.readFileSync(new URL("../app/api/teacher/roster/route.ts", import.meta.url), "utf8");
const admin = fs.readFileSync(new URL("../app/api/admin/devices/route.ts", import.meta.url), "utf8");
const deviceManager = fs.readFileSync(new URL("../app/quan-ly-thiet-bi/device-manager.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const videoPage = fs.readFileSync(new URL("../app/phan-tich-video/page.tsx", import.meta.url), "utf8");
const editorPage = fs.readFileSync(new URL("../app/bien-tap-noi-dung/page.tsx", import.meta.url), "utf8");
const editor = fs.readFileSync(new URL("../app/bien-tap-noi-dung/editor-workspace.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/teacher-control-center-v30.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("V30 supports multiple admin-assigned classes without broadening teacher access", () => {
  assert.match(admin, /action === "teacher-classes"/);
  assert.match(admin, /exists\.person_role !== "teacher"/);
  assert.match(admin, /normalizeTeacherClasses\(payload\.teacherClasses\)/);
  assert.match(admin, /teacher_classes_updated/);
  assert.match(deviceManager, /Lớp Giảng viên phụ trách/);
  assert.match(deviceManager, /Lưu lớp phụ trách/);

  for (const source of [overview, action, roster]) {
    assert.match(source, /teacherClassNames\(teacher\.className\)/);
    assert.match(source, /classPlaceholders/);
    assert.match(source, /\.bind\([^\n]*\.\.\.teacherClasses/);
  }
  assert.match(overview, /classes: teacherClasses/);
  assert.match(action, /learner\.class_name \|\| teacherClasses\[0\]/);
  assert.match(roster, /target\.class_name \|\| teacherClasses\[0\]/);
});

test("V30 class page is a real multi-class control center backed by learner data", () => {
  for (const contract of [
    "teacher-class-control-header",
    "teacher-class-control-toolbar",
    "teacher-class-card-grid",
    "teacher-class-reference-rail",
    "Cảnh báo nhanh",
    "Lịch nhiệm vụ",
    "Việc cần xử lý",
    "Biên tập nội dung bài giảng",
  ]) assert.ok(classWorkspace.includes(contract), contract);
  assert.match(classWorkspace, /learners\.filter/);
  assert.match(classWorkspace, /averageProgress/);
  assert.match(classWorkspace, /onOpenLearners/);
  assert.match(classWorkspace, /onOpenTasks/);
  assert.match(classWorkspace, /onOpenReports/);
  assert.match(classWorkspace, /onOpenAnalysis/);
  assert.match(classWorkspace, /onOpenEditor/);
  assert.doesNotMatch(classWorkspace, /32|52|78%|K01|K02|K03/);
  assert.match(shell, /<TeacherClassWorkspace/);
});

test("video analysis is the final teacher navigation item", () => {
  const rows = shell.match(/const rows:[\s\S]*?;\n  return/)?.[0] ?? "";
  assert.ok(rows.indexOf('id: "profile"') >= 0);
  assert.ok(rows.indexOf('id: "analysis"') > rows.indexOf('id: "profile"'));
});

test("lesson editor uses one canonical functional route instead of clicking hidden legacy UI", () => {
  const open = shell.match(/function openTeacherEditor[\s\S]*?\n}/)?.[0] ?? "";
  assert.match(open, /\/bien-tap-noi-dung\?lesson=/);
  assert.match(open, /return=teacher/);
  assert.doesNotMatch(open, /personal-edit-trigger|editor-request-link|\.click\(/);
  assert.match(shell, /teacher-editor-main-cta/);
  assert.match(classWorkspace, /onOpenEditor/);
});

test("teacher return context survives video and editor flows", () => {
  assert.match(videoPage, /useSearchParams/);
  assert.match(videoPage, /returnMode === "teacher"/);
  assert.match(videoPage, /workspace=teacher&tab=/);
  assert.match(editorPage, /requireChatGPTUser\(editorHref\)/);
  assert.match(editorPage, /return=teacher&tab=/);
  assert.match(editorPage, /returnHref=\{returnHref\}/);
  assert.match(editor, /Link href=\{returnHref\}/);
  assert.doesNotMatch(editor, /<Link href="\/">← Trở lại khóa học<\/Link>/);
});

test("teacher role is structural and legacy learner content is suppressed before adapter styling", () => {
  assert.match(page, /data-person-role=\{deviceAccess\.personRole \?\? ""\}/);
  assert.match(shell, /shell\?\.dataset\.personRole/);
  assert.match(css, /\.app-shell\[data-person-role="teacher"\] \.main-area > \.page/);
  assert.match(css, /display:\s*none !important/);
});

test("V30 modern design layer loads after V29 and styles all teacher work surfaces", () => {
  const v29 = layout.indexOf('import "./teacher-dashboard-usability-v29.css"');
  const v30 = layout.indexOf('import "./teacher-control-center-v30.css"');
  assert.ok(v29 >= 0 && v30 > v29);
  assert.match(css, /\.teacher-class-card-grid/);
  assert.match(css, /\.teacher-class-detail-grid/);
  assert.match(css, /\.teacher-page > header/);
  assert.match(css, /\.teacher-learning-analytics/);
  assert.match(css, /\.teacher-smart-interventions/);
  assert.match(css, /\.teacher-two-way-messages/);
  assert.match(css, /\.teacher-assignment-schedule/);
  assert.match(css, /@media \(max-width: 620px\)/);
});
