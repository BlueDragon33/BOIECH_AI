import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const student = fs.readFileSync(new URL("../app/student-role-shell.tsx", import.meta.url), "utf8");
const coach = fs.readFileSync(new URL("../app/student-adaptive-coach.tsx", import.meta.url), "utf8");
const teacher = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const teacherApi = fs.readFileSync(new URL("../app/api/teacher/overview/route.ts", import.meta.url), "utf8");

test("L6 mounts adaptive Learner Model on the learner dashboard", () => {
  assert.match(layout, /import StudentAdaptiveCoach from "\.\/student-adaptive-coach"/);
  assert.match(layout, /<StudentAdaptiveCoach\s*\/>/);
  assert.match(layout, /student-adaptive-coach\.css/);
  assert.match(student, /data-student-adaptive-mount/);
});

test("L6 reuses the existing signed Frog AI bootstrap instead of inventing another model API", () => {
  assert.match(coach, /\/api\/ai\/mentor/);
  assert.match(coach, /action:\s*"bootstrap"/);
  assert.match(coach, /priorityLesson/);
  assert.match(coach, /todayPlan/);
  assert.match(coach, /competencies/);
  assert.match(coach, /alerts/);
  assert.doesNotMatch(coach, /\/api\/video-analysis|MediaPipe|poseLandmark|PHASE_THRESHOLDS/);
});

test("L6 keeps adaptive recommendations explainable and user-actionable", () => {
  assert.match(coach, /item\.reason/);
  assert.match(coach, /openPlanItem/);
  assert.match(coach, /Bài luyện thích ứng/);
  assert.match(coach, /dataPolicy/);
});

test("L6 exposes learner intelligence signals to the teacher overview", () => {
  assert.match(teacherApi, /learnerIntelligence/);
  assert.match(teacherApi, /priorityLesson/);
  assert.match(teacherApi, /averageMastery/);
  assert.match(teacherApi, /adaptive/);
  assert.match(teacher, /adaptive/);
  assert.match(teacher, /supportReason/);
});

test("L6 does not change scoring or video privacy boundaries", () => {
  assert.doesNotMatch(coach, /qualityScore|signalScore|PHASE_THRESHOLDS|mediaStored/);
  assert.doesNotMatch(coach, /localStorage|sessionStorage/);
});
