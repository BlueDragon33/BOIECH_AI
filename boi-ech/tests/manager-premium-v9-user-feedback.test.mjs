import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=file=>readFileSync(new URL("../app/"+file,import.meta.url),"utf8");

test("V9 manager has one dedicated approval module in rail and mobile dock, not every tab",()=>{
 const ws=read("manager-workspace.tsx");
 assert.match(ws,/type Tab="overview"\|"approval"\|/);
 assert.match(ws,/id:"approval",label:"Kiểm duyệt tài khoản"/);
 assert.match(ws,/id:"approval",label:"Kiểm duyệt"/);
 assert.match(ws,/tab==="approval"\?<section className=\{styles\.accountTools\}/);
 assert.doesNotMatch(ws,/tab==="people"&&accountControls/);
 assert.match(ws,/if\(next==="review"\)\{selectTab\("approval"\)/);
});
test("V9 V2 review has independent learner/teacher tabs with verified request counts",()=>{
 const panel=read("manager-v2-review-panel.tsx");
 assert.match(panel,/role="tablist"/);
 assert.match(panel,/roleFilter,setRoleFilter/);
 assert.match(panel,/\["learner","Học viên"\]/);
 assert.match(panel,/\["teacher","Giảng viên"\]/);
 assert.match(panel,/action:"review-first"/);
 assert.match(panel,/readback\(person\.accountId\)/);
 assert.doesNotMatch(panel,/Mã: \{person\.accountId/);
});
test("V9 account settings and P-256 devices appear only inside personal settings for ACTIVE account",()=>{
 const gate=read("account-gate.tsx");
 assert.match(gate,/accountSettings=\{accountPanel\}/);
 assert.match(gate,/\{active\?<details className=\{styles\.profileDevices\}/);
 assert.match(gate,/Trang cá nhân · Cài đặt và bảo mật/);
 assert.doesNotMatch(gate,/Gia hạn phiên/);
 assert.doesNotMatch(gate,/Hàng chờ xét duyệt học viên và giảng viên · Account-first V2/);
});
test("V9 user never enters personal code; stored code is system derived for V1 and V2",()=>{
 const gate=read("account-gate.tsx"),core=read("account-core.server.ts"),workflow=read("account-v2-workflow.server.ts");
 assert.doesNotMatch(gate,/\["personCode","Mã học viên"/);
 assert.doesNotMatch(gate,/\["personCode", "Mã học viên/);
 assert.match(core,/const code=\(role==="manager"\?"MGR_"/);
 assert.match(workflow,/const code=\(manager\?"MGR_"/);
 assert.match(workflow,/account_profile_drafts/);
 assert.match(workflow,/activateProfileDraft\(token:string\)/);
});
test("V9 premium source-backed hierarchy traverses building, room, class, actual people",()=>{
 const map=read("manager-command-center.tsx"),css=read("manager-command-center.module.css");
 assert.match(map,/Lớp học trong \{selectedRoom\.name\}/);
 assert.match(map,/roomClasses\.map\(klass=>/);
 assert.match(map,/selectedMembers\.map\(person=>/);
 assert.match(map,/onOpenDetail\(\{kind:"person",id:person\.id\}\)/);
 assert.match(css,/\.classIconGrid/);
 assert.match(css,/\.personIconGrid/);
 assert.doesNotMatch(map,/value:pending\.length,icon:"people"/);
});
test("V9 Owner list-all is read-only and guarded exclusively by control Owner service",()=>{
 const owner=read("account-core.server.ts"),route=read("api/control/accounts/route.ts");
 assert.match(owner,/async ownerAllAccounts\(after:unknown/);
 assert.match(owner,/contract:"boi-owner-accounts-all\.v1"/);
 assert.match(route,/requireControlService\(request\)/);
 assert.match(route,/owner\.role !== "owner"/);
 assert.match(route,/input\.action === "list-all"/);
});

test("V9 decision text preserves preapproval draft and does not imply second profile entry",()=>{
 const panel=read("manager-v2-review-panel.tsx");
 assert.match(panel,/Nếu hồ sơ đã khai đầy đủ/);
 assert.match(panel,/Chưa cấp quyền truy cập/);
 assert.doesNotMatch(panel,/Người dùng sẽ phải bổ sung hồ sơ trước khi được kích hoạt/);
});

test("V9 pending stepper and profile-required guidance reflect canonical saved draft",()=>{
 const gate=read("account-gate.tsx");
 assert.match(gate,/account\.profileDraftReady\?"Đã lưu hồ sơ":"Khai hồ sơ"/);
 assert.match(gate,/account\.profileDraftReady\?"Đã được duyệt\. Hồ sơ khai trước đã lưu/);
 assert.match(gate,/profile-draft-activate/);
});
