import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../app/teacher-dashboard-structure-v4.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const blueprint = fs.readFileSync(new URL("../app/teacher-dashboard-blueprint.tsx", import.meta.url), "utf8");

test("teacher structure V4 is the final visual layer", () => {
  const scale = layout.indexOf('import "./teacher-dashboard-scale-v3.css"');
  const structure = layout.indexOf('import "./teacher-dashboard-structure-v4.css"');
  assert.ok(scale >= 0);
  assert.ok(structure > scale);
});

test("teacher topbar removes learner-course controls without deleting their logic", () => {
  assert.match(css, /\.topbar-actions > \.top-status/);
  assert.match(css, /\.topbar-actions > \.payment-access-status/);
  assert.match(css, /\.topbar-actions > \.personal-content-actions/);
  assert.match(css, /\.topbar-actions > \.editor-request-link/);
  assert.match(css, /display:\s*none\s*!important/);
  assert.match(css, /\.network-state\.online i/);
  assert.match(blueprint, /badge\.textContent = "Giảng viên Pro"/);
});

test("teacher desktop composition follows sidebar center supervision rail reference", () => {
  assert.match(css, /--td4-sidebar:\s*218px/);
  assert.match(css, /--td4-rail:\s*378px/);
  assert.match(css, /\.teacher-overview-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) var\(--td4-rail\)/);
  assert.match(css, /@media \(min-width: 1440px\)[\s\S]*--td4-rail:\s*388px/);
  assert.match(css, /\.teacher-upper-grid\s*\{[\s\S]*1\.48fr/);
  assert.match(css, /\.teacher-lower-grid\s*\{[\s\S]*1\.44fr/);
});

test("teacher central work surfaces are bright while supervision rail stays dark", () => {
  assert.match(css, /\.teacher-white-card\s*\{[\s\S]*background:\s*var\(--td4-panel-bg\)/);
  assert.match(css, /\.teacher-capability-action\s*\{[\s\S]*background:\s*linear-gradient/);
  assert.match(css, /\.teacher-rail-card\s*\{[\s\S]*background:\s*linear-gradient/);
});

test("teacher navigation includes messages without inventing a message backend", () => {
  assert.match(shell, /"messages"/);
  assert.match(shell, /label: "Tin nhắn"/);
  assert.match(shell, /Kênh nhắn tin máy chủ chưa được triển khai/);
  assert.match(shell, /không tạo tin nhắn giả/);
});

test("structure layer does not alter data APIs scoring or persistence", () => {
  assert.doesNotMatch(css, /fetch\s*\(|qualityScore|PHASE_THRESHOLDS|serverPayload|localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(css, /transform:\s*scale\(|zoom\s*:/);
});
