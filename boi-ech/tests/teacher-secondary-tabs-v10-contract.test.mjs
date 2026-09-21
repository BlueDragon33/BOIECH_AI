import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../app/teacher-secondary-tabs-v10.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("secondary tab design system loads after feature-specific teacher styles", () => {
  const analytics = layout.indexOf('import "./teacher-learning-analytics-l7.css"');
  const interventions = layout.indexOf('import "./teacher-smart-interventions-l8.css"');
  const messages = layout.indexOf('import "./two-way-messaging-l9.css"');
  const schedule = layout.indexOf('import "./assignment-schedule-l10.css"');
  const unified = layout.indexOf('import "./teacher-secondary-tabs-v10.css"');
  assert.ok(analytics >= 0);
  assert.ok(interventions > analytics);
  assert.ok(messages > interventions);
  assert.ok(schedule > messages);
  assert.ok(unified > schedule);
});

test("all teacher secondary feature panels share one card and header language", () => {
  for (const selector of [
    ".teacher-learning-analytics",
    ".teacher-smart-interventions",
    ".teacher-two-way-messages",
    ".teacher-assignment-schedule",
    ".teacher-roster-manager",
  ]) assert.ok(css.includes(selector), selector);
  assert.match(css, /border-radius:\s*13px/);
  assert.match(css, /var\(--teacher-tab-shadow\)/);
});

test("secondary page mastheads reuse the main dashboard navy visual language", () => {
  assert.match(css, /\.teacher-page > header\s*\{[\s\S]*linear-gradient\(135deg, #062d49/);
  assert.match(css, /\.teacher-page > header h1\s*\{[\s\S]*font-family:\s*var\(--role-display-font\) !important/);
  assert.match(css, /color:\s*#f2cb69/);
});

test("feature panels use Vietnamese-safe display typography instead of their older Georgia rules", () => {
  assert.match(css, /\.teacher-learning-analytics h2,[\s\S]*font-family:\s*var\(--role-display-font\) !important/);
  assert.doesNotMatch(css, /font-family:\s*Georgia/);
});

test("class learner reports messages schedule and profile keep responsive operational layouts", () => {
  assert.match(css, /\.teacher-page > \.teacher-class-metrics[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.teacher-page \.teacher-table-wrap[\s\S]*overflow:\s*auto/);
  assert.match(css, /\.teacher-schedule-items > article[\s\S]*grid-template-columns:\s*108px minmax\(0, 1fr\) 118px/);
  assert.match(css, /\.teacher-profile[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
});

test("secondary tab V10 remains presentation only", () => {
  assert.doesNotMatch(css, /fetch\s*\(|localStorage|sessionStorage|indexedDB|course_activity_events|qualityScore|PHASE_THRESHOLDS|\/api\//);
});
