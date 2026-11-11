import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../app/teacher-dashboard-visual-v5.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");

test("teacher visual V5 loads after structure V4", () => {
  const structure = layout.indexOf('import "./teacher-dashboard-structure-v4.css"');
  const visual = layout.indexOf('import "./teacher-dashboard-visual-v5.css"');
  assert.ok(structure >= 0);
  assert.ok(visual > structure);
});

test("teacher visual V5 preserves reference bright center and dark supervision rail", () => {
  assert.match(css, /\.teacher-white-card\s*\{[\s\S]*background:\s*#fff/);
  assert.match(css, /\.teacher-rail-card\s*\{[\s\S]*background:/);
  assert.match(css, /\.teacher-capability-grid\s*\{[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
});

test("teacher hero and command bar use reference visual hierarchy", () => {
  assert.match(css, /\.teacher-hero-motto/);
  assert.match(css, /\.teacher-hero::before/);
  assert.match(css, /\.teacher-mode-badge/);
  assert.match(css, /\.teacher-search/);
  assert.ok(shell.includes("Theo dõi kỹ thuật · Đưa phản hồi · Nâng cao thành tích"));
});

test("teacher retains actual navigation without obsolete shortcut wall",()=>{
 for(const label of ["Tổng quan","Lớp học","Học viên","Bài tập","Báo cáo","Tin nhắn","Lịch dạy","Hồ sơ chuyên môn","Phân tích video"]){
  assert.ok(shell.includes('label: "'+label+'"'),label);
 }
 assert.doesNotMatch(shell,/Những gì giảng viên có thể làm/);
});

test("teacher visual V5 is presentation-only", () => {
  assert.doesNotMatch(css, /fetch\s*\(|qualityScore|PHASE_THRESHOLDS|serverPayload|localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(css, /transform:\s*scale\(|zoom\s*:/);
});
