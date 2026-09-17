import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const typography = readFileSync(new URL("../app/role-typography.css", import.meta.url), "utf8");
const teacher = readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");

test("role typography override loads after learner and teacher shell styles", () => {
  const studentIndex = layout.indexOf('import "./student-role-shell.css"');
  const teacherIndex = layout.indexOf('import "./teacher-role-shell.css"');
  const typographyIndex = layout.indexOf('import "./role-typography.css"');
  assert.ok(studentIndex >= 0);
  assert.ok(teacherIndex > studentIndex);
  assert.ok(typographyIndex > teacherIndex);
});

test("role dashboards use Vietnamese-safe offline font stacks", () => {
  assert.match(typography, /--role-ui-font:\s*"Segoe UI",\s*"Noto Sans"/);
  assert.match(typography, /--role-display-font:\s*Cambria,\s*"Noto Serif",\s*"Times New Roman",\s*"DejaVu Serif"/);
  assert.match(typography, /\.student-hero h1,\s*\n\.teacher-hero h1/);
  assert.match(typography, /font-kerning:\s*normal/);
  assert.match(typography, /word-spacing:\s*0/);
});

test("teacher hero Vietnamese copy remains NFC-normalized and tracking-safe", () => {
  const phrase = "dẫn dắt tiến bộ mỗi ngày.";
  assert.equal(phrase, phrase.normalize("NFC"));
  assert.ok(teacher.includes(phrase));
  assert.match(typography, /letter-spacing:\s*-0\.022em/);
  assert.match(typography, /word-break:\s*normal/);
  assert.match(typography, /hyphens:\s*none/);
});

test("role typography has no network font dependency", () => {
  assert.doesNotMatch(typography, /@import\s+url/i);
  assert.doesNotMatch(typography, /fonts\.googleapis\.com/i);
});
