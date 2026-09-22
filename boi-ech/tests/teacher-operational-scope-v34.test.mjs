import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");

test("V34 derives scoped messages and assignments from the authorized work scope", () => {
  assert.match(shell, /const workScopedMessages = canonicalWorkScope \? \(overview\?\.messages \?\? \[\]\)\.filter/);
  assert.match(shell, /item\.className\.trim\(\)\.toLocaleLowerCase\("vi"\) === canonicalWorkScope\.toLocaleLowerCase\("vi"\)/);
  assert.match(shell, /const workScopedAssignments = canonicalWorkScope \? \(overview\?\.assignments \?\? \[\]\)\.filter/);
});

test("V34 analysis uses the same class scope for local workspace and queue", () => {
  assert.match(shell, /teacherVideoHref\("analysis", canonicalWorkScope\)/);
  assert.match(shell, /<AnalysisQueue learners=\{workScopedLearners\}/);
});

test("V34 messages never reply through a learner outside the active scope", () => {
  assert.match(shell, /<TeacherTwoWayMessages messages=\{workScopedMessages\}/);
  assert.match(shell, /const target = workScopedLearners\.find\(\(item\) => item\.personCode === personCode\)/);
});

test("V34 schedule is class scoped and opens only scoped learners", () => {
  assert.match(shell, /<TeacherAssignmentSchedule assignments=\{workScopedAssignments\}/);
  assert.match(shell, /<TeacherClassScopeBar classes=\{teacherClasses\} value=\{canonicalWorkScope\} learnerCount=\{workScopedLearners\.length\} onChange=\{setWorkScopeClass\}/);
});

test("V34 preserves all-classes behavior when no explicit scope is selected", () => {
  assert.match(shell, /: \(overview\?\.messages \?\? \[\]\)/);
  assert.match(shell, /: \(overview\?\.assignments \?\? \[\]\)/);
});
