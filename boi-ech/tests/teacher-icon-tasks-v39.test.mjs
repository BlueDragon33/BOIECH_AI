import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const shell=read("../app/teacher-role-shell.tsx");
const shortcuts=read("../app/teacher-task-icon-v39.tsx");
const schedule=read("../app/teacher-assignment-schedule.tsx");
const suggestions=read("../app/teacher-smart-interventions.tsx");
const metrics=read("../app/teacher-premium-workspaces-v38.tsx");
const css=read("../app/teacher-task-icon-v39.css");
const layout=read("../app/layout.tsx");

test("V39 icon assignment UI wins after contrast policy without touching global roles",()=>{
 assert.ok(layout.indexOf('import "./teacher-task-icon-v39.css"')>layout.indexOf('import "./teacher-contrast-content-first.css"'));
 assert.match(shell,/className="teacher-page premium-teacher-tab premium-tasks-tab icon-tasks-v39"/);
 assert.match(css,/body\[data-teacher-role-ui="active"\] \.icon-tasks-v39/);
 assert.match(css,/@media\(max-width:1130px\)/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/@media\(max-width:440px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/:focus-visible/);
});

test("V39 shortcut tiles trigger real scoped filtering, a manual assignment picker and AI panel",()=>{
 assert.match(shell,/assignments=\{workScopedAssignments\} learners=\{workScopedLearners\.map/);
 assert.match(shell,/filter=\{taskFilter\} onFilterChange=\{setTaskFilter\}/);
 assert.match(shell,/showCreator=\{taskCreatorOpen\} onCreatorChange=\{setTaskCreatorOpen\}/);
 assert.match(shortcuts,/label>Học viên <select value=\{selected\}/);
 assert.match(shortcuts,/onAssign\(selected\)/);
 assert.match(shortcuts,/onCreatorChange\(false\)/);
 assert.match(shortcuts,/jumpToSuggestions/);
 assert.match(shortcuts,/teacher-task-ai-v39/);
 assert.match(shortcuts,/onFilterChange\("overdue"\)/);
 assert.match(shortcuts,/onFilterChange\("needs-help"\)/);
 assert.match(shell,/openAction\(\{mode:"assignment",learner\}\)/);
});

test("V39 preserves honest assignment counts and per-person server state without invented progress",()=>{
 assert.match(metrics,/Tổng bài tập/);
 assert.match(metrics,/Đang thực hiện/);
 assert.match(metrics,/Quá hạn/);
 assert.match(metrics,/Cần hỗ trợ/);
 assert.match(metrics,/Đã hoàn thành/);
 assert.match(shortcuts,/assignments\.filter\(a=>a\.scheduleState==="overdue"\)/);
 assert.match(schedule,/assignments\.filter\(item=>matchesFilter\(item,filter\)\)/);
 assert.match(schedule,/item\.learnerName/);
 assert.match(schedule,/item\.className/);
 assert.match(schedule,/item\.lessonNumber/);
 assert.match(schedule,/item\.dueAt/);
 assert.match(schedule,/item\.scheduleState/);
 assert.match(schedule,/onOpen\(item\.personCode\)/);
 assert.doesNotMatch(schedule,/Math\.random|mockData|fakeProgress|assignment\.progress|progressPercent/);
 assert.match(schedule,/aria-expanded=\{open\}/);
 assert.match(schedule,/onClick=\{\(\)=>setExpanded\(open\?null:item\.id\)\}/);
});

test("V39 suggestions remain scoped and require human action, no auto-send",()=>{
 assert.match(shell,/<TeacherSmartInterventions learners=\{workScopedLearners\} onUse=/);
 assert.match(shell,/suggestedNote:suggestion\.noteTemplate/);
 assert.match(shell,/suggestedTitle:suggestion\.title/);
 assert.match(shell,/suggestedLessonNumber:suggestion\.lessonNumber/);
 assert.match(suggestions,/Giảng viên phải duyệt nội dung trước khi gửi/);
 assert.match(suggestions,/onClick=\{\(\)=>onUse\(learner\.personCode,suggestion\)\}/);
 assert.doesNotMatch(suggestions,/fetch\(|\/api\/teacher\/action|window\.location|autoSubmit/);
 assert.match(shell,/createPortal\(<TeacherActionDialog/);
});

test("V39 actionable priority strip jumps to filtered list and safely opens reports/create",()=>{
 assert.match(shortcuts,/const focusList=\(next:TaskFilter\)=>\{onFilterChange\(next\);document\.getElementById\("teacher-task-list-v39"\)/);
 assert.match(schedule,/id="teacher-task-list-v39"/);
 assert.match(shortcuts,/action:()=>focusList\("overdue"\)/);
 assert.match(shortcuts,/action:()=>focusList\("needs-help"\)/);
 assert.match(shortcuts,/action:onCreate/);
 assert.match(shortcuts,/action:onReports/);
 assert.match(shell,/onReports=\{\(\)=>setTab\("reports"\)\}/);
 assert.match(shell,/onCreate=\{\(\)=>\{setTaskCreatorOpen\(true\)/);
 assert.match(shortcuts,/Không có học viên trong phạm vi/);
});
