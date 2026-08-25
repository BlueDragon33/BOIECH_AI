import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("keeps Frog AI grounded in published course content without vision capture", async () => {
  const engine = await read("../app/ai-engine.server.ts");
  const route = await read("../app/api/ai/mentor/route.ts");
  const client = await read("../app/ai-learning-hub.tsx");

  assert.match(engine, /coursePassages\(document/);
  assert.match(engine, /published|Bài \$\{lessonNumber\}/);
  assert.match(route, /publishedCourseDocument/);
  assert.doesNotMatch([engine, route, client].join("\n"), /getUserMedia|MediaStream|face-api|tensorflow|pose estimation/i);
  assert.match(client, /Không dùng AI thị giác/);
});

test("protects answer keys and keeps adaptive scoring on the server at eight of ten", async () => {
  const engine = await read("../app/ai-engine.server.ts");
  const route = await read("../app/api/ai/mentor/route.ts");
  const client = await read("../app/ai-learning-hub.tsx");

  assert.match(engine, /answer-key-protected/);
  assert.match(route, /scoreAdaptiveQuiz/);
  assert.match(route, /const passed = score >= 8/);
  assert.match(route, /resetRequired: !passed/);
  assert.doesNotMatch(route, /return json\(\{[^}]*answer:/s);
  assert.match(client, /nếu chưa đạt phải tạo lượt mới và làm lại từ đầu/);
});

test("adds privacy controls, rate limiting, feedback, version logs and zero external model cost", async () => {
  const route = await read("../app/api/ai/mentor/route.ts");
  const control = await read("../app/api/control/ai/route.ts");
  const migration = await read("../drizzle/0010_material_zzzax.sql");

  assert.match(route, /AI_RATE_LIMIT/);
  assert.match(route, />= 30/);
  assert.match(route, /redactSensitive/);
  assert.match(route, /engine_version, prompt_version/);
  assert.match(control, /set-device-ai/);
  assert.match(control, /update-settings/);
  assert.match(control, /review-interaction/);
  assert.match(control, /resolve-feedback/);
  assert.match(control, /costMicros/);
  for (const table of ["ai_settings", "ai_device_controls", "ai_interactions", "ai_feedback", "learner_self_assessments", "ai_quiz_sessions"]) {
    assert.match(migration, new RegExp("CREATE TABLE `" + table + "`"));
  }
});

test("keeps AI content assistance inside the existing human approval workflow", async () => {
  const editorRoute = await read("../app/api/editor/content/route.ts");
  const editor = await read("../app/bien-tap-noi-dung/editor-workspace.tsx");

  assert.match(editorRoute, /action === "ai-suggest"/);
  assert.match(editorRoute, /\["draft", "changes_requested"\]/);
  assert.match(editorRoute, /contentDraftSuggestions/);
  assert.doesNotMatch(editorRoute.match(/if \(action === "ai-suggest"\)[\s\S]*?return json\(\{ aiReview:[\s\S]*?\n    \}/)?.[0] ?? "", /status = 'published'|approve-publish/);
  assert.match(editor, /AI không được xuất bản/);
  assert.match(editor, /bản mới vẫn phải gửi Trung tâm kiểm tra/);
});
