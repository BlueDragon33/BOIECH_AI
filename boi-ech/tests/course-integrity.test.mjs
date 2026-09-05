import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { readdir, stat } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadCourseLogic() {
  const source = await readFile(new URL("../app/course-logic.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

async function loadContentValidation() {
  const source = await readFile(new URL("../app/course-content-validation.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

function validCourseDocument() {
  const question = () => ({ q: "Câu hỏi", options: ["A", "B", "C", "D"], answer: 0, explain: "Giải thích" });
  const outline = (number) => ({
    n: number,
    title: `Bài ${number}`,
    meta: "Thông tin",
    status: "Bài hoàn chỉnh",
    group: "Nhóm bài",
    summary: "Giới thiệu",
    duration: "45 phút",
    target: "Mục tiêu",
    objectives: ["Mục tiêu học tập"],
    core: [{ title: "Nội dung", body: "Mô tả" }],
    practice: ["Thực hành"],
    pass: ["Tiêu chí đạt"],
    bridge: "Kết nối bài tiếp theo",
  });
  const foundation = () => ({
    safety: { title: "An toàn", body: "Nội dung" },
    knowledge: [{ title: "Học", body: "Nội dung", steps: ["Bước"], cue: "Gợi ý", avoid: "Tránh" }],
    analysis: [{ title: "Phân tích", body: "Nội dung", steps: ["Bước"], cue: "Gợi ý", avoid: "Tránh" }],
    drills: [{ code: "1", title: "Tập", goal: "Mục tiêu", steps: ["Bước"], volume: "1 lượt", pass: "Đạt", safety: "An toàn" }],
    mistakes: [{ sign: "Dấu hiệu", cause: "Nguyên nhân", fix: "Cách sửa" }],
    session: [{ time: "5 phút", title: "Buổi tập", body: "Nội dung" }],
    questions: Array.from({ length: 10 }, question),
    memory: "Ghi nhớ",
  });
  return {
    schemaVersion: 1,
    lessonOutlines: Object.fromEntries(["01", "02", "03", "04", "05", "06", "07", "08"].map((number) => [number, outline(number)])),
    foundationDetails: Object.fromEntries(["01", "02", "04", "05", "06", "07", "08"].map((number) => [number, foundation()])),
    movement: {
      phases: [{ id: "p1", number: "1", short: "Pha", title: "Pha", action: "Làm", purpose: "Mục đích", cue: "Gợi ý", avoid: "Tránh" }],
      analysisPhases: [{ id: "p1", number: "1", short: "Pha", title: "Pha", action: "Làm", purpose: "Mục đích", cue: "Gợi ý", avoid: "Tránh" }],
      mistakes: [{ id: "m1", name: "Lỗi", sign: "Dấu hiệu", cause: "Nguyên nhân", fix: "Sửa", drill: "Bài tập" }],
      practice: [{ code: "3.1", name: "Tập", volume: "1 lượt", goal: "Mục tiêu", safety: "An toàn" }],
      sessionPlan: [{ time: "5 phút", title: "Buổi tập", body: "Nội dung" }],
      questions: Array.from({ length: 10 }, question),
    },
  };
}

function literalValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(
      node.properties
        .filter(ts.isPropertyAssignment)
        .map((property) => [property.name.text, literalValue(property.initializer)]),
    );
  }
  return undefined;
}

async function readConstants(relativePath, scriptKind = ts.ScriptKind.TS) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, scriptKind);
  const values = {};

  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        values[declaration.name.text] = literalValue(declaration.initializer);
      }
    }
  });

  return values;
}

test("requires the first four parts before a lesson quiz can be submitted", async () => {
  const logic = await loadCourseLogic();
  const completed = [];

  assert.equal(logic.canSubmitLesson(completed, "01"), false);
  assert.equal(logic.firstMissingPrerequisite(completed, "01", "kiem-tra"), "hoc-tap");

  for (const part of logic.LESSON_PARTS.slice(0, 4)) {
    completed.push(logic.courseProgressKey(part, "01"));
  }

  assert.equal(logic.canSubmitLesson(completed, "01"), true);
  assert.equal(logic.courseProgressKey("hoc-tap", "03"), "hoc-tap");
  assert.equal(logic.courseProgressKey("hoc-tap", "04"), "hoc-tap-04");
});

test("keeps completed legacy progress consistent across all five parts", async () => {
  const logic = await loadCourseLogic();
  const normalized = logic.normalizeCompletedProgress(["bai-03", "bai-08", "custom-key"]);

  for (const lessonNumber of ["03", "08"]) {
    assert.equal(normalized.includes(`bai-${lessonNumber}`), true);
    for (const part of logic.LESSON_PARTS) {
      assert.equal(normalized.includes(logic.courseProgressKey(part, lessonNumber)), true);
    }
  }
  assert.equal(normalized.includes("custom-key"), true);
});

test("contains eight complete lessons and eighty valid A-D questions", async () => {
  const outlineValues = await readConstants("../app/course-outline-data.ts");
  const serverValues = await readConstants("../app/course-data.server.ts");
  assert.deepEqual(outlineValues.defaultLessonOutlines.map((lesson) => lesson.n), ["01", "02", "03", "04", "05", "06", "07", "08"]);

  const questionSets = {
    ...Object.fromEntries(Object.entries(serverValues.foundationDetails).map(([number, detail]) => [number, detail.questions])),
    "03": serverValues.questions,
  };

  assert.deepEqual(Object.keys(questionSets).sort(), ["01", "02", "03", "04", "05", "06", "07", "08"]);
  assert.equal(Object.values(questionSets).flat().length, 80);

  for (const [lessonNumber, questions] of Object.entries(questionSets)) {
    assert.equal(questions.length, 10, `Bài ${lessonNumber} phải có đúng 10 câu`);
    for (const question of questions) {
      assert.equal(question.options.length, 4);
      assert.equal(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4, true);
      assert.equal(question.q.trim().length > 0, true);
      assert.equal(question.explain.trim().length > 0, true);
    }
  }

  for (const detail of Object.values(serverValues.foundationDetails)) {
    assert.equal(detail.knowledge.length >= 5, true);
    assert.equal(detail.drills.length, 5);
    assert.equal(detail.mistakes.length, 4);
    assert.equal(detail.session.length >= 5, true);
  }
});

test("keeps answer keys and explanations out of the browser bundle", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(pageSource, /\banswer\s*:\s*[0-3]\b/);
  assert.doesNotMatch(pageSource, /\bexplain\s*:\s*["']/);

  const { readdir } = await import("node:fs/promises");
  const clientRoot = new URL("../dist/client/", import.meta.url);
  const pending = [clientRoot];
  let clientBundle = "";
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(entry.name, directory);
      if (entry.isDirectory()) {
        url.pathname += "/";
        pending.push(url);
      } else if (entry.name.endsWith(".js")) {
        clientBundle += await readFile(url, "utf8");
      }
    }
  }
  assert.doesNotMatch(clientBundle, /Pha thu tạo vị trí cơ học thuận lợi để bàn chân chuẩn bị tỳ nước/);
  assert.doesNotMatch(clientBundle, /course-data\.server/);
});

test("never trusts browser progress to unlock a new server profile", async () => {
  const route = await readFile(new URL("../app/api/course/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(route, /legacyCompleted/);
  assert.doesNotMatch(page, /legacyCompleted/);
  assert.match(route, /const completed: string\[\] = \[\]/);
  assert.match(route, /if \(passed\) addCompleted/);
});

test("replaces learner accounts with signed, server-approved device access", async () => {
  const route = await readFile(new URL("../app/api/course/route.ts", import.meta.url), "utf8");
  const deviceServer = await readFile(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");
  const deviceRoute = await readFile(new URL("../app/api/device/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const adminRoute = await readFile(new URL("../app/api/admin/devices/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0001_fearless_squirrel_girl.sql", import.meta.url), "utf8");

  assert.doesNotMatch(route, /getChatGPTUser|userKeyFor|deviceToken/);
  assert.match(route, /verifyDeviceRequest\(payload, previewRequest\)/);
  assert.match(route, /SELECT device_id, completed_json, scores_json, attempts_json, total_active_seconds/);
  assert.match(deviceServer, /device\.status !== "approved"/);
  assert.match(deviceServer, /crypto\.subtle\.verify/);
  assert.match(deviceServer, /DELETE FROM device_challenges WHERE nonce = \? AND device_id = \?/);
  assert.match(deviceServer, /DEVICE_MISMATCH/);
  assert.match(deviceServer, /ORDER BY updated_at DESC LIMIT 1/);
  assert.match(deviceRoute, /action === "register"/);
  assert.match(deviceRoute, /action === "presence"/);
  assert.match(deviceServer, /UPDATE device_access SET last_seen_at = CURRENT_TIMESTAMP/);
  const challengeFunction = deviceServer.match(/export async function createDeviceChallenge[\s\S]*?\n}\n/)?.[0] ?? "";
  assert.doesNotMatch(challengeFunction, /UPDATE device_access SET last_seen_at/, "an unsigned challenge must not mark a device online");
  assert.match(page, /namedCurve: "P-256"/);
  assert.match(page, /privateJwk/);
  assert.match(page, /false,\s*\["sign"\]/s, "private key must be re-imported as non-exportable");
  assert.match(page, /Nhập thông tin người học/);
  assert.match(page, /Vào học/);
  assert.match(page, /<span>Họ<\/span>/);
  assert.match(page, /<span>Tên<\/span>/);
  assert.match(page, /autoComplete="family-name"/);
  assert.match(page, /autoComplete="given-name"/);
  assert.match(page, /Sao chép mã/);
  assert.match(page, /10_000/, "pending devices must automatically recheck approval");
  assert.match(page, /window\.setInterval\(sendPresence, 60_000\)/);
  assert.match(adminRoute, /requireDeviceAdmin\(\)/);
  assert.match(migration, /CREATE TABLE `device_access`/);
  assert.match(migration, /CREATE TABLE `device_profiles`/);
  assert.match(migration, /CREATE TABLE `device_challenges`/);
});

test("keeps device administration separate from the learner route", async () => {
  const adminPage = await readFile(new URL("../app/quan-ly-thiet-bi/page.tsx", import.meta.url), "utf8");
  const adminClient = await readFile(new URL("../app/quan-ly-thiet-bi/device-manager.tsx", import.meta.url), "utf8");
  const deviceServer = await readFile(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");

  assert.match(adminPage, /requireChatGPTUser\("\/quan-ly-thiet-bi"\)/);
  assert.match(adminPage, /isDeviceAdminEmail\(user\.email\)/);
  assert.match(deviceServer, /DEVICE_ADMIN_EMAILS/);
  assert.match(adminClient, /action, deviceId/);
  assert.match(adminClient, /Cấp quyền/);
  assert.match(adminClient, /Khóa thiết bị/);
});

test("keeps scoring and lesson unlock enforcement on the server", async () => {
  const route = await readFile(new URL("../app/api/course/route.ts", import.meta.url), "utf8");

  assert.match(route, /if \(!isLessonUnlocked\(profile\.completed, lessonNumber\)\)/);
  assert.doesNotMatch(route, /action === "check"/);
  assert.doesNotMatch(route, /feedbackByQuestion/);
  assert.match(route, /const score = bank\.reduce/);
  assert.match(route, /const passed = score >= Math\.ceil\(bank\.length \* 0\.8\)/);
  assert.match(route, /if \(passed\) profile\.scores\[lessonNumber\] = Math\.max\(profile\.scores\[lessonNumber\] \?\? 0, score\)/);
  assert.match(route, /resetRequired: !passed/);
  assert.match(route, /await saveProfile\(profile\)/);
  assert.doesNotMatch(route, /return json\(\{[^}]*questions[^}]*answer/s);
});

test("tracks trustworthy device activity and forty-step course progress", async () => {
  const route = await readFile(new URL("../app/api/course/route.ts", import.meta.url), "utf8");
  const overview = await readFile(new URL("../app/api/control/overview/route.ts", import.meta.url), "utf8");
  const admin = await readFile(new URL("../app/api/admin/devices/route.ts", import.meta.url), "utf8");
  const deviceServer = await readFile(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0002_acoustic_bushwacker.sql", import.meta.url), "utf8");

  assert.match(route, /Math\.min\(300, Number\(payload\.activeSeconds\) \|\| 0\)/);
  assert.match(route, /Math\.min\(requestedSeconds, elapsedSeconds\)/);
  assert.match(route, /lastLesson = lessonNumber/);
  assert.match(route, /"lesson_open"/);
  assert.match(route, /"part_complete"/);
  assert.match(route, /"quiz_submit"/);
  assert.match(overview, /completionPercent: Math\.round\(\(completedSteps \/ 40\) \* 100\)/);
  assert.match(overview, /masteryPercent: Math\.round\(\(scoreTotal \/ 80\) \* 100\)/);
  assert.match(overview, /DEVICE_PRESENCE_TIMEOUT_MS = 150_000/);
  assert.match(overview, /offlineSinceAt/);
  assert.match(overview, /lastPresenceAt/);
  assert.match(admin, /completed\.includes\(`bai-\$\{lessonNumber\}`\)/);
  assert.match(deviceServer, /DEVICE_ACCESS_EXPIRED/);
  assert.match(deviceServer, /T23:59:59\.999Z/);
  assert.match(migration, /`attempts_json`/);
  assert.match(migration, /`total_active_seconds`/);
  assert.match(migration, /CREATE TABLE `course_activity_events`/);
});

test("validates every nested lesson field before content can be published", async () => {
  const validation = await loadContentValidation();
  const valid = validCourseDocument();
  assert.deepEqual(validation.validateCourseDocument(valid), { valid: true, errors: [] });

  const missingNestedField = structuredClone(valid);
  delete missingNestedField.foundationDetails["04"].drills[0].goal;
  const invalidNested = validation.validateCourseDocument(missingNestedField);
  assert.equal(invalidNested.valid, false);
  assert.equal(invalidNested.errors.some((error) => error.includes("goal")), true);

  const wrongQuestionCount = structuredClone(valid);
  wrongQuestionCount.movement.questions.pop();
  assert.equal(validation.validateCourseDocument(wrongQuestionCount).valid, false);
});

test("creates immutable numbered drafts and rollback versions", async () => {
  const route = await readFile(new URL("../app/api/control/content/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0004_typical_ezekiel_stane.sql", import.meta.url), "utf8");

  assert.match(route, /COALESCE\(MAX\(version_number\), 0\) \+ 1/);
  assert.match(route, /parent_version_id/);
  assert.match(route, /Người tạo bản nháp không được tự phê duyệt/);
  assert.match(route, /parseCourseDocument\(current\.payload_json\)/);
  assert.match(route, /const restoredId = crypto\.randomUUID\(\)/);
  assert.match(route, /Khôi phục từ V\$\{current\.version_number\}/);
  assert.match(migration, /CREATE UNIQUE INDEX `course_content_version_number_unique`/);
});

test("records approval history without exposing it to editor-only roles", async () => {
  const overview = await readFile(new URL("../app/api/control/overview/route.ts", import.meta.url), "utf8");
  const content = await readFile(new URL("../app/api/control/content/route.ts", import.meta.url), "utf8");
  const editor = await readFile(new URL("../app/api/editor/content/route.ts", import.meta.url), "utf8");

  assert.match(overview, /FROM course_audit_log ORDER BY id DESC LIMIT 200/);
  assert.match(overview, /\["publisher", "owner"\]\.includes\(role\)/);
  assert.match(editor, /content_edit_permission_requested/);
  assert.match(editor, /content_editor_draft_saved/);
  assert.match(editor, /content_editor_submitted/);
  assert.match(editor, /content_editor_withdrawn/);
  assert.match(content, /content_edit_permission_approved/);
  assert.match(content, /content_edit_permission_denied/);
  assert.match(content, /content_changes_requested/);
  assert.match(content, /content_edit_cancelled/);
  assert.match(content, /content_published/);
  assert.match(content, /content_rolled_back/);
});

test("accepts only short-lived signed browser tickets from the exact control-center origin", async () => {
  const auth = await readFile(new URL("../app/control-auth.server.ts", import.meta.url), "utf8");
  const overview = await readFile(new URL("../app/api/control/overview/route.ts", import.meta.url), "utf8");
  const content = await readFile(new URL("../app/api/control/content/route.ts", import.meta.url), "utf8");

  assert.match(auth, /CONTROL_CENTER_ORIGIN = "https:\/\/learning-management\.boiech-ai\.workers\.dev"/);
  assert.match(auth, /TOKEN_AUDIENCE = "boi-ech-control"/);
  assert.match(auth, /TOKEN_ISSUER = "quan-ly-hoc-tap"/);
  assert.match(auth, /name: "HMAC", hash: "SHA-256"/);
  assert.match(auth, /expiresAt > Date\.now\(\) \+ 10 \* 60 \* 1000/);
  assert.match(auth, /access-control-allow-origin/);
  assert.doesNotMatch(auth, /access-control-allow-origin[^\n]*\*/);
  assert.match(overview, /export function OPTIONS/);
  assert.match(content, /export function OPTIONS/);
  assert.match(overview, /\["publisher", "owner"\]\.includes\(role\)/);
});

test("lists pending devices automatically and supports exact BE-code fallback lookup", async () => {
  const device = await readFile(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");
  const overview = await readFile(new URL("../app/api/control/overview/route.ts", import.meta.url), "utf8");

  assert.match(device, /status: DeviceStatus = legacy \|\| autoApprove \? "approved" : "pending"/);
  assert.match(device, /INSERT INTO device_access/);
  assert.match(overview, /ORDER BY CASE d\.status WHEN 'pending' THEN 0/);
  assert.match(overview, /searchParams\.get\("deviceCode"\)/);
  assert.match(overview, /WHERE d\.display_code IN/);
  assert.match(overview, /\^BE-/);
});

test("refreshes only fixed device codes and marks stale devices inactive", async () => {
  const overview = await readFile(new URL("../app/api/control/overview/route.ts", import.meta.url), "utf8");

  assert.match(overview, /searchParams\.get\("deviceCodes"\)/);
  assert.match(overview, /statement\.bind\(\.\.\.displayCodes\)/);
  assert.match(overview, /slice\(0, 500\)/);
  assert.match(overview, /DEVICE_PRESENCE_TIMEOUT_MS = 150_000/);
  assert.match(overview, /Date\.now\(\) - lastPresenceTime <= DEVICE_PRESENCE_TIMEOUT_MS/);
  assert.match(overview, /requestedCodes === undefined/);
});

test("edits only a selected lesson section on the Boi Ech site through a two-stage approval flow", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const workspace = await readFile(new URL("../app/bien-tap-noi-dung/editor-workspace.tsx", import.meta.url), "utf8");
  const editorRoute = await readFile(new URL("../app/api/editor/content/route.ts", import.meta.url), "utf8");
  const controlRoute = await readFile(new URL("../app/api/control/content/route.ts", import.meta.url), "utf8");

  assert.match(page, /href=\{`\/bien-tap-noi-dung\?lesson=\$\{selectedLesson\}`\}/);
  assert.match(workspace, /Xin chỉnh sửa \{activeScope\.label\}/);
  assert.match(workspace, /Chỉnh sửa xong · gửi Trung tâm/);
  assert.match(workspace, /30_000/);
  assert.match(workspace, /VisualSectionEditor/);
  assert.match(workspace, /Phân cấp quyền chỉnh sửa/);
  assert.match(workspace, /editSectionOptions/);
  for (const section of ["content", "practice", "analysis", "review", "quiz"]) {
    assert.match(workspace, new RegExp(`id: "${section}"`));
  }
  assert.doesNotMatch(workspace, /className="edit-json"/);
  assert.doesNotMatch(workspace, /JSON\.parse\(lessonText\)/);
  assert.match(editorRoute, /'permission_requested'/);
  assert.match(editorRoute, /\["draft", "changes_requested"\]\.includes\(current\.status\)/);
  assert.match(editorRoute, /current\.status !== "draft"/);
  assert.match(controlRoute, /action === "approve-edit"/);
  assert.match(controlRoute, /action === "approve-publish"/);
  assert.doesNotMatch(controlRoute, /action === "(?:create-draft|save-draft|submit-review)"/);
});

test("binds editing permission to the signed-in account and exact laptop", async () => {
  const auth = await readFile(new URL("../app/editor-device-auth.server.ts", import.meta.url), "utf8");
  const workspace = await readFile(new URL("../app/bien-tap-noi-dung/editor-workspace.tsx", import.meta.url), "utf8");

  assert.match(auth, /source\.crv !== "P-256"/);
  assert.match(auth, /existing\.email !== email/);
  assert.match(auth, /row\.email !== user\.email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(auth, /DELETE FROM content_editor_challenges WHERE nonce = \? AND device_id = \?/);
  assert.match(auth, /boi-ech-editor:\$\{deviceId\}:\$\{challenge\}/);
  assert.match(auth, /crypto\.subtle\.verify/);
  assert.match(workspace, /namedCurve: "P-256"/);
  assert.match(workspace, /false, \["sign"\]/, "editor private key must be non-exportable after import");
});

test("sends and publishes only the selected edited section", async () => {
  const editorRoute = await readFile(new URL("../app/api/editor/content/route.ts", import.meta.url), "utf8");
  const controlRoute = await readFile(new URL("../app/api/control/content/route.ts", import.meta.url), "utf8");
  const contentServer = await readFile(new URL("../app/course-content.server.ts", import.meta.url), "utf8");

  assert.match(editorRoute, /activeContent:/);
  assert.doesNotMatch(editorRoute, /publishedDocument:/);
  assert.match(editorRoute, /replaceCourseEditSection\(source, scope, payload\.sectionContent\)/);
  assert.match(editorRoute, /EDIT_HAS_NO_CHANGES/);
  assert.match(contentServer, /COURSE_EDIT_SECTIONS = \["content", "practice", "analysis", "review", "quiz"\]/);
  assert.match(contentServer, /courseEditSectionFromDocument/);
  assert.match(contentServer, /replaceCourseEditSection/);
  assert.match(contentServer, /\["review", "published", "archived", "changes_requested"\]\.includes\(row\.status\)/);
  assert.match(controlRoute, /currentSection:/);
  assert.match(controlRoute, /proposedSection:/);
  assert.match(controlRoute, /replaceCourseEditSection\(publishedSource, scope/);
  assert.doesNotMatch(controlRoute, /publishedDocument:/);
  assert.doesNotMatch(controlRoute, /listContentVersions\(database, versionId\)/);
});

test("migrates dedicated content-editor devices and scoped permission metadata", async () => {
  const migration = await readFile(new URL("../drizzle/0005_smiling_manta.sql", import.meta.url), "utf8");

  assert.match(migration, /CREATE TABLE `content_editor_challenges`/);
  assert.match(migration, /CREATE TABLE `content_editor_devices`/);
  assert.match(migration, /ADD `editor_device_id` text/);
  assert.match(migration, /ADD `editor_device_code` text/);
  assert.match(migration, /ADD `edit_scope` text/);
  assert.match(migration, /ADD `permission_reviewed_by` text/);
});

test("maps every lesson to teaching and neutral diagnostic visuals", async () => {
  const source = await readFile(new URL("../app/course-visuals.server.ts", import.meta.url), "utf8");
  const types = await readFile(new URL("../app/course-types.ts", import.meta.url), "utf8");

  for (const lessonNumber of ["01", "02", "03", "04", "05", "06", "07", "08"]) {
    assert.match(source, new RegExp(`\\"${lessonNumber}\\":`));
  }
  assert.match(source, /Array\.from\(\{ length: 8 \}/);
  assert.match(source, /const techniqueOrder/);
  assert.match(source, /const techniqueCaptions/);
  assert.match(source, /const diagnosticCaptions/);
  assert.match(source, /optionImages/);
  assert.match(source, /crypto\.subtle\.digest\("SHA-256"/);
  assert.doesNotMatch(source, /\/course-media\/bai-/);
  assert.match(types, /image\?: LessonVisual/);
  assert.match(types, /optionImages\?: LessonVisual\[\]/);
  assert.doesNotMatch(source, /\/(?:dung|sai|correct|wrong)[-_.]/i);
});

test("ships all 128 neutral course visuals referenced by the server", async () => {
  const mediaRoot = new URL("../public/course-media/", import.meta.url);
  const namespace = "be-visuals-v1-4e3b9a7c13d8f06fa571c92b8e64f10d";

  const files = await readdir(mediaRoot);
  assert.equal(files.length, 128);
  for (const lessonNumber of ["01", "02", "03", "04", "05", "06", "07", "08"]) {
    for (const group of ["technique", "diagnostic"]) {
      for (let index = 0; index < 8; index += 1) {
        const name = `${createHash("sha256")
          .update(`${namespace}:${lessonNumber}:${group}:${index}`)
          .digest("hex")
          .slice(0, 32)}.webp`;
        const info = await stat(new URL(name, mediaRoot));
        assert.ok(info.size > 4_096, `${name} must be a real visual asset`);
      }
    }
  }
});

test("uses exactly five image-based questions in every lesson", async () => {
  const source = await readFile(new URL("../app/course-visuals.server.ts", import.meta.url), "utf8");
  for (const lessonNumber of ["01", "02", "03", "04", "05", "06", "07", "08"]) {
    assert.match(source, new RegExp(`\\"${lessonNumber}\\": \\{ single:`));
  }
  assert.match(source, /"01": \{ single: \{ 0: 0, 2: 3, 4: 2, 6: 4 \}, options: \{ 1: \[4, 8\] \} \}/);
  assert.match(source, /"02": \{ single: \{ 1: 3, 2: 1, 4: 0, 9: 4 \}, options: \{ 0: \[4, 8\] \} \}/);
});

test("keeps image answers neutral and never reveals per-question feedback", async () => {
  const source = await readFile(new URL("../app/course-visuals.server.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /\b(answer|correctIndex|explain)\b/);
  assert.doesNotMatch(source, /\/course-media\/[^\n]*(?:dung|sai|correct|wrong|green|red|success|danger)/i);
  assert.doesNotMatch(source, /alt:\s*`[^`]*(?:đúng|sai|correct|wrong)/i);
  assert.doesNotMatch(page, /activeQuestionFeedback/);
  assert.doesNotMatch(page, /feedbackByQuestion/);
  assert.doesNotMatch(page, />Kiểm thử</);
  assert.match(page, /optionImages\?\.\[index\]/);
});

test("registers unique learner profiles and uses controlled paid or free activation", async () => {
  const device = await readFile(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");
  const deviceRoute = await readFile(new URL("../app/api/device/route.ts", import.meta.url), "utf8");
  const proofRoute = await readFile(new URL("../app/api/device/payment-proof/route.ts", import.meta.url), "utf8");
  const proofControl = await readFile(new URL("../app/api/control/payment-proof/route.ts", import.meta.url), "utf8");
  const overview = await readFile(new URL("../app/api/control/overview/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const hosting = await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0006_lush_nico_minoru.sql", import.meta.url), "utf8");
  const learnerNameMigration = await readFile(new URL("../drizzle/0008_lazy_spyke.sql", import.meta.url), "utf8");

  assert.match(deviceRoute, /action === "save-registration"/);
  assert.match(device, /PHONE_ALREADY_REGISTERED/);
  assert.match(device, /registrationComplete/);
  assert.match(proofRoute, /file\.size > 5 \* 1024 \* 1024/);
  assert.match(proofRoute, /payment_status = 'proof_submitted'/);
  assert.match(proofControl, /requireControlService/);
  assert.match(overview, /action === "grant-free"/);
  assert.match(overview, /action === "require-payment"/);
  assert.match(overview, /action === "verify-payment"/);
  assert.match(overview, /activityTimeline/);
  assert.match(page, /thanh-toan-mb\.jpeg/);
  assert.match(page, /50\.000đ/);
  assert.match(hosting, /"d1": "DB"/);
  assert.doesNotMatch(hosting, /"r2"/);
  assert.match(proofRoute, /BUCKET\?: PaymentBucket/);
  assert.match(migration, /ADD `class_name` text/);
  assert.match(migration, /ADD `payment_status` text/);
  assert.match(learnerNameMigration, /ADD `learner_family_name` text/);
  assert.match(learnerNameMigration, /ADD `learner_given_name` text/);
  assert.match(device, /learnerFamilyName/);
  assert.match(device, /learnerGivenName/);
  assert.match(overview, /learnerGivenName: row\.learner_given_name/);
});

test("completes the payment review lifecycle and enforces account expiry", async () => {
  const overview = await readFile(new URL("../app/api/control/overview/route.ts", import.meta.url), "utf8");
  const proof = await readFile(new URL("../app/api/device/payment-proof/route.ts", import.meta.url), "utf8");
  const device = await readFile(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0009_smooth_piledriver.sql", import.meta.url), "utf8");

  assert.match(overview, /action === "reject-payment"/);
  assert.match(overview, /action === "unblock"/);
  assert.match(overview, /action === "reset-progress"/);
  assert.match(overview, /payment_status = 'paid_verified'/);
  assert.match(proof, /PAYMENT_PROOF_INVALID_FILE/);
  assert.match(proof, /payment_reviews SET status = 'replaced'/);
  assert.match(device, /accessExpired/);
  assert.match(device, /accessExpiringSoon/);
  assert.match(migration, /CREATE TABLE `payment_reviews`/);
  assert.match(migration, /ADD `payment_rejected_at` text/);
});

test("supports installable offline learning without offline answer submission", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  const course = await readFile(new URL("../app/api/course/route.ts", import.meta.url), "utf8");

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.some((icon) => icon.sizes === "512x512"), true);
  assert.match(page, /indexedDB\.open\("boi-ech-doc-lap", 4\)/);
  assert.match(page, /enqueueOfflineAction/);
  assert.match(page, /existingRequest\.result/);
  assert.match(page, /flushOfflineQueue/);
  assert.match(page, /navigator\.serviceWorker[\s\S]*register\("\/sw\.js", \{ updateViaCache: "none" \}\)/);
  assert.match(page, /controllerchange/);
  assert.match(page, /window\.location\.reload\(\)/);
  assert.match(serviceWorker, /boi-ech-webapp-v4/);
  assert.match(page, /Bài kiểm tra cần kết nối mạng để chấm điểm an toàn trên máy chủ/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(serviceWorker, /\/bien-tap-noi-dung/);
  assert.doesNotMatch(serviceWorker, /cache\.put\([^\n]*(?:\/api\/|bien-tap-noi-dung)/);
  assert.match(course, /clientEventId/);
  assert.match(course, /duplicate: true/);
  assert.match(await readFile(new URL("../drizzle/0009_smooth_piledriver.sql", import.meta.url), "utf8"), /course_activity_events` \(`device_id`,`client_event_id`\)/);
});

test("limits one-time challenges and optimizes status-only polling", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const device = await readFile(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");
  const editor = await readFile(new URL("../app/editor-device-auth.server.ts", import.meta.url), "utf8");
  const overview = await readFile(new URL("../app/api/control/overview/route.ts", import.meta.url), "utf8");

  assert.match(device, /ORDER BY rowid DESC LIMIT 8/);
  assert.match(page, /withFreshDeviceProof/);
  assert.doesNotMatch(device, /Phiên xác thực thiết bị đã hết hạn/);
  assert.match(editor, /DELETE FROM content_editor_challenges WHERE device_id = \?/);
  assert.match(overview, /Math\.min\(90/);
  assert.match(overview, /activityDayCount = 30/);
  assert.match(overview, /dayCount <= 0/);
  assert.match(overview, /rows\(\[current\.display_code\], 30\)/);
});

test("uses five visual questions per lesson and four images per visual option set", async () => {
  const source = await readFile(new URL("../app/course-visuals.server.ts", import.meta.url), "utf8");
  const sourceFile = ts.createSourceFile("course-visuals.server.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const plans = {};

  function readObject(node) {
    return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map((property) => [property.name.text, property.initializer]));
  }

  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "questionVisualPlans") continue;
      const object = declaration.initializer;
      assert.ok(object && ts.isObjectLiteralExpression(object));
      for (const property of object.properties.filter(ts.isPropertyAssignment)) {
        const lesson = property.name.text;
        assert.ok(ts.isObjectLiteralExpression(property.initializer));
        const plan = readObject(property.initializer);
        assert.ok(ts.isObjectLiteralExpression(plan.single));
        assert.ok(ts.isObjectLiteralExpression(plan.options));
        const rangeNode = plan.options.properties.filter(ts.isPropertyAssignment)[0]?.initializer;
        assert.ok(rangeNode && ts.isArrayLiteralExpression(rangeNode));
        plans[lesson] = {
          singleCount: plan.single.properties.length,
          optionCount: plan.options.properties.length,
          range: rangeNode.elements.map((item) => Number(item.getText(sourceFile))),
        };
      }
    }
  });

  assert.deepEqual(Object.keys(plans), ["01", "02", "03", "04", "05", "06", "07", "08"]);
  for (const plan of Object.values(plans)) {
    assert.equal(plan.singleCount + plan.optionCount, 5);
    assert.equal(plan.optionCount, 1);
    assert.equal(plan.range[1] - plan.range[0], 4);
  }
});

test("uses an explicit semantic image map instead of assigning generic positions", async () => {
  const source = await readFile(new URL("../app/course-visuals.server.ts", import.meta.url), "utf8");

  assert.match(source, /"Thu gối, đặt chân rồi mới nâng đầu"/);
  assert.match(source, /"Gập cổ chân và mở mũi chân"/);
  assert.match(source, /"Tổ chức buổi tập có giám sát"/);
  assert.doesNotMatch(source, /const standardQuestionPlan/);
});

test("renders one progress bar in each quiz section", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const movementQuiz = pageSource.match(
    /section === "kiem-tra" && selectedLesson === "03"[\s\S]*?section === "kiem-tra" && selectedLesson !== "03"/,
  );
  assert.ok(movementQuiz, "movement quiz section must exist");
  assert.equal(
    (movementQuiz[0].match(/className="quiz-statusbar"/g) ?? []).length,
    1,
    "Bài 03 must show exactly one quiz progress bar",
  );
});

test("keeps course visuals and quiz choices usable on narrow screens", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const mobileBlock = styles.match(/@media \(max-width: 640px\) \{[\s\S]*?\n\}/g)?.at(-1) ?? "";
  assert.match(mobileBlock, /\.answer-list\.answer-image-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(mobileBlock, /\.question-nav > div \{ grid-template-columns: repeat\(5, 1fr\); \}/);
  assert.match(mobileBlock, /\.foundation-hero > \.lesson-figure img[\s\S]*aspect-ratio: 4 \/ 3/);
  assert.match(styles, /\.lesson-figure img[\s\S]*object-fit: contain/);
});

test("keeps navigation and learning content complete when text grows or the screen narrows", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(styles, /\.topbar \{[^}]*min-height: 72px/);
  assert.doesNotMatch(styles, /\.roadmap-lesson-grid \.lesson-content em \{[^}]*line-clamp/);
  assert.match(styles, /\.today-step \{ display: flex !important; \}/);
  assert.match(styles, /\.topbar-actions \{[^}]*flex-wrap: nowrap[^}]*overflow-x: auto/);
  assert.match(page, /Xin quyền chỉnh sửa/);
  assert.match(page, /deviceAccess\.personRole === "teacher"/);
  assert.match(page, /className="install-fab"/);
  assert.match(page, /movementContent\?\.analysisPhases \?\? phases/);
  assert.match(page, /selectedPracticeDetail\?\.analysis \?\? selectedPracticeDetail\?\.knowledge/);
  assert.match(styles, /\.session-section \{[^}]*background: rgba\(255,255,255,\.94\)/);
  assert.match(styles, /\.session-item > div \{[^}]*min-width: 0[^}]*overflow-wrap: anywhere/);
  assert.match(styles, /grid-template-columns: var\(--session-time-column\) var\(--session-marker-column\) minmax\(0,1fr\)/);
  assert.match(styles, /--page-ink/);
});

test("registers a unique learner or teacher identity and limits editing to teachers", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const auth = await readFile(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");
  const overview = await readFile(new URL("../app/api/control/overview/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0012_chunky_spectrum.sql", import.meta.url), "utf8");

  assert.match(page, /Học viên/);
  assert.match(page, /Giảng viên/);
  assert.match(page, /Mã số học viên/);
  assert.match(page, /Số hiệu SQ\/QNCN/);
  assert.match(auth, /PERSON_CODE_ALREADY_REGISTERED/);
  assert.match(auth, /personal_edit_enabled = CASE WHEN person_role = 'teacher' THEN 1 ELSE 0 END/);
  assert.match(overview, /current\.person_role !== "teacher"/);
  assert.match(migration, /device_access_person_identity_unique/);
});

test("personalizes learner-facing copy with the registered given name", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /Chào \{learnerGivenName\}/);
  assert.match(page, /Tiến độ của \{learnerGivenName\}/);
  assert.match(page, /className="learner-chip"/);
  assert.match(page, /hoc_vien: learnerFullName/);
  assert.doesNotMatch(page, /Bạn (?:đạt|đã|có thể|cần)/);
});

test("lets only the owner permanently remove confirmed spam devices while preserving protected academic records", async () => {
  const overview = await readFile(new URL("../app/api/control/overview/route.ts", import.meta.url), "utf8");
  const auth = await readFile(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");

  assert.match(overview, /action === "delete-spam-device"/);
  assert.match(overview, /role !== "owner"/);
  assert.match(overview, /confirmedCode !== current\.display_code/);
  assert.match(overview, /current\.payment_status === "paid_verified"/);
  assert.match(overview, /SELECT id FROM course_certificates WHERE device_id = \? LIMIT 1/);
  for (const table of [
    "device_challenges",
    "ai_feedback",
    "ai_quiz_sessions",
    "learner_self_assessments",
    "ai_device_controls",
    "ai_interactions",
    "payment_reviews",
    "course_activity_events",
    "device_profiles",
    "device_access",
  ]) {
    assert.match(overview, new RegExp(`DELETE FROM ${table}`));
  }
  assert.match(overview, /learning_device_deleted/);
  assert.match(overview, /deletedDeviceId: deviceId/);
  assert.match(overview, /INSERT INTO device_deletion_tombstones/);
  assert.match(overview, /action === "restore-deleted-device"/);
  assert.match(overview, /learning_device_registration_reopened/);
  assert.match(auth, /SELECT display_code FROM device_deletion_tombstones WHERE device_id = \?/);
  assert.match(auth, /DEVICE_REMOVED/);
  assert.match(schema, /deviceDeletionTombstones/);
});

test("enters the course immediately after an approved profile and hides free-day countdowns until expiry", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /Lưu thông tin & vào học/);
  assert.match(page, /setHasEnteredLearning\(access\.status === "approved" && access\.registrationComplete && !access\.accessExpired\)/);
  assert.match(page, /access\.registrationComplete && !access\.accessExpired\) setHasEnteredLearning\(true\)/);
  assert.doesNotMatch(page, /Quyền miễn phí còn/);
  assert.doesNotMatch(page, /Miễn phí\$\{deviceAccess\.accessDaysRemaining/);
  assert.match(page, /Quyền học đã hết hạn/);
});

test("caps automatic free access with configurable defaults of 60 days and 20 devices", async () => {
  const auth = await readFile(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");
  const overview = await readFile(new URL("../app/api/control/overview/route.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0014_kind_jimmy_woo.sql", import.meta.url), "utf8");

  assert.match(schema, /defaultDeviceLimit: integer\("default_device_limit"\)\.notNull\(\)\.default\(20\)/);
  assert.match(auth, /defaultDeviceLimit: number/);
  assert.match(auth, /activeAutoFreeDeviceCount/);
  assert.match(auth, /remainingAutoFreeDeviceSlots/);
  assert.match(auth, /SELECT COUNT\(\*\) FROM device_access/);
  assert.match(auth, /automation\.defaultDeviceLimit/);
  assert.match(auth, /learning_device_auto_confirmation_deferred/);
  assert.match(overview, /defaultDeviceLimit < 1 \|\| defaultDeviceLimit > 1_000/);
  assert.match(overview, /default_device_limit = excluded\.default_device_limit/);
  assert.match(migration, /ADD `default_device_limit` integer DEFAULT 20 NOT NULL/);
});
