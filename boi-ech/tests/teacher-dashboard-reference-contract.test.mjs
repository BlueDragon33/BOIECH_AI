import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const shell = fs.readFileSync(path.join(root, 'app/teacher-role-shell.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app/teacher-dashboard-reference.css'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'app/layout.tsx'), 'utf8');

test('teacher overview follows the reference three-zone supervision layout', () => {
  assert.match(shell, /teacher-overview-layout/);
  assert.match(shell, /teacher-overview-main/);
  assert.match(shell, /teacher-right-rail/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*354px/);
});

test('teacher topbar has real learner search with Ctrl K shortcut', () => {
  assert.match(shell, /TeacherSearch/);
  assert.match(shell, /Ctrl K/);
  assert.match(shell, /matchesQuery/);
  assert.match(shell, /setTab\("learners"\)/);
});

test('teacher dashboard exposes actionable supervision surfaces', () => {
  for (const label of [
    'Những gì giảng viên có thể làm',
    'Tổng quan lớp phụ trách',
    'Danh sách học viên cần chú ý',
    'Phân tích gần đây cần xem',
    'Công việc hôm nay',
    'Cảnh báo nhanh',
    'Bảng kiểm giám sát AI',
  ]) assert.ok(shell.includes(label), `missing ${label}`);
  assert.match(shell, /onSelect=\{setSelectedLearner\}/);
  assert.match(shell, /openTeacherEditor/);
});

test('teacher overview keeps supervision honest about server media limits', () => {
  assert.match(shell, /Video gốc không được lưu trên máy chủ/);
  assert.match(shell, /media-free/);
  assert.doesNotMatch(shell, /upload.*learner.*video/is);
});

test('reference visual layer loads after the role and typography styles', () => {
  const roleIndex = layout.indexOf('./teacher-role-shell.css');
  const typographyIndex = layout.indexOf('./role-typography.css');
  const referenceIndex = layout.indexOf('./teacher-dashboard-reference.css');
  assert.ok(roleIndex >= 0 && typographyIndex > roleIndex && referenceIndex > typographyIndex);
  assert.match(css, /teacher-capability-grid/);
  assert.match(css, /teacher-analysis-queue-list/);
  assert.match(css, /teacher-drawer-backdrop/);
});

test('responsive reference layout collapses without dropping the right rail', () => {
  assert.match(css, /@media \(max-width: 1080px\)/);
  assert.match(css, /\.teacher-overview-layout \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.teacher-right-rail \{ grid-template-columns: repeat\(2,minmax\(0,1fr\)\); \}/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.teacher-right-rail \{ grid-template-columns: 1fr; \}/);
});
