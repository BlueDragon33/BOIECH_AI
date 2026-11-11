import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = name => readFileSync(new URL("../app/"+name,import.meta.url),"utf8");
const css = read("role-readable-v9.css");
const student = read("student-role-shell.tsx");
const teacher = read("teacher-role-shell.tsx");
const adaptive = read("student-adaptive-coach.tsx");
const layout = read("layout.tsx");
const rule = selector => {
  const start=css.indexOf(selector+"{");
  assert.ok(start>=0,"CSS selector missing: "+selector);
  const end=css.indexOf("}",start);
  assert.ok(end>start,"CSS brace missing: "+selector);
  return css.slice(start,end);
};

test("remove seven redundant learner buttons without removing actual navigation",()=>{
 assert.doesNotMatch(student,/student-capabilities|<Capability|function Capability\(/);
 for(const text of ['Lộ trình học','Bài học','Thực hành','Kết quả','Hồ sơ'])
   assert.ok(student.includes(text),"sidebar route missing: "+text);
 assert.match(student,/data-student-adaptive-mount/);
 assert.match(student,/id="student-learning-roadmap"/);
 assert.match(student,/data-student-teacher-inbox-mount/);
});

test("remove duplicate teacher shortcut wall, retain real operational panels",()=>{
 assert.doesNotMatch(teacher,/teacher-capability-grid|<CapabilityGrid|Những gì giảng viên có thể làm/);
 for(const label of ['Tổng quan lớp phụ trách','Danh sách học viên cần chú ý','Phân tích gần đây cần xem','Công việc hôm nay','Bảng kiểm giám sát AI'])
   assert.ok(teacher.includes(label),"true teacher workflow missing: "+label);
 for(const tab of ['"learners"','"tasks"','"reports"'])
   assert.ok(teacher.includes("tab === "+tab),"teacher tab missing: "+tab);
});

test("learner adaptive three actionable plan cards scale by the canonical font setting",()=>{
 assert.match(adaptive,/student-adaptive-coach/);
 for(const [selector,size] of [
   ['body[data-student-role-ui="active"] .student-adaptive-plan-grid strong',16],
   ['body[data-student-role-ui="active"] .student-adaptive-plan-grid p',13],
   ['body[data-student-role-ui="active"] .student-adaptive-heading strong',17],
   ['body[data-student-role-ui="active"] .student-adaptive-competencies>div',13]
 ]) assert.ok(rule(selector).includes("font-size:calc("+size+"px + var(--font-adjust,0px))!important"));
 assert.match(css,/student-adaptive-body/);
});

test("teacher Learners Tasks Reports real content scales, not just titles",()=>{
 for(const selector of [
  'body[data-teacher-role-ui="active"] .teacher-roster-manager>header h2',
  'body[data-teacher-role-ui="active"] .teacher-smart-card footer button',
  'body[data-teacher-role-ui="active"] .teacher-loop-summary strong',
  'body[data-teacher-role-ui="active"] .teacher-smart-card :is(h3,header strong)'
 ]) assert.match(rule(selector),/var\(--font-adjust,0px\)/);
 assert.match(css,/\.teacher-roster-table :is\(th,td,strong,small\)/);
 assert.match(css,/\.teacher-loop-evidence :is\(span,small,i\)/);
 assert.match(css,/\.teacher-smart-card :is\(/);
});

test("scrollbar cosmetic cleanup does not disable sidebar scroll",()=>{
 const studentSidebar=rule('body[data-student-role-ui="active"] .sidebar,\nbody[data-teacher-role-ui="active"] .sidebar');
 assert.match(studentSidebar,/overflow-y:auto!important/);
 assert.match(studentSidebar,/scrollbar-width:none!important/);
 assert.match(css,/\.sidebar::-webkit-scrollbar/);
 assert.match(css,/\.topbar-actions::-webkit-scrollbar/);
 assert.doesNotMatch(studentSidebar,/overflow-y:hidden/);
});

test("final layout is compact and responsive with no orphaned duplicate menu section",()=>{
 assert.match(css,/\.teacher-upper-grid\{\s*display:grid!important/);
 assert.match(css,/\.student-teacher-inbox-mount:empty\{\s*display:none/);
 assert.match(css,/\.student-adaptive-coach-mount:not\(:empty\)/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/@media\(max-width:950px\)/);
 assert.match(css,/@media\(max-width:1500px\)/);
 assert.doesNotMatch(css,/\/\* Seven fixed feature cards were squeezing/);
 assert.ok(layout.indexOf('import "./role-readable-v9.css"')>layout.indexOf('import "./teacher-premium-v9-layout-clean.css"'));
});

test("the visible UI cleanup does not touch permissions or backend",()=>{
 assert.match(read("page.tsx"),/boi-ech-appearance-v1/);
 assert.match(read("page.tsx"),/--font-adjust/);
 assert.doesNotMatch(css,/fetch\(|ALTER TABLE|DELETE FROM|wrangler deploy/);
});
