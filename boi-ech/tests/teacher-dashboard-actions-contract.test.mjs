import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const teacherRoute = fs.readFileSync(new URL("../app/api/teacher/action/route.ts", import.meta.url), "utf8");
const inboxRoute = fs.readFileSync(new URL("../app/api/course/teacher-actions/route.ts", import.meta.url), "utf8");
const overviewRoute = fs.readFileSync(new URL("../app/api/teacher/overview/route.ts", import.meta.url), "utf8");
const teacherShell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const studentShell = fs.readFileSync(new URL("../app/student-role-shell.tsx", import.meta.url), "utf8");
const studentInbox = fs.readFileSync(new URL("../app/student-teacher-inbox.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/teacher-dashboard-actions-v7.css", import.meta.url), "utf8");

test("teacher actions require signed teacher role and authorized-class learner scope", () => {
  assert.match(teacherRoute, /verifyDeviceRequest\(payload, previewRequest\)/);
  assert.match(teacherRoute, /teacher\.personRole !== "teacher"/);
  assert.match(teacherRoute, /TEACHER_ROLE_REQUIRED/);
  assert.match(teacherRoute, /person_role = 'learner'/);
  assert.match(teacherRoute, /status = 'approved'/);
  assert.match(teacherRoute, /person_code = \?/);
  assert.match(teacherRoute, /teacherClassNames\(teacher\.className\)/);
  assert.match(teacherRoute, /lower\(trim\(class_name\)\) IN \(\$\{classPlaceholders\}\)/);
  assert.match(teacherRoute, /\.bind\(learnerPersonCode, \.\.\.teacherClasses\)/);
});

test("teacher actions persist only bounded text supervision events and an audit trail", () => {
  assert.match(teacherRoute, /teacher_feedback/);
  assert.match(teacherRoute, /teacher_assignment/);
  assert.match(teacherRoute, /teacher_analysis_review/);
  assert.match(teacherRoute, /INSERT INTO course_activity_events/);
  assert.match(teacherRoute, /INSERT INTO course_audit_log/);
  assert.match(teacherRoute, /cleanText\(payload\.note, 1200\)/);
  assert.match(teacherRoute, /cleanText\(payload\.title, 160\)/);
  assert.doesNotMatch(teacherRoute, /UPDATE device_profiles|scores_json\s*=|qualityScore|PHASE_THRESHOLDS/);
  assert.doesNotMatch(teacherRoute, /videoBlob|base64|frameData|imageData|thumbnail/);
});

test("learner inbox returns teacher guidance only for the signed learner device", () => {
  assert.match(inboxRoute, /verifyDeviceRequest\(payload, previewRequest\)/);
  assert.match(inboxRoute, /learner\.personRole !== "learner"/);
  assert.match(inboxRoute, /LEARNER_ROLE_REQUIRED/);
  assert.match(inboxRoute, /WHERE device_id = \?/);
  assert.match(inboxRoute, /\.bind\(learner\.deviceId\)/);
  assert.match(inboxRoute, /LIMIT 20/);
  assert.doesNotMatch(inboxRoute, /phone|public_key_jwk|videoBlob|imageData|frameData/);
});

test("teacher overview exposes latest intervention state without learner media", () => {
  assert.match(overviewRoute, /teacher_action_count/);
  assert.match(overviewRoute, /last_teacher_action_type/);
  assert.match(overviewRoute, /last_teacher_action_json/);
  assert.match(overviewRoute, /teacherActionSummary/);
  assert.match(overviewRoute, /latestTeacherAction/);
  assert.doesNotMatch(overviewRoute, /SELECT[^\`]*da\.phone/s);
});

test("teacher dashboard wires feedback assignment review and CSV export to real actions", () => {
  assert.match(teacherShell, /fetch\("\/api\/teacher\/action"/);
  assert.match(teacherShell, /data-server-feedback/);
  assert.match(teacherShell, /data-server-review/);
  assert.match(teacherShell, /Giao bài luyện/);
  assert.match(teacherShell, /Nhận xét chuyên môn/);
  assert.match(teacherShell, /Review chỉ ghi nhận trạng thái giám sát, không sửa score/);
  assert.match(teacherShell, /exportTeacherReport/);
  assert.match(teacherShell, /text\/csv;charset=utf-8/);
});

test("learner dashboard receives server-synced teacher actions through a separate network adapter", () => {
  assert.doesNotMatch(studentShell, /fetch\(/);
  assert.match(studentShell, /data-student-teacher-inbox-mount/);
  assert.match(studentInbox, /fetch\("\/api\/course\/teacher-actions"/);
  assert.match(studentInbox, /TỪ GIẢNG VIÊN/);
  assert.match(studentInbox, /Hướng dẫn mới nhất dành cho bạn/);
  assert.match(studentInbox, /data-teacher-action-type=\{item\.type\}/);
  assert.match(studentInbox, /item\.type === "assignment"/);
  assert.match(studentInbox, /Mở thực hành/);
});

test("actions V7 styles load last and keep modal/inbox responsive", () => {
  const data = layout.indexOf('import "./teacher-dashboard-data-v6.css"');
  const actions = layout.indexOf('import "./teacher-dashboard-actions-v7.css"');
  assert.ok(data >= 0);
  assert.ok(actions > data);
  assert.match(css, /\.teacher-action-dialog/);
  assert.match(css, /\.student-teacher-inbox/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
