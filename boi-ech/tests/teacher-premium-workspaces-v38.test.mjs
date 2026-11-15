import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=(path)=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const role=read("../app/teacher-role-shell.tsx");
const ui=read("../app/teacher-premium-workspaces-v38.tsx");
const styles=read("../app/teacher-contrast-content-first.css");
const chat=read("../app/teacher-learner-conversations.tsx");
const chatStyles=read("../app/teacher-learner-conversations.module.css");

test("action drawer closes before modal; action dialog is portal-mounted above app shell",()=>{
 assert.match(role,/const openAction=\(draft:TeacherActionDraft\)=>\{setSelectedLearner\(null\);setActionDraft\(draft\);\}/);
 assert.match(role,/createPortal\(<TeacherActionDialog[\s\S]*?document\.body\)/);
 assert.match(role,/className="teacher-action-backdrop teacher-premium-action-backdrop"/);
 assert.match(role,/role="dialog" aria-modal="true"/);
 assert.match(styles,/\.teacher-premium-action-backdrop\s*\{\s*z-index:2147481600/);
 assert.match(role,/document\.body\.style\.overflow="hidden"/);
 assert.match(role,/event\.key==="Escape"/);
});

test("four teacher premium screens retain existing server-scoped data and actions",()=>{
 for(const kind of ["learners","tasks","reports","messages"])
  assert.match(role,new RegExp('data-premium-workspace="'+kind+'"'));
 assert.match(role,/<TeacherPremiumMetrics tab="learners" learners=\{workScopedLearners\} assignments=\{workScopedAssignments\}/);
 assert.match(role,/<TeacherPremiumMetrics tab="tasks" learners=\{workScopedLearners\} assignments=\{workScopedAssignments\}/);
 assert.match(role,/<TeacherPremiumMetrics tab="reports" learners=\{workScopedLearners\} assignments=\{workScopedAssignments\}/);
 assert.match(role,/<TeacherAssignmentSchedule assignments=\{workScopedAssignments\}/);
 assert.match(role,/<TeacherPremiumProgress learners=\{workScopedLearners\}/);
 assert.match(role,/exportTeacherReport\(workScopedLearners/);
 assert.match(ui,/assignments\.filter/);
 assert.match(ui,/learners\.filter/);
});

test("teacher chat supports immediate learner selection and context action without selecting inbox",()=>{
 assert.match(chat,/const target=role==="teacher"\?\(available\.some/);
 assert.match(chat,/onClick=\{\(\)=>\{setSelected\(l\.personCode\);resetDraft\(\)/);
 assert.match(chat,/onLearnerAction\?\.\(target,"assignment"\)/);
 assert.match(chat,/onLearnerAction\?\.\(target,"feedback"\)/);
 assert.match(role,/onLearnerAction=\{\(personCode,mode\)=>/);
 assert.match(chat,/role="teacher"/);
 assert.match(chatStyles,/\.workspace\{display:grid;grid-template-columns:/);
 assert.match(chatStyles,/\.shell\[data-role="learner"\] \.workspace/);
});

test("modal and premium tabs have mobile layout, focus and reduced motion contracts",()=>{
 assert.match(styles,/@media\(max-width:650px\)/);
 assert.match(styles,/\.teacher-premium-action-dialog \.teacher-action-row\.triple\{grid-template-columns:1fr\}/);
 assert.match(styles,/:focus-visible/);
 assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
 assert.match(chatStyles,/@media\(max-width:760px\)/);
 assert.match(chatStyles,/@media\(prefers-reduced-motion:reduce\)/);
});

test("chat keep source-of-truth and retain last acknowledged-send behavior",()=>{
 assert.match(chat,/conversationRequest\(deviceId,\{action:"send"/);
 assert.match(chat,/setNotice\("Đã gửi và lưu thành công\."\)/);
 assert.match(chat,/Hiển thị đang đồng bộ lại, không cần gửi lần nữa/);
 assert.match(chat,/setInboxSyncError/);
 assert.match(chat,/setHistorySyncError/);
});
