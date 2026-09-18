import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const engine = fs.readFileSync(new URL("../app/teacher-intervention-engine.server.ts", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../app/teacher-smart-interventions.tsx", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../app/api/teacher/overview/route.ts", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("L8 suggestions are deterministic and evidence-based", () => {
  assert.match(engine, /buildInterventionSuggestions/);
  assert.match(engine, /adaptive/);
  assert.match(engine, /learningAnalytics/);
  assert.match(engine, /lastAnalysis/);
  assert.match(engine, /inactiveDays/);
  assert.match(engine, /requiresHumanReview: true/);
});

test("L8 never auto-sends an intervention", () => {
  assert.doesNotMatch(engine, /fetch\(|INSERT INTO|UPDATE /);
  assert.doesNotMatch(ui, /fetch\(|\/api\/teacher\/action/);
  assert.match(ui, /Giảng viên phải duyệt nội dung trước khi gửi/);
  assert.match(shell, /setActionDraft/);
  assert.match(shell, /suggestedNote/);
});

test("L8 exposes suggestions only inside the signed teacher overview", () => {
  assert.match(api, /buildInterventionSuggestions/);
  assert.match(api, /interventionSuggestions/);
  assert.match(api, /verifyDeviceRequest\(payload, previewRequest\)/);
  assert.match(api, /teacher\.personRole !== "teacher"/);
});

test("L8 suggestion UI creates editable drafts", () => {
  assert.match(shell, /TeacherSmartInterventions/);
  assert.match(shell, /suggestedTitle/);
  assert.match(shell, /suggestedLessonNumber/);
  assert.match(shell, /useState\(draft\.suggestedNote \?\? ""\)/);
  assert.match(shell, /useState\(draft\.suggestedTitle \?\? ""\)/);
});

test("L8 styles load after L7 analytics", () => {
  const l7 = layout.indexOf('import "./teacher-learning-analytics-l7.css"');
  const l8 = layout.indexOf('import "./teacher-smart-interventions-l8.css"');
  assert.ok(l7 >= 0);
  assert.ok(l8 > l7);
});
