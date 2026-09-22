import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync(new URL("../app/teacher-class-workspace.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/teacher-reference-layout-v36.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("V36 loads after previous teacher visual layers", () => {
  const previous = layout.indexOf('import "./teacher-class-actions-v33.css"');
  const current = layout.indexOf('import "./teacher-reference-layout-v36.css"');
  assert.ok(previous >= 0 && current > previous);
});

test("V36 class workspace follows compact header, toolbar, class grid and right rail structure", () => {
  assert.match(workspace, /teacher-class-control-header/);
  assert.match(workspace, /teacher-class-control-toolbar/);
  assert.match(workspace, /teacher-class-stage/);
  assert.match(workspace, /teacher-class-card-grid/);
  assert.match(workspace, /teacher-class-reference-rail/);
  assert.match(workspace, /Cảnh báo nhanh/);
  assert.match(workspace, /Lịch nhiệm vụ/);
  assert.match(workspace, /Việc cần xử lý/);
});

test("V36 class cards expose only real connected teacher workflows", () => {
  assert.match(workspace, /onOpenLearners: \(className: string\) => void/);
  assert.match(workspace, /onOpenTasks: \(className: string\) => void/);
  assert.match(workspace, /onOpenReports: \(className: string\) => void/);
  assert.match(workspace, /onOpenAnalysis: \(className: string\) => void/);
  assert.match(workspace, /onOpenEditor: \(className: string\) => void/);
  assert.doesNotMatch(workspace, /Tạo lớp học mới/);
});

test("V36 shell carries selected class scope into learners, tasks, reports and analysis", () => {
  assert.match(shell, /onOpenLearners=\{\(scopeClass\) => \{ setWorkScopeClass\(scopeClass\); setTab\("learners"\); \}\}/);
  assert.match(shell, /onOpenTasks=\{\(scopeClass\) => \{ setWorkScopeClass\(scopeClass\); setTab\("tasks"\); \}\}/);
  assert.match(shell, /onOpenReports=\{\(scopeClass\) => \{ setWorkScopeClass\(scopeClass\); setTab\("reports"\); \}\}/);
  assert.match(shell, /onOpenAnalysis=\{\(scopeClass\) => \{ setWorkScopeClass\(scopeClass\); setTab\("analysis"\); \}\}/);
  assert.match(shell, /<LearnerTable learners=\{workScopedLearners\}/);
});

test("V36 uses a two-column class area plus a bounded right rail on desktop", () => {
  assert.match(css, /\.teacher-class-stage\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 318px/);
  assert.match(css, /\.teacher-reference-v36 \.teacher-class-card-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(290px, 1fr\)\)/);
  assert.match(css, /\.teacher-class-reference-rail/);
});

test("V36 applies the same compact visual system to secondary teacher tabs without raster backgrounds", () => {
  assert.match(css, /Bring the rest of teacher tabs into the same denser visual system/);
  assert.match(css, /\.teacher-page > header/);
  assert.match(css, /\.teacher-white-card/);
  assert.doesNotMatch(css, /url\(/);
});

test("V36 remains responsive across tablet and mobile breakpoints", () => {
  assert.match(css, /@media \(max-width: 1260px\)/);
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 480px\)/);
});
