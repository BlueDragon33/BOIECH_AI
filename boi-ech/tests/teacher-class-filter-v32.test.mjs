import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync(new URL("../app/teacher-class-workspace.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/teacher-class-filter-v32.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("V32 adds multi-class search filter and sort controls", () => {
  for (const label of ["Tất cả lớp", "Cần chú ý", "Có học viên", "Chưa có học viên", "Tìm lớp học", "Ưu tiên can thiệp", "Tiến độ thấp trước", "Hoạt động gần nhất", "Tên A–Z"]) {
    assert.ok(workspace.includes(label), label);
  }
  assert.match(workspace, /classQuery/);
  assert.match(workspace, /classFilter/);
  assert.match(workspace, /classSort/);
  assert.match(workspace, /visibleSummaries/);
});

test("V32 triage filters use only derived real class data", () => {
  assert.match(workspace, /item\.support > 0/);
  assert.match(workspace, /item\.learners\.length > 0/);
  assert.match(workspace, /item\.learners\.length === 0/);
  assert.match(workspace, /left\.averageProgress - right\.averageProgress/);
  assert.match(workspace, /Date\.parse\(right\.lastActivityAt/);
  assert.doesNotMatch(workspace, /K01|K02|K03|32 học viên|52 học viên/);
});

test("V32 keeps selected class detail independent from the visible filter set", () => {
  assert.match(workspace, /const selected = summaries\.find/);
  assert.match(workspace, /visibleSummaries\.map/);
  assert.doesNotMatch(workspace, /const selected = visibleSummaries\.find/);
});

test("V32 has a clear no-result state and bounded search input", () => {
  assert.match(workspace, /event\.target\.value\.slice\(0, 80\)/);
  assert.match(workspace, /Không có lớp phù hợp với bộ lọc hiện tại/);
  assert.match(workspace, /Hiển thị \{visibleSummaries\.length\}\/\{summaries\.length\} lớp/);
});

test("V32 design layer loads after V30 and responds down to phone width", () => {
  const v30 = layout.indexOf('import "./teacher-control-center-v30.css"');
  const v32 = layout.indexOf('import "./teacher-class-filter-v32.css"');
  assert.ok(v30 >= 0 && v32 > v30);
  assert.match(css, /\.teacher-class-control-toolbar/);
  assert.match(css, /\.teacher-class-filter-tabs/);
  assert.match(css, /\.teacher-class-search/);
  assert.match(css, /\.teacher-class-sort/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(max-width: 440px\)/);
});
