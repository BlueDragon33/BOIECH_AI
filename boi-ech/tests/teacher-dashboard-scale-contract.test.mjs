import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../app/teacher-dashboard-scale-v3.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("teacher scale layer is loaded after the blueprint layer", () => {
  const blueprint = layout.indexOf('import "./teacher-dashboard-blueprint.css"');
  const scale = layout.indexOf('import "./teacher-dashboard-scale-v3.css"');
  assert.ok(blueprint >= 0);
  assert.ok(scale > blueprint);
});

test("teacher dashboard avoids miniature typography on desktop", () => {
  assert.match(css, /--td3-nav:\s*14px/);
  assert.match(css, /--td3-panel:\s*16px/);
  assert.match(css, /\.teacher-role-nav-list button span \{ font-size: var\(--td3-nav\)/);
  assert.match(css, /\.teacher-white-card > header strong \{ font-size: var\(--td3-panel\)/);
  assert.match(css, /\.teacher-table td \{[^}]*font-size:\s*10\.5px/s);
  assert.match(css, /\.teacher-task-list span \{ font-size:\s*10\.5px/);
});

test("teacher desktop composition keeps the reference three-zone proportions", () => {
  assert.match(css, /\.sidebar \{ width:\s*218px/);
  assert.match(css, /\.teacher-overview-layout \{ grid-template-columns: minmax\(0, 1fr\) 382px/);
  assert.match(css, /@media \(min-width: 1440px\)[\s\S]*390px/);
});

test("teacher scale layer does not change data, APIs, scoring or persistence", () => {
  assert.doesNotMatch(css, /fetch\s*\(/);
  assert.doesNotMatch(css, /localStorage|sessionStorage|indexedDB|qualityScore|PHASE_THRESHOLDS|serverPayload/);
  assert.doesNotMatch(css, /transform:\s*scale\(|zoom\s*:/);
});
