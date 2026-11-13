import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const enhancements = fs.readFileSync(new URL("../app/teacher-enhancements.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const roster = fs.readFileSync(new URL("../app/teacher-roster-manager.tsx", import.meta.url), "utf8");
const rosterRoute = fs.readFileSync(new URL("../app/api/teacher/roster/route.ts", import.meta.url), "utf8");
const actionRoute = fs.readFileSync(new URL("../app/api/teacher/action/route.ts", import.meta.url), "utf8");
const overviewRoute = fs.readFileSync(new URL("../app/api/teacher/overview/route.ts", import.meta.url), "utf8");
const visual = fs.readFileSync(new URL("../app/teacher-dashboard-visual-v8.css", import.meta.url), "utf8");
const secondary = fs.readFileSync(new URL("../app/teacher-secondary-tabs-v10.css", import.meta.url), "utf8");

test("final teacher UI keeps the reference-oriented visual layers in effective order", () => {
  const v8 = layout.indexOf('import "./teacher-dashboard-visual-v8.css"');
  const rosterV9 = layout.indexOf('import "./teacher-roster-sync-v9.css"');
  const analytics = layout.indexOf('import "./teacher-learning-analytics-l7.css"');
  const interventions = layout.indexOf('import "./teacher-smart-interventions-l8.css"');
  const messages = layout.indexOf('import "./two-way-messaging-l9.css"');
  const schedule = layout.indexOf('import "./assignment-schedule-l10.css"');
  const secondaryV10 = layout.indexOf('import "./teacher-secondary-tabs-v10.css"');
  assert.ok(v8 >= 0);
  assert.ok(rosterV9 > v8);
  assert.ok(analytics > rosterV9);
  assert.ok(interventions > analytics);
  assert.ok(messages > interventions);
  assert.ok(schedule > messages);
  assert.ok(secondaryV10 > schedule);
  assert.match(visual, /--td8-sidebar:\s*220px/);
  assert.match(visual, /--td8-rail:\s*372px/);
  assert.match(visual, /\.teacher-overview-layout\s*\{[\s\S]*var\(--td8-rail\)/);
});

test("all instructor navigation destinations remain present", () => {
  for (const label of [
    "Tổng quan",
    "Lớp học",
    "Học viên",
    "Phân tích video",
    "Bài tập",
    "Báo cáo",
    "Tin nhắn",
    "Lịch dạy",
    "Hồ sơ chuyên môn",
  ]) assert.ok(shell.includes(`label: "${label}"`), label);
});

test("teacher roster is P-256 protected, approved-only, class-scoped and never permits approvals",()=>{
  assert.match(rosterRoute,/verifyDeviceRequest\(payload,false\)/);
  assert.match(rosterRoute,/if\(payload.action!=="list"\)/);
  assert.match(rosterRoute,/teacher.personRole!=="teacher"/);
  assert.match(rosterRoute,/WHERE person_role='learner' AND status='approved'/);
  assert.match(rosterRoute,/teacherClassNames\(teacher.className\)/);
  assert.match(rosterRoute,/lower\(trim\(class_name\)\) IN \(\$\{placeholders\}\)/);
  assert.match(rosterRoute,/\.bind\(\.\.\.classes.map/);
  assert.doesNotMatch(rosterRoute,/UPDATE device_access|DELETE FROM device_access/);
});

test("teacher roster HTTP response omits device keys and private contact",()=>{
  const begin=rosterRoute.indexOf("const roster=(result.results");
  const end=rosterRoute.indexOf("return respond({canManage:false,roster",begin);
  assert.ok(begin>=0&&end>begin);
  const fields=rosterRoute.slice(begin,end);
  assert.match(fields,/name:row.learner_name/);
  assert.match(fields,/className:row.class_name/);
  assert.doesNotMatch(fields,/deviceId:|device_id:|phone:|publicKey:|public_key:/);
  assert.match(rosterRoute,/canManage:false,roster/);
});

test("teacher roster sync is 60s and role-gated, without old toolbar injection",()=>{
  assert.match(roster,/Đồng bộ dữ liệu/);
  assert.match(roster,/60000/);
  assert.match(roster,/!document.hidden/);
  assert.match(roster,/document.body.dataset.teacherRoleUi==="active"/);
  assert.match(roster,/generation.current/);
  assert.match(roster,/device.current/);
  assert.doesNotMatch(roster,/teacher-topbar-sync/);
});

test("teacher interventions remain text-only and cannot mutate canonical AI scoring", () => {
  assert.match(actionRoute, /teacher_feedback/);
  assert.match(actionRoute, /teacher_assignment/);
  assert.match(actionRoute, /teacher_analysis_review/);
  assert.doesNotMatch(actionRoute, /qualityScore|PHASE_THRESHOLDS|scores_json\s*=|UPDATE device_profiles SET scores_json/);
  assert.doesNotMatch(actionRoute, /videoBlob|frameData|imageData|base64|thumbnail/);
});

test("teacher overview remains media-free", () => {
  assert.match(overviewRoute, /mediaStored:\s*false/);
  assert.doesNotMatch(overviewRoute, /videoBlob|frameData|imageData|thumbnailUrl|public_key_jwk|phone:/);
});

test("final visual override uses Vietnamese-safe display font and stays presentation-only", () => {
  assert.match(secondary, /font-family:\s*var\(--role-display-font\) !important/);
  assert.doesNotMatch(secondary, /font-family:\s*Georgia/);
  for (const source of [visual, secondary]) {
    assert.doesNotMatch(source, /fetch\s*\(|\/api\/|localStorage|sessionStorage|indexedDB|qualityScore|PHASE_THRESHOLDS/);
  }
});

test("teacher management surfaces remain mounted only for an active teacher", () => {
  assert.ok(page.includes('deviceAccess.personRole === "teacher" ? <TeacherEnhancements />'));
  for (const name of ["TeacherRoleShell", "TeacherDashboardBlueprint", "TeacherRosterManager"]) {
    assert.ok(enhancements.includes("<" + name + " />"), name);
    assert.ok(!layout.includes("<" + name + " />"), "no global " + name);
  }
});
