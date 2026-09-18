import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const replyRoute = fs.readFileSync(new URL("../app/api/course/teacher-actions/reply/route.ts", import.meta.url), "utf8");
const inboxRoute = fs.readFileSync(new URL("../app/api/course/teacher-actions/route.ts", import.meta.url), "utf8");
const teacherApi = fs.readFileSync(new URL("../app/api/teacher/overview/route.ts", import.meta.url), "utf8");
const studentInbox = fs.readFileSync(new URL("../app/student-teacher-inbox.tsx", import.meta.url), "utf8");
const teacherShell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const teacherMessages = fs.readFileSync(new URL("../app/teacher-two-way-messages.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("L9 learner replies require signed learner identity and a teacher action owned by the same device", () => {
  assert.match(replyRoute, /verifyDeviceRequest\(payload, previewRequest\)/);
  assert.match(replyRoute, /learner\.personRole !== "learner"/);
  assert.match(replyRoute, /WHERE id = \? AND device_id = \?/);
  assert.match(replyRoute, /TEACHER_ACTIONS\.has\(original\.event_type\)/);
  assert.match(replyRoute, /cleanText\(payload\.message, 1000\)/);
});

test("L9 replies are bounded idempotent audited events", () => {
  assert.match(replyRoute, /learner_teacher_reply/);
  assert.match(replyRoute, /clientEventId/);
  assert.match(replyRoute, />= 5/);
  assert.match(replyRoute, /INSERT INTO course_audit_log/);
  assert.doesNotMatch(replyRoute, /UPDATE device_profiles|scores_json\s*=|videoBlob|imageData|frameData/);
});

test("L9 learner inbox returns reply history only for the signed learner", () => {
  assert.match(inboxRoute, /WHERE device_id = \?/);
  assert.match(inboxRoute, /event_type = 'learner_teacher_reply'/);
  assert.match(inboxRoute, /replies:/);
  assert.match(studentInbox, /\/api\/course\/teacher-actions\/reply/);
  assert.match(studentInbox, /Phản hồi Giảng viên/);
  assert.match(studentInbox, /Phản hồi của bạn/);
});

test("L9 teacher sees replies only from approved learners in the same class", () => {
  assert.match(teacherApi, /e\.event_type = 'learner_teacher_reply'/);
  assert.match(teacherApi, /da\.person_role = 'learner'/);
  assert.match(teacherApi, /da\.status = 'approved'/);
  assert.match(teacherApi, /lower\(trim\(da\.class_name\)\) = lower\(trim\(\?\)\)/);
  assert.match(teacherApi, /messages,/);
  assert.doesNotMatch(teacherApi, /SELECT[^\`]*da\.phone/s);
});

test("L9 replaces the fake message placeholder with real reply UI", () => {
  assert.match(teacherShell, /TeacherTwoWayMessages/);
  assert.match(teacherShell, /overview\?\.messages/);
  assert.doesNotMatch(teacherShell, /hộp chat hai chiều chưa có backend/);
  assert.match(teacherMessages, /Trả lời bằng nhận xét/);
  assert.match(teacherMessages, /Phản hồi hai chiều/);
});

test("L9 styles load after L8", () => {
  const l8 = layout.indexOf('import "./teacher-smart-interventions-l8.css"');
  const l9 = layout.indexOf('import "./two-way-messaging-l9.css"');
  assert.ok(l8 >= 0);
  assert.ok(l9 > l8);
});
