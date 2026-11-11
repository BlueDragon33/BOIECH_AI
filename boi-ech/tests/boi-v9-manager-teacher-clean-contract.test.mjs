import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=file=>readFileSync(new URL("../app/"+file,import.meta.url),"utf8");
const manager=read("manager-workspace.tsx");
const teacher=read("teacher-role-shell.tsx");
const roster=read("teacher-roster-manager.tsx");
const route=read("api/teacher/roster/route.ts");
const layout=read("layout.tsx");
const teacherFix=read("teacher-premium-v9-layout-clean.css");

test("BOI manager never links back to Application-Management",()=>{
 assert.doesNotMatch(manager,/https?:\/\/[^"']*application-management/);
 assert.doesNotMatch(manager,/Mở Trung tâm quản trị|Quyền & kết nối/);
 assert.match(manager,/aria-label="Mở menu tài khoản Cán bộ quản lý"/);
 assert.match(manager,/Đăng xuất tài khoản/);
});
test("Manager no longer exposes fake preview after independent 8h trial implementation",()=>{
 assert.doesNotMatch(manager,/previewOnly|Xem thử không cần cấp quyền|data-manager-preview/);
 assert.match(manager,/ManagerApprovalPanel getProof=\{getProof\}/);
});
test("Teacher manager-owned actions cannot be found in roster UI or API",()=>{
 assert.doesNotMatch(roster,/const mutate|action:"approve"|action:"remove"/);
 assert.match(route,/payload\.action!=="list"/);
 assert.match(route,/ACCOUNT_REVIEW_MANAGER_REQUIRED/);
 assert.match(route,/status='approved'/);
 assert.doesNotMatch(route,/UPDATE device_access|teacher_roster_approved|teacher_roster_removed/);
});
test("Teacher professional profile does not render secret/internal account codes",()=>{
 assert.doesNotMatch(teacher,/<dt>Số hiệu<\/dt>/);
 assert.doesNotMatch(teacher,/learner\.className \|\| learner\.personCode/);
 assert.match(teacher,/Phạm vi lớp được phân công/);
 assert.match(teacher,/Phạm vi lớp được phân công/);
 assert.doesNotMatch(teacher,/<button[^>]*>Duyệt tài khoản/);
});
test("Final teacher layout wins after historical CSS and prevents clipped viewport",()=>{
 const legacy=layout.indexOf('import "./teacher-dashboard-visual-v8.css"');
 const newer=layout.indexOf('import "./teacher-control-center-v30.css"');
 const final=layout.indexOf('import "./teacher-premium-v9-layout-clean.css"');
 assert.ok(final>legacy&&final>newer);
 assert.match(teacherFix,/max-height: none !important/);
 assert.match(teacherFix,/overflow: visible !important/);
 assert.match(teacherFix,/grid-template-columns: minmax\(0, 1fr\) !important/);
 assert.match(teacherFix,/@media \(max-width: 540px\)/);
});