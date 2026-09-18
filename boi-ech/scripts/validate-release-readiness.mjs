import fs from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, "..");

function read(relative) {
  return fs.readFileSync(path.join(repoRoot, relative), "utf8");
}

function fail(message) {
  throw new Error(`Release readiness failed: ${message}`);
}

function requireMatch(content, pattern, message) {
  if (!pattern.test(content)) fail(message);
}

function forbidMatch(content, pattern, message) {
  if (pattern.test(content)) fail(message);
}

function walk(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else result.push(full);
  }
  return result;
}

const productionWorkflow = read(".github/workflows/deploy-cloudflare.yml");
const previewWorkflow = read(".github/workflows/deploy-boi-ech-preview.yml");
const validationWorkflow = read(".github/workflows/validate-boi-ech-pr.yml");
const previewCiWorkflow = read(".github/workflows/boi-ech-cloudflare-preview-ci.yml");
const teacherShell = read("boi-ech/app/teacher-role-shell.tsx");
const learnerInbox = read("boi-ech/app/student-teacher-inbox.tsx");
const teacherAction = read("boi-ech/app/api/teacher/action/route.ts");
const learnerReply = read("boi-ech/app/api/course/teacher-actions/reply/route.ts");
const assignmentStatus = read("boi-ech/app/api/course/teacher-actions/status/route.ts");
const teacherOverview = read("boi-ech/app/api/teacher/overview/route.ts");
const videoRoute = read("boi-ech/app/api/video-analysis/route.ts");
const dbSchema = read("boi-ech/db/schema.ts");
const deviceAuth = read("boi-ech/app/device-auth.server.ts");
const deviceClassificationMigration = read("boi-ech/drizzle/0015_device_classification.sql");
const courseProgressMigration = read("boi-ech/drizzle/0002_acoustic_bushwacker.sql");
const phoneUniquenessMigration = read("boi-ech/drizzle/0007_even_joshua_kane.sql");

requireMatch(productionWorkflow, /workflow_dispatch:/, "production deployment must remain manual");
forbidMatch(productionWorkflow, /\bpush\s*:/, "production deployment must not run on push");
requireMatch(productionWorkflow, /DEPLOY_PRODUCTION/, "production deployment must require explicit confirmation");
requireMatch(previewWorkflow, /workflow_dispatch:/, "preview deployment must remain explicitly triggered");
requireMatch(validationWorkflow, /npm run lint[\s\S]*npm test/, "PR validation must lint and test Bơi ếch");
requireMatch(previewCiWorkflow, /npm run lint[\s\S]*npm test/, "preview CI must preserve regressions before build");

for (const [name, content] of [
  ["teacher action", teacherAction],
  ["learner reply", learnerReply],
  ["assignment status", assignmentStatus],
  ["teacher overview", teacherOverview],
]) {
  requireMatch(content, /verifyDeviceRequest/, `${name} must require signed device access`);
}

requireMatch(teacherOverview, /teacher\.personRole !== "teacher"/, "teacher overview must require teacher role");
requireMatch(teacherOverview, /lower\(trim\(da\.class_name\)\) = lower\(trim\(\?\)\)/, "teacher overview must remain class-scoped");
requireMatch(learnerReply, /WHERE id = \? AND device_id = \?/, "learner replies must remain bound to the learner device");
requireMatch(assignmentStatus, /event_type = 'teacher_assignment'/, "assignment status must target a real teacher assignment");
requireMatch(assignmentStatus, /MAX_STATUS_EVENTS_PER_ASSIGNMENT/, "assignment status changes must be bounded");
requireMatch(assignmentStatus, /latestStatus === status/, "duplicate assignment status transitions must be ignored");

requireMatch(teacherShell, /TeacherLearningAnalyticsPanel/, "Learning Analytics surface is missing");
requireMatch(teacherShell, /TeacherSmartInterventions/, "Smart Intervention surface is missing");
requireMatch(teacherShell, /TeacherTwoWayMessages/, "two-way messaging surface is missing");
requireMatch(teacherShell, /TeacherAssignmentSchedule/, "real assignment schedule surface is missing");
requireMatch(learnerInbox, /\/api\/course\/teacher-actions\/reply/, "learner reply channel is missing");
requireMatch(learnerInbox, /\/api\/course\/teacher-actions\/status/, "learner assignment status channel is missing");

const obsoletePlaceholderPatterns = [
  /Kênh nhắn tin máy chủ chưa được triển khai/i,
  /hộp chat hai chiều chưa có backend/i,
  /Đây là gợi ý giám sát, không giả lập lịch calendar chưa có backend/i,
  /coming soon/i,
  /not implemented/i,
];
for (const pattern of obsoletePlaceholderPatterns) {
  forbidMatch(teacherShell, pattern, `obsolete teacher placeholder remains: ${pattern}`);
}

const communicationAndSchedule = [teacherAction, learnerReply, assignmentStatus, teacherOverview].join("\n");
forbidMatch(
  communicationAndSchedule,
  /videoBlob|frameData|imageData|thumbnailBase64|data:image\//i,
  "teacher communication/schedule APIs must remain media-free",
);
requireMatch(videoRoute, /rejectBinaryPayload|binary-looking|BINARY_PAYLOAD|forbidden/i, "video API must retain binary/media payload protection");

for (const column of ["device_type", "platform", "browser", "user_agent"]) {
  if (!deviceClassificationMigration.includes("ADD COLUMN `" + column + "`")) fail(`classification migration must add ${column}`);
  if (!dbSchema.includes(`text("${column}")`)) fail(`Drizzle schema must include ${column}`);
  if (!deviceAuth.includes(column)) fail(`fresh/local device bootstrap must include ${column}`);
}
requireMatch(dbSchema, /device_access_type_status_idx/, "Drizzle schema must include the device classification index");
requireMatch(deviceAuth, /PRAGMA table_info\(device_access\)/, "local DB bootstrap must inspect legacy classification columns");
requireMatch(deviceAuth, /CREATE INDEX IF NOT EXISTS device_access_type_status_idx/, "local DB bootstrap must repair the classification index");

for (const column of ["attempts_json", "total_active_seconds", "last_activity_at", "last_lesson", "last_part"]) {
  if (!courseProgressMigration.includes("device_profiles") || !courseProgressMigration.includes(column)) fail(`progress migration must include ${column}`);
  if (!dbSchema.includes(column)) fail(`Drizzle device_profiles schema must include ${column}`);
  if (!deviceAuth.includes(column)) fail(`fresh/local device_profiles bootstrap must include ${column}`);
}
requireMatch(deviceAuth, /PRAGMA table_info\(device_profiles\)/, "local DB bootstrap must inspect legacy profile columns");
requireMatch(phoneUniquenessMigration, /device_access_phone_unique/, "phone uniqueness migration must remain present");
requireMatch(deviceAuth, /CREATE UNIQUE INDEX IF NOT EXISTS device_access_phone_unique/, "fresh DB bootstrap must enforce phone uniqueness");

const activeSourceRoot = path.join(appRoot, "app");
const activeFiles = walk(activeSourceRoot).filter((file) => /\.(ts|tsx|js|jsx|css)$/.test(file));
const hygiene = /\bTODO\b|\bFIXME\b|\bHACK\b|not implemented|coming soon/i;
for (const file of activeFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (hygiene.test(content)) fail(`active source contains unresolved marker: ${path.relative(repoRoot, file)}`);
}

console.log("Bơi ếch release-readiness audit PASS: manual production boundary, signed roles, class scoping, bounded assignment events, runtime schema parity, media-free supervision, and source hygiene verified.");
