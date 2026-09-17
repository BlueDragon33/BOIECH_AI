import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const blueprint = fs.readFileSync(new URL("../app/teacher-dashboard-blueprint.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/teacher-dashboard-blueprint.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("teacher blueprint is mounted after the existing role shell and reference styles", () => {
  assert.match(layout, /import "\.\/teacher-dashboard-reference\.css";/);
  assert.match(layout, /import "\.\/teacher-dashboard-blueprint\.css";/);
  assert.match(layout, /import TeacherDashboardBlueprint from "\.\/teacher-dashboard-blueprint";/);
  assert.match(layout, /<TeacherRoleShell \/>[\s\S]*<TeacherDashboardBlueprint \/>/);
});

test("teacher blueprint adds the missing reference controls without creating another data API", () => {
  assert.match(blueprint, /teacher-watch-toolbar/);
  assert.match(blueprint, /data-watch-filter="support"/);
  assert.match(blueprint, /data-watch-filter="slow"/);
  assert.match(blueprint, /data-watch-filter="weak-ai"/);
  assert.match(blueprint, /teacher-alert-shortcut/);
  assert.match(blueprint, /teacher-hero-dots/);
  assert.match(blueprint, /teacher-dashboard-footer/);
  assert.doesNotMatch(blueprint, /fetch\(/);
  assert.doesNotMatch(blueprint, /\/api\//);
});

test("teacher watch filters use existing rendered supervision evidence instead of changing learner scores", () => {
  assert.match(blueprint, /rowNeedsSupport/);
  assert.match(blueprint, /rowProgress/);
  assert.match(blueprint, /rowHasWeakAi/);
  assert.match(blueprint, /row\.hidden = !show/);
  assert.doesNotMatch(blueprint, /qualityScore/);
  assert.doesNotMatch(blueprint, /PHASE_THRESHOLDS/);
  assert.doesNotMatch(blueprint, /serverPayload/);
});

test("teacher local review note is session-memory only and cannot impersonate server review", () => {
  assert.match(blueprint, /notes: Map<string, string>/);
  assert.match(blueprint, /Không đồng bộ máy chủ/);
  assert.match(blueprint, /chưa gửi tới học viên/);
  assert.doesNotMatch(blueprint, /localStorage/);
  assert.doesNotMatch(blueprint, /sessionStorage/);
  assert.doesNotMatch(blueprint, /indexedDB/);
});

test("visual blueprint preserves three-zone desktop composition and responsive collapse", () => {
  assert.match(css, /\.teacher-overview-layout\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) 344px/);
  assert.match(css, /\.teacher-upper-grid\s*\{[\s\S]*grid-template-columns: minmax\(0, 1\.54fr\)/);
  assert.match(css, /\.teacher-lower-grid\s*\{[\s\S]*grid-template-columns: minmax\(0, 1\.54fr\)/);
  assert.match(css, /@media \(max-width: 1080px\)[\s\S]*\.teacher-overview-layout \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.teacher-right-rail \{ grid-template-columns: 1fr; \}/);
});
