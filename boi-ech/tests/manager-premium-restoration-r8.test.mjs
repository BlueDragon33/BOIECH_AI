import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(file)=>readFileSync(new URL("../app/"+file,import.meta.url),"utf8");

test("premium source is the historic REAL command center, not mock dashboard",()=>{
 const component=read("manager-command-center.tsx");
 const css=read("manager-command-center.module.css");
 for(const fragment of ["Trung tâm điều hành","Hệ thống cơ sở / tòa học",
   "Tòa → Phòng / Hồ → Lớp / Ca","Ưu tiên xử lý","sessionsInWindow","roomNeedsAttention","onOpenDetail"])
  assert.ok(component.includes(fragment),fragment);
 for(const key of [".hero{",".metricTile",".campus{",".buildingNode",".drillPanel",".roomGrid","@media"])
  assert.ok(css.includes(key),key);
 assert.ok(!component.includes("fetch("),"premium UI is driven by the existing signed board, not a parallel API");
});
test("premium is wired to main's Account-first V2 manager workspace without a second account registry",()=>{
 const ws=read("manager-workspace.tsx"),gate=read("account-gate.tsx");
 assert.match(ws,/import ManagerCommandCenter from "\.\/manager-command-center"/);
 assert.match(ws,/<ManagerCommandCenter board=\{board\} busy=\{busy\}/);
 assert.match(ws,/onCreateResource=\{newResource\}/);
 assert.match(ws,/onCreateSession=\{\(roomId,classId\)=>editSession\(undefined,roomId,classId\)\}/);
 assert.match(ws,/<aside className=\{styles\.desktopRail\}/);
 assert.match(ws,/Duyệt học viên \/ giảng viên theo phạm vi/);
 assert.doesNotMatch(ws,/Quản lý tài khoản · phê duyệt hai vòng/);
 assert.match(gate,/ManagerWorkspace/);
 assert.match(gate,/managerDashboard/);
});
test("premium review queue is read-only, without renaming Owner approvals",()=>{
 const ws=read("manager-workspace.tsx"),details=read("manager-details.tsx");
 assert.match(ws,/setFilter\("review"\)/);
 assert.match(ws,/filter==="review"/);
 assert.match(ws,/readOnly=\{tab==="people"&&filter==="review"\}/);
 assert.match(details,/readOnly=false/);
 for(const action of ["onEditResource(resource)","onAssignPerson(person)","onEditSession(s)"])
  assert.ok(details.includes("!readOnly?"),"details must have read-only write-action gating");
});
test("original premium palette/nav restored but local server/auth/security unchanged",()=>{
 const css=read("manager-workspace.module.css");
 assert.match(css,/\/\* Premium Bơi Ếch AI management surface/);
 assert.match(css,/\.desktopRail\{display:none\}/);
 assert.match(css,/@media\(min-width:1101px\)/);
 assert.match(css,/#09132d/);
 const ws=read("manager-workspace.tsx");
 assert.match(ws,/createTrainingClient/);
 assert.match(ws,/ManagerApprovalPanel/);
 assert.match(ws,/accountControls\?:ReactNode/);
});
