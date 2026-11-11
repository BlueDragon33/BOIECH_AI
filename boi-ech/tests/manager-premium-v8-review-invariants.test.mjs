import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../app/"+p,import.meta.url),"utf8");

test("V8 Premium manager is original UI, never a separate shadow dashboard",()=>{
 const ws=read("manager-workspace.tsx"),center=read("manager-command-center.tsx"),css=read("manager-command-center.module.css");
 assert.match(ws,/<ManagerCommandCenter board=\{board\}/);
 assert.match(center,/Trung tâm điều hành/);
 assert.match(center,/Hệ thống cơ sở \/ tòa học/);
 assert.match(css,/\.metricTile/);
 assert.match(css,/\.campus/);
 assert.doesNotMatch(center,/fetch\(/);
});
test("V8 review panel gates writes on verified BOI single-review runtime",()=>{
 const wrapper=read("manager-approval-panel.tsx");
 assert.match(wrapper,/accountSingleReview\?:boolean/);
 assert.match(wrapper,/data\.accountSingleReview===true\?"v2":"blocked"/);
 assert.match(wrapper,/<ManagerV2ReviewPanel singleReview=\{true\}\/>/);
 assert.match(wrapper,/mode==="blocked"/);
 const panel=read("manager-v2-review-panel.tsx");
 assert.match(panel,/if\(!singleReview\|\|locked\.current/);
 assert.match(panel,/person\.onboardingStage!=="requested"/);
 assert.match(panel,/action:"review-first"/);
 assert.doesNotMatch(panel,/action:"review-changes"|action:"review-final"|action:"review",accountId/);
 assert.match(panel,/readback\(person\.accountId\)/);
 assert.match(panel,/found\.onboardingStage!=="profile_required"/);
 assert.match(panel,/found\.firstReviewMine!==true/);
 assert.match(panel,/setBoard\(null\)/);
 assert.match(panel,/Không coi lỗi kết nối là 0 hồ sơ/);
});
test("V8 reviewer and training manager authorize same trusted principal inside D1 CAS",()=>{
 const workflow=read("account-v2-workflow.server.ts"),train=read("training-management.server.ts");
 assert.match(workflow,/JOIN account_sessions s ON s.account_id=a.account_id/);
 assert.match(workflow,/s\.token_hash=\?/);
 assert.match(workflow,/s\.revoked=0 AND b.revoked=0 AND b.approved=1/);
 assert.match(workflow,/c\.generation=s\.generation/);
 assert.match(train,/principal\.accountId!==actor\.accountId/);
 assert.match(train,/managerStorageDeviceId=canonical\.storage_device_id/);
 assert.match(train,/visibleSessions=sessions\.filter/);
 assert.match(train,/unassignedLearners:visiblePeople\.filter/);
 const core=read("account-core.server.ts");
 assert.match(core,/const quotaSQL = this\.v2Enabled/);
 assert.match(core,/JOIN account_entitlements e ON e\.account_id=a\.account_id/);
});
test("V8 profile completion does not silently ignore duplicate entitlement or manager grant",()=>{
 const entitlement=read("account-entitlement.server.ts"),workflow=read("account-v2-workflow.server.ts");
 assert.match(entitlement,/legacyDedup=source==="approval:second"/);
 assert.match(entitlement,/\$\{legacyDedup\}/);
 assert.doesNotMatch(workflow,/ON CONFLICT\(account_id,scope\) DO NOTHING/);
 assert.match(workflow,/account\.profile\.activated/);
});
test("V8 review stylesheet uses premium palette and responsive accessibility",()=>{
 const css=read("manager-v2-review-panel.module.css");
 for(const value of ["#0c1939","#162651","#231b56","@media(max-width:750px)","focus-visible"])
  assert.ok(css.includes(value),value);
});
