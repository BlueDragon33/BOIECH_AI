import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../app/api/teacher/roster/route.ts", import.meta.url), "utf8");
const manager = fs.readFileSync(new URL("../app/teacher-roster-manager.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const classWorkspace = fs.readFileSync(new URL("../app/teacher-class-workspace.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/teacher-roster-sync-v9.css", import.meta.url), "utf8");

test("teacher roster API is signed and scoped to learner role plus authorized teacher classes", () => {
  assert.match(route, /verifyDeviceRequest\(payload, previewRequest\)/);
  assert.match(route, /teacher\.personRole !== "teacher"/);
  assert.match(route, /person_role = 'learner'/);
  assert.match(route, /teacherClassNames\(teacher\.className\)/);
  assert.match(route, /lower\(trim\(class_name\)\) IN \(\$\{classPlaceholders\}\)/);
  assert.match(route, /\.bind\(personCode, \.\.\.teacherClasses\)/);
  assert.match(route, /LEARNER_NOT_IN_TEACHER_CLASS/);
});

test("teacher roster removal is reversible blocking rather than hard deletion", () => {
  assert.match(route, /SET status = 'blocked'/);
  assert.match(route, /teacher_roster_removed/);
  assert.match(route, /reversible: true/);
  assert.doesNotMatch(route, /DELETE FROM device_access/);
});

test("teacher roster approval requires complete registration and preserves paid access", () => {
  assert.match(route, /LEARNER_REGISTRATION_INCOMPLETE/);
  assert.match(route, /payment_status = 'paid_verified'/);
  assert.match(route, /INSERT INTO device_profiles/);
  assert.match(route, /teacher_roster_approved/);
});

test("teacher roster response does not expose phone or device keys to the client", () => {
  const itemStart = route.indexOf("function rosterItem");
  const itemEnd = route.indexOf("async function listRoster");
  const itemBody = route.slice(itemStart, itemEnd);
  assert.ok(itemStart >= 0 && itemEnd > itemStart);
  assert.doesNotMatch(itemBody, /phone\s*:/);
  assert.doesNotMatch(itemBody, /deviceId|displayCode|publicKey|public_key/);
});

test("teacher roster manager supports manual sync and 60-second visible-tab refresh", () => {
  assert.match(manager, /Đồng bộ dữ liệu/);
  assert.match(manager, /Tự cập nhật 60 giây/);
  assert.match(manager, /window\.setInterval\([\s\S]*60_000/);
  assert.match(manager, /document\.visibilityState === "visible"/);
  assert.match(manager, /\/api\/teacher\/roster/);
  assert.match(manager, /boi-ech:teacher-roster-changed/);
});

test("teacher learner management exposes approve remove and restore without fake deletion", () => {
  assert.match(manager, /Phê duyệt/);
  assert.match(manager, /Loại khỏi lớp/);
  assert.match(manager, /Khôi phục/);
  assert.match(manager, /khóa truy cập nhưng có thể được khôi phục/);
  assert.match(manager, /registrationComplete/);
});

test("teacher shell provides sync and roster mounts and refreshes overview after roster changes", () => {
  assert.match(shell, /data-teacher-sync-mount="overview"/);
  assert.match(shell, /data-teacher-sync-mount="learners"/);
  assert.match(classWorkspace, /data-teacher-sync-mount="class"/);
  assert.match(shell, /data-teacher-roster-manager-mount/);
  assert.match(shell, /addEventListener\("boi-ech:teacher-roster-changed", onRosterChanged\)/);
});

test("roster V9 loads after visual V8 and remains responsive", () => {
  const v8 = layout.indexOf('import "./teacher-dashboard-visual-v8.css"');
  const v9 = layout.indexOf('import "./teacher-roster-sync-v9.css"');
  assert.ok(v8 >= 0);
  assert.ok(v9 > v8);
  assert.match(layout, /TeacherRosterManager/);
  assert.match(css, /\.teacher-roster-manager/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
