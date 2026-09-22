import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync(new URL("../app/teacher-class-workspace.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/teacher-class-actions-v33.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("V33 class actions carry the selected class into tasks and reports", () => {
  assert.match(workspace, /onOpenTasks: \(className: string\) => void/);
  assert.match(workspace, /onOpenReports: \(className: string\) => void/);
  assert.match(workspace, /onOpenTasks\(selected\.name\)/);
  assert.match(workspace, /onOpenReports\(selected\.name\)/);
  assert.match(shell, /onOpenTasks=\{\(scopeClass\) => \{ setWorkScopeClass\(scopeClass\); setTab\("tasks"\); \}\}/);
  assert.match(shell, /onOpenReports=\{\(scopeClass\) => \{ setWorkScopeClass\(scopeClass\); setTab\("reports"\); \}\}/);
});

test("V33 exposes an explicit all-classes or one-class scope selector", () => {
  assert.match(shell, /function TeacherClassScopeBar/);
  assert.match(shell, /PHẠM VI LỚP/);
  assert.match(shell, /Tất cả lớp phụ trách/);
  assert.match(shell, /<option value="">Tất cả lớp<\/option>/);
  assert.match(shell, /classes\.map\(\(name\) => <option/);
});

test("V33 tasks and reports operate on scoped learners instead of silently mixing classes", () => {
  assert.match(shell, /const workScopedLearners = canonicalWorkScope \? learners\.filter/);
  assert.match(shell, /const workScopedSupport = workScopedLearners\.filter/);
  assert.match(shell, /<TeacherSmartInterventions learners=\{workScopedLearners\}/);
  assert.match(shell, /LearnerTable learners=\{workScopedSupport\.length \? workScopedSupport : workScopedLearners\}/);
  assert.match(shell, /<TeacherLearningAnalyticsPanel learners=\{workScopedLearners\}/);
  assert.match(shell, /exportTeacherReport\(workScopedLearners, canonicalWorkScope \|\| className\)/);
});

test("V33 content editor keeps the active work scope on the return path", () => {
  assert.match(shell, /openTeacherEditor\("01", "tasks", canonicalWorkScope\)/);
  assert.match(shell, /boi-ech-teacher-work-scope-v33/);
  assert.match(shell, /sessionStorage\.setItem\("boi-ech-teacher-work-scope-v33"/);
});

test("V33 only accepts an authorized class name as the effective work scope", () => {
  assert.match(shell, /teacherClasses\.find\(\(name\) => name\.toLocaleLowerCase\("vi"\) === workScopeClass\.trim\(\)\.toLocaleLowerCase\("vi"\)\) \?\? ""/);
  assert.match(shell, /canonicalWorkScope/);
});

test("V33 scope control follows the modern teacher design and loads after V32", () => {
  const v32 = layout.indexOf('import "./teacher-class-filter-v32.css"');
  const v33 = layout.indexOf('import "./teacher-class-actions-v33.css"');
  assert.ok(v32 >= 0 && v33 > v32);
  assert.match(css, /\.teacher-class-scope-bar/);
  assert.match(css, /\.teacher-class-scope-bar select/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 480px\)/);
});
