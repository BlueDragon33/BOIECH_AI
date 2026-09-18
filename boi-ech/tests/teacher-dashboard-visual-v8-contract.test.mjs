import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../app/teacher-dashboard-visual-v8.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("visual V8 loads after all teacher data and action layers", () => {
  const reference = layout.indexOf('import "./teacher-dashboard-reference.css"');
  const structure = layout.indexOf('import "./teacher-dashboard-structure-v4.css"');
  const visual = layout.indexOf('import "./teacher-dashboard-visual-v5.css"');
  const data = layout.indexOf('import "./teacher-dashboard-data-v6.css"');
  const actions = layout.indexOf('import "./teacher-dashboard-actions-v7.css"');
  const finalVisual = layout.indexOf('import "./teacher-dashboard-visual-v8.css"');
  assert.ok(reference >= 0);
  assert.ok(structure > reference);
  assert.ok(visual > structure);
  assert.ok(data > visual);
  assert.ok(actions > data);
  assert.ok(finalVisual > actions);
});

test("visual V8 targets the supplied desktop three-zone proportions", () => {
  assert.match(css, /--td8-sidebar:\s*220px/);
  assert.match(css, /--td8-rail:\s*372px/);
  assert.match(css, /grid-template-columns:\s*var\(--td8-sidebar\) minmax\(0, 1fr\)/);
  assert.match(css, /\.teacher-overview-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) var\(--td8-rail\)/);
  assert.match(css, /\.teacher-hero\s*\{[\s\S]*min-height:\s*226px/);
});

test("desktop work surfaces are compact without hiding learner or analysis rows", () => {
  assert.match(css, /\.teacher-capability-grid\s*\{[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.teacher-class-summary \.teacher-class-metrics\s*\{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.teacher-watchlist \.teacher-table-wrap\s*\{[\s\S]*max-height:\s*252px[\s\S]*overflow:\s*auto/);
  assert.match(css, /\.teacher-analysis-queue-list\s*\{[\s\S]*max-height:\s*252px[\s\S]*overflow:\s*auto/);
  assert.match(css, /\.teacher-table thead\s*\{[\s\S]*position:\s*sticky/);
});

test("visual V8 preserves four real analysis actions and responsive usability", () => {
  assert.match(css, /\.teacher-analysis-actions\s*\{[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*\.teacher-overview-layout\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.teacher-capability-grid\s*\{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.teacher-capability-grid,[\s\S]*grid-template-columns:\s*1fr/);
});

test("visual V8 remains presentation only", () => {
  assert.doesNotMatch(css, /fetch\s*\(|localStorage|sessionStorage|indexedDB|qualityScore|PHASE_THRESHOLDS|course_activity_events|\/api\//);
  assert.doesNotMatch(css, /display:\s*none[^;]*;[^\n]*(teacher-table|teacher-analysis-queue-list)/);
});
