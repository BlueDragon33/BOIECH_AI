import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const blueprint = fs.readFileSync(new URL("../app/teacher-dashboard-blueprint.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/teacher-dashboard-data-v6.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("teacher data V6 loads after the visual fidelity layer", () => {
  const visual = layout.indexOf('import "./teacher-dashboard-visual-v5.css"');
  const data = layout.indexOf('import "./teacher-dashboard-data-v6.css"');
  assert.ok(visual >= 0);
  assert.ok(data > visual);
});

test("teacher dashboard derives additional indicators only from returned learner evidence", () => {
  assert.match(shell, /function teacherInsights\(learners: TeacherLearner\[\]\)/);
  assert.match(shell, /completedCount = learners\.filter/);
  assert.match(shell, /averageConfidence = analyses\.length/);
  assert.match(shell, /totalStudyMinutes = learners\.reduce/);
  assert.match(shell, /completionRate = learners\.length/);
  assert.match(shell, /issueCounts = new Map<string, number>/);
  assert.doesNotMatch(shell, /Math\.random\(|mockLearner|fakeData|demoData/);
});

test("teacher overview exposes six honest KPI tiles and richer supervision states", () => {
  for (const label of [
    "Hoạt động 7 ngày",
    "Hoàn thành đủ 8 bài",
    "Phân tích AI",
    "Cần hỗ trợ",
    "Tiến độ trung bình",
    "Tin cậy AI trung bình",
  ]) assert.ok(shell.includes(label), label);
  assert.ok(shell.includes("Dữ liệu hiện có · không nội suy số liệu giả"));
  assert.ok(shell.includes("Lỗi phổ biến gần nhất"));
});

test("teacher review state reflects real analysis quality instead of always claiming review", () => {
  assert.match(shell, /data-analysis-quality=\{quality\}/);
  assert.match(blueprint, /article\.dataset\.analysisQuality === "good"/);
  assert.match(blueprint, /quality === "good" \? "Đủ bằng chứng" : "Cần xem"/);
});

test("teacher V6 uses informative empty states without fabricated learners or media", () => {
  assert.match(shell, /teacher-rich-empty/);
  assert.ok(shell.includes("Khi quản trị duyệt học viên đúng lớp phụ trách"));
  assert.ok(shell.includes("Video gốc vẫn ở thiết bị của người dùng"));
  assert.match(css, /\.teacher-rich-empty/);
});

test("teacher V6 remains media-free and does not change scoring or persistence", () => {
  assert.doesNotMatch(css, /fetch\s*\(|qualityScore|PHASE_THRESHOLDS|serverPayload|localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(shell, /mockLearner|fakeData|demoData/);
});
