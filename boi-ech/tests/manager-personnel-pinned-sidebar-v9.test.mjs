import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = name => readFileSync(new URL("../app/"+name,import.meta.url),"utf8");
const manager=read("manager-workspace.tsx");
const managerCss=read("manager-workspace.module.css");
const details=read("manager-details.tsx");
const roles=read("role-readable-v9.css");
const layout=read("layout.tsx");

test("Personnel is split into two real role groups, not a large shared card wall",()=>{
 assert.match(manager,/aria-label="Nhân sự theo vai trò"/);
 assert.match(manager,/\(\["learner","teacher"\] as const\)\.map\(role=>/);
 assert.match(manager,/const members=people\.filter\(person=>person\.role===role\)/);
 assert.match(manager,/Danh sách Giảng viên/);
 assert.match(manager,/Danh sách Học viên/);
 assert.doesNotMatch(manager,/aria-label="Danh sách nhân sự"/);
 assert.doesNotMatch(manager,/<PersonStatusBar person=\{p\}/);
});

test("Each person icon opens existing scoped profile details with authorized assignment",()=>{
 assert.match(manager,/className=\{styles\.personIconTile\}/);
 assert.match(manager,/onClick=\{\(\)=>setDetail\(\{kind:"person",id:person\.id\}\)\}/);
 assert.match(manager,/ManagerDetailSheet target=\{detail\} board=\{board\}/);
 assert.match(details,/<ManagerSheet title=\{resource\?\.name\|\|person\?\.name/);
 assert.match(details,/<PersonStatusBar person=\{person\}/);
 assert.match(details,/onAssignPerson\(person\)/);
 assert.match(details,/readOnly/);
});

test("Personnel uses actual filtered board data; no fabricated statuses or IDs",()=>{
 assert.match(manager,/const people=board\.people\.filter/);
 assert.match(manager,/const readiness=personReadiness\(person,board\.resources\)/);
 assert.match(manager,/<span className=\{styles\.peopleRoleCount\}/);
 assert.match(manager,/members\.length/);
 assert.doesNotMatch(manager,/personCode|Math\.random\(\)/);
});

test("Compact icons remain bounded within the existing manager page",()=>{
 assert.match(managerCss,/\.peopleGroups\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(managerCss,/\.peopleIconGrid\{display:grid;grid-template-columns:repeat\(auto-fill,minmax\(min\(100%,115px\),1fr\)\)/);
 assert.match(managerCss,/max-height:365px;overflow-y:auto/);
 assert.match(managerCss,/\.personIconTile/);
 assert.match(managerCss,/@media\(max-width:1150px\)\{\.peopleGroups\{grid-template-columns:minmax\(0,1fr\)/);
});

test("Manager sidebar is viewport-pinned with independent nav scroll",()=>{
 assert.match(manager,/className=\{styles\.desktopRail\}/);
 assert.match(manager,/className=\{styles\.railNavigation\}/);
 assert.match(managerCss,/\.desktopRail\{height:100dvh!important;max-height:100dvh!important;overflow:hidden!important/);
 assert.match(managerCss,/\.railNavigation\{display:flex;flex-direction:column;flex:1 1 auto;gap:5px;min-height:0;/);
 assert.match(managerCss,/overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain/);
 assert.match(managerCss,/\.railStatus\{flex:0 0 auto;margin-top:0!important/);
});

test("Student and teacher sidebars pin brand; only inner menu scrolls",()=>{
 assert.match(roles,/body\[data-student-role-ui="active"\] \.app-shell>\.sidebar,/);
 assert.match(roles,/body\[data-teacher-role-ui="active"\] \.app-shell>\.sidebar\{/);
 assert.match(roles,/position:fixed!important;top:0!important;bottom:0!important;left:0!important/);
 assert.match(roles,/body\[data-teacher-role-ui="active"\] \.app-shell>\.sidebar>\.teacher-role-nav-mount/);
 assert.match(roles,/body\[data-student-role-ui="active"\] \.app-shell>\.sidebar>\.student-role-nav-mount/);
 assert.match(roles,/overflow-y:auto!important;overflow-x:hidden!important/);
 assert.match(roles,/\.sidebar>\.brand-row\{/);
 assert.match(layout,/import "\.\/role-readable-v9\.css"/);
});

test("No authority or database migration is needed for a personnel icon UI",()=>{
 assert.doesNotMatch(managerCss,/https?:\/\/|fetch\(|ALTER TABLE|DELETE FROM/);
 assert.doesNotMatch(roles,/wrangler deploy|SELECT \* FROM|ALTER TABLE/);
 assert.match(manager,/tab==="approval"/);
 assert.match(manager,/onCommand\(\{action:"assign-person"/);
});
