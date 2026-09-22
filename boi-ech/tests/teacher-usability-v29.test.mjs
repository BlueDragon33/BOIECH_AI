import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/teacher-dashboard-usability-v29.css", import.meta.url), "utf8");
const blueprint = fs.readFileSync(new URL("../app/teacher-dashboard-blueprint.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const roster = fs.readFileSync(new URL("../app/teacher-roster-manager.tsx", import.meta.url), "utf8");

test("V29 teacher usability layer loads last among teacher visual layers", () => {
  const secondary = layout.indexOf('import "./teacher-secondary-tabs-v10.css"');
  const usability = layout.indexOf('import "./teacher-dashboard-usability-v29.css"');
  assert.ok(secondary >= 0);
  assert.ok(usability > secondary);
});

test("V29 fixes the sidebar flow bug instead of masking it with negative spacing", () => {
  assert.match(css, /\.app-shell\s*\{[\s\S]*display:\s*grid\s*!important/);
  assert.match(css, /grid-template-columns:\s*var\(--td8-sidebar, 220px\) minmax\(0, 1fr\)/);
  assert.match(css, /\.sidebar\s*\{[\s\S]*position:\s*sticky\s*!important/);
  assert.match(css, /\.main-area\s*\{[\s\S]*margin-left:\s*0\s*!important/);
  assert.doesNotMatch(css, /margin-top:\s*-\d|translateY\(-\d/);
});

test("V29 raises teacher typography to a readable desktop baseline", () => {
  assert.match(css, /\.teacher-dashboard\s*\{[\s\S]*font-size:\s*calc\(16px \+ var\(--font-adjust, 0px\)\)/);
  assert.match(css, /\.teacher-table td,[\s\S]*font-size:\s*calc\(14px \+ var\(--font-adjust, 0px\)\)/);
  assert.match(css, /\.teacher-role-nav-list button span\s*\{[\s\S]*15px/);
  assert.match(css, /\.teacher-search input\s*\{[\s\S]*15px/);
  assert.match(css, /\.teacher-watchlist \.teacher-table-wrap,[\s\S]*max-height:\s*390px/);
});

test("appearance settings control page content card accent density and radius", () => {
  for (const key of ["contentBackground", "cardBackground", "accent", "density", "radius", "theme"]) {
    assert.ok(page.includes(key), key);
  }
  assert.match(page, /--content-background/);
  assert.match(page, /--card-background/);
  assert.match(page, /--accent-color/);
  assert.match(page, /--ui-radius/);
  assert.match(page, /data-appearance-density=\{appearance\.density\}/);
  assert.match(page, /Sáng/);
  assert.match(page, /Tối/);
  assert.match(page, /Theo hệ thống/);
  assert.match(page, /Màu vùng nội dung/);
  assert.match(page, /Mật độ & bo góc/);
  assert.match(css, /\.topbar-actions > \.appearance-trigger\s*\{[\s\S]*display:\s*inline-flex\s*!important/);
});

test("teacher command bar refresh and roster sync actions are functional", () => {
  assert.match(blueprint, /teacher-topbar-refresh/);
  assert.match(blueprint, /boi-ech:teacher-refresh/);
  assert.match(blueprint, /teacher-topbar-sync/);
  assert.match(blueprint, /boi-ech:teacher-roster-sync/);
  assert.match(shell, /addEventListener\("boi-ech:teacher-refresh"/);
  assert.match(shell, /removeEventListener\("boi-ech:teacher-refresh"/);
  assert.match(roster, /addEventListener\("boi-ech:teacher-roster-sync"/);
  assert.match(roster, /removeEventListener\("boi-ech:teacher-roster-sync"/);
});

test("V29 remains a presentation and interaction layer without scoring contracts", () => {
  assert.doesNotMatch(css, /fetch\s*\(|\/api\/|indexedDB|qualityScore|PHASE_THRESHOLDS/);
});
