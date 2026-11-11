import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../app/"+p,import.meta.url),"utf8");
const route=read("api/teacher/roster/route.ts");
const panel=read("teacher-roster-manager.tsx");
const shell=read("teacher-role-shell.tsx");
const classWorkspace=read("teacher-class-workspace.tsx");
const layout=read("layout.tsx");
const css=read("teacher-roster-sync-v9.css");

test("V9 roster validates P256 proof even in localhost",()=>{
 assert.match(route,/verifyDeviceRequest\(payload,false\)/);
 assert.doesNotMatch(route,/previewRequest|skipSignatureCheck|terminal\.local/);
 assert.match(route,/teacher\.personRole!=="teacher"/);
 assert.match(route,/teacherClassNames\(teacher\.className\)/);
});
test("V9 only manager can alter account status; teacher HTTP endpoint is GET-like read-only POST",()=>{
 assert.match(route,/payload\.action!=="list"/);
 assert.match(route,/ACCOUNT_REVIEW_MANAGER_REQUIRED/);
 assert.match(route,/status='approved'/);
 assert.match(route,/person_role='learner'/);
 assert.doesNotMatch(route,/SET status|UPDATE device_access|DELETE FROM device_access/);
});
test("V9 excludes pending and blocked records from teacher response",()=>{
 assert.match(route,/counts:\{pending:0,approved:roster\.length,blocked:0\}/);
 assert.match(route,/canManage:false/);
 assert.doesNotMatch(route,/phone:row|publicKey:row|displayCode:row/);
});
test("V9 teacher roster mounts as read-only professional overview",()=>{
 assert.match(panel,/DANH SÁCH HỌC VIÊN ĐÃ DUYỆT/);
 assert.match(panel,/readApprovedRoster\(id\)/);
 assert.match(panel,/Tự đồng bộ 60 giây · Chỉ đọc/);
 assert.doesNotMatch(panel,/onAction=\{|const mutate = async|>Loại khỏi lớp<\/button>/);
});
test("V9 retains compact sync, assigned-class panels and scoped data refresh",()=>{
 assert.match(shell,/data-teacher-sync-mount="overview"/);
 assert.match(shell,/data-teacher-sync-mount="learners"/);
 assert.match(classWorkspace,/data-teacher-sync-mount="class"/);
 assert.match(shell,/data-teacher-roster-manager-mount/);
 assert.match(panel,/setMounts/);
 assert.match(panel,/setPanel/);
});
test("V9 roster style remains scoped and teacher final CSS repairs dashboard",()=>{
 assert.match(layout,/teacher-roster-sync-v9\.css/);
 assert.match(layout,/teacher-premium-v9-layout-clean\.css/);
 assert.match(css,/\.teacher-roster-manager/);
 assert.match(css,/@media \(max-width: 640px\)/);
});
