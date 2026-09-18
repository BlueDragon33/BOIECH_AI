import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = fs.readFileSync(new URL("../package.json", import.meta.url), "utf8");
const readiness = fs.readFileSync(new URL("../scripts/validate-release-readiness.mjs", import.meta.url), "utf8");
const prod = fs.readFileSync(new URL("../../.github/workflows/deploy-cloudflare.yml", import.meta.url), "utf8");
const preview = fs.readFileSync(new URL("../../.github/workflows/boi-ech-cloudflare-preview-ci.yml", import.meta.url), "utf8");
const validation = fs.readFileSync(new URL("../../.github/workflows/validate-boi-ech-pr.yml", import.meta.url), "utf8");
const teacherShell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");

test("L11 exposes an automated release-readiness gate", () => {
  assert.match(pkg, /"validate:release":\s*"node scripts\/validate-release-readiness\.mjs"/);
  assert.match(readiness, /Release readiness failed/);
  assert.match(readiness, /manual production boundary/);
});

test("L11 keeps production deployment manual and explicitly confirmed", () => {
  assert.match(prod, /workflow_dispatch:/);
  assert.match(prod, /DEPLOY_PRODUCTION/);
  assert.doesNotMatch(prod, /\bpush\s*:/);
});

test("L11 release audit protects signed role and class boundaries", () => {
  assert.match(readiness, /verifyDeviceRequest/);
  assert.match(readiness, /teacher overview must require teacher role/);
  assert.match(readiness, /teacher overview must remain class-scoped/);
  assert.match(readiness, /learner replies must remain bound to the learner device/);
});

test("L11 treats teacher core surfaces as real workflows, not placeholders", () => {
  assert.match(teacherShell, /TeacherLearningAnalyticsPanel/);
  assert.match(teacherShell, /TeacherSmartInterventions/);
  assert.match(teacherShell, /TeacherTwoWayMessages/);
  assert.match(teacherShell, /TeacherAssignmentSchedule/);
  assert.doesNotMatch(teacherShell, /hộp chat hai chiều chưa có backend/i);
  assert.doesNotMatch(teacherShell, /không giả lập lịch calendar chưa có backend/i);
});

test("L11 CI invokes the readiness audit before release-like builds", () => {
  assert.match(preview, /npm run validate:release/);
  assert.match(validation, /npm run validate:release/);
});
