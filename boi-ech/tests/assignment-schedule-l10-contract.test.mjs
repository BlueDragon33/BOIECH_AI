import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const teacherAction = fs.readFileSync(new URL("../app/api/teacher/action/route.ts", import.meta.url), "utf8");
const statusRoute = fs.readFileSync(new URL("../app/api/course/teacher-actions/status/route.ts", import.meta.url), "utf8");
const inboxRoute = fs.readFileSync(new URL("../app/api/course/teacher-actions/route.ts", import.meta.url), "utf8");
const teacherApi = fs.readFileSync(new URL("../app/api/teacher/overview/route.ts", import.meta.url), "utf8");
const studentInbox = fs.readFileSync(new URL("../app/student-teacher-inbox.tsx", import.meta.url), "utf8");
const teacherShell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const schedule = fs.readFileSync(new URL("../app/teacher-assignment-schedule.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("L10 teacher assignments accept an optional bounded due date", () => {
  assert.match(teacherAction, /normalizeDueAt/);
  assert.match(teacherAction, /90 \* 86_400_000/);
  assert.match(teacherAction, /cleanText\(payload\.dueAt, 80\)/);
  assert.match(teacherAction, /Hạn hoàn thành phải là thời điểm hợp lệ trong 90 ngày tới/);
  assert.match(teacherAction, /dueAt/);
});

test("L10 learner assignment status requires signed ownership of the assignment", () => {
  assert.match(statusRoute, /verifyDeviceRequest\(payload, previewRequest\)/);
  assert.match(statusRoute, /learner\.personRole !== "learner"/);
  assert.match(statusRoute, /event_type = 'teacher_assignment'/);
  assert.match(statusRoute, /id = \?/);
  assert.match(statusRoute, /device_id = \?/);
  assert.match(statusRoute, /learner_assignment_status/);
  assert.match(statusRoute, /INSERT INTO course_audit_log/);
  assert.doesNotMatch(statusRoute, /UPDATE device_profiles|scores_json\s*=|videoBlob|imageData|frameData/);
});

test("L10 learner inbox exposes due date and three real status controls", () => {
  assert.match(inboxRoute, /learner_assignment_status/);
  assert.match(inboxRoute, /assignmentStatus/);
  assert.match(inboxRoute, /dueAt/);
  assert.match(studentInbox, /\/api\/course\/teacher-actions\/status/);
  assert.match(studentInbox, /Đã nhận/);
  assert.match(studentInbox, /Đã hoàn thành/);
  assert.match(studentInbox, /Cần hỗ trợ/);
  assert.match(studentInbox, /Hạn hoàn thành/);
});

test("L10 teacher overview builds a real assignment schedule inside the authorized teacher class set", () => {
  assert.match(teacherApi, /teacher_assignment', 'learner_assignment_status/);
  assert.match(teacherApi, /da\.person_role = 'learner'/);
  assert.match(teacherApi, /da\.status = 'approved'/);
  assert.match(teacherApi, /lower\(trim\(da\.class_name\)\) IN \(\$\{classPlaceholders\}\)/);
  assert.match(teacherApi, /\.bind\(\.\.\.teacherClasses\)/);
  assert.match(teacherApi, /latestStatusByAssignment/);
  assert.match(teacherApi, /scheduleState/);
  assert.match(teacherApi, /assignments,/);
});

test("L10 replaces the simulated schedule with assignment data", () => {
  assert.match(teacherShell, /TeacherAssignmentSchedule/);
  assert.match(teacherShell, /overview\?\.assignments/);
  assert.match(teacherShell, /type="datetime-local"/);
  assert.match(teacherShell, /dueAt: dueAt \? new Date\(dueAt\)\.toISOString\(\) : ""/);
  assert.doesNotMatch(teacherShell, /Đây là gợi ý giám sát, không giả lập lịch calendar chưa có backend/);
  assert.match(schedule, /Bài luyện có hạn và trạng thái thực tế/);
  assert.match(schedule, /Quá hạn/);
});

test("L10 styles load after L9", () => {
  const l9 = layout.indexOf('import "./two-way-messaging-l9.css"');
  const l10 = layout.indexOf('import "./assignment-schedule-l10.css"');
  assert.ok(l9 >= 0);
  assert.ok(l10 > l9);
});
