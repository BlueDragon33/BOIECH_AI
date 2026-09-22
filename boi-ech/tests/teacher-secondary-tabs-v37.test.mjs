import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("V37 secondary teacher tabs use the modern reference design layer", () => {
  const layout = read("app/layout.tsx");
  const shell = read("app/teacher-role-shell.tsx");
  const css = read("app/teacher-secondary-tabs-v37.css");

  assert.match(layout, /teacher-secondary-tabs-v37\.css/);
  for (const tab of ["messages", "schedule", "profile", "analysis"]) {
    assert.match(shell, new RegExp(`data-teacher-secondary="${tab}"`));
  }
  assert.match(css, /teacher-secondary-modern/);
  assert.match(css, /teacher-secondary-metrics-v37/);
  assert.match(css, /teacher-profile-v37/);
  assert.match(css, /teacher-analysis-page-v37/);
});

test("V37 messages and schedule expose filters without changing server contracts", () => {
  const messages = read("app/teacher-two-way-messages.tsx");
  const schedule = read("app/teacher-assignment-schedule.tsx");

  assert.match(messages, /teacher-message-toolbar-v37/);
  assert.match(messages, /useMemo/);
  assert.match(schedule, /teacher-schedule-toolbar-v37/);
  assert.match(schedule, /teacher-schedule-summary-v37/);
  assert.doesNotMatch(messages, /fetch\(/);
  assert.doesNotMatch(schedule, /fetch\(/);
});

test("V37 local video page and analyzer share the dark visual system", () => {
  const page = read("app/phan-tich-video/page.tsx");
  const privacy = read("app/phan-tich-video/privacy-consent.tsx");
  const videoCss = read("app/video-analysis-v37.css");
  const analyzerCss = read("app/phan-tich-video/video-analyzer.module.css");

  assert.match(page, /data-video-analysis-v37/);
  assert.match(privacy, /video-consent-card-v37/);
  assert.match(videoCss, /linear-gradient\(180deg, #082338, #061927/);
  assert.match(analyzerCss, /V37 dark reference skin/);
});
