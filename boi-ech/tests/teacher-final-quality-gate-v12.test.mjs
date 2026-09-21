import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
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
    "Hồ sơ",
  ]) assert.ok(shell.includes(`label: "${label}"`), label);
});

test("teacher roster remains signed same-class and reversible", () => {
  assert.match(rosterRoute, /verifyDeviceRequest\(payload, previewRequest\)/);
  assert.match(rosterRoute, /teacher\.personRole !== "teacher"/);
  assert.match(rosterRoute, /person_role = 'learner'/);
  assert.match(rosterRoute, /lower\(trim\(class_name\)\) = lower\(trim\(\?\)\)/);
  assert.match(rosterRoute, /SET status = 'blocked'/);
  assert.doesNotMatch(rosterRoute, /DELETE FROM device_access/);
});

test("teacher roster client does not receive private device identity or phone", () => {
  const itemStart = rosterRoute.indexOf("function rosterItem");
  const itemEnd = rosterRoute.indexOf("async function listRoster", itemStart);
  assert.ok(itemStart >= 0 && itemEnd > itemStart);
  const publicItem = rosterRoute.slice(itemStart, itemEnd);
  assert.doesNotMatch(publicItem, /phone\s*:/);
  assert.doesNotMatch(publicItem, /deviceId|displayCode|publicKey|public_key/);
});

test("roster synchronization is manual plus visible-tab 60-second refresh and role-gated", () => {
  assert.match(roster, /Đồng bộ dữ liệu/);
  assert.match(roster, /60_000/);
  assert.match(roster, /document\.visibilityState === "visible"/);
  assert.match(roster, /document\.body\.dataset\.teacherRoleUi !== "active"/);
  assert.match(roster, /syncGenerationRef/);
  assert.match(roster, /syncedDeviceRef/);
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

test("teacher management surfaces are actually mounted in the application shell", () => {
  assert.match(layout, /<TeacherRoleShell \/>/);
  assert.match(layout, /<TeacherDashboardBlueprint \/>/);
  assert.match(layout, /<TeacherRosterManager \/>/);
});
