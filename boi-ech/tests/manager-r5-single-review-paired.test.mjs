import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=p=>readFileSync(new URL(p,import.meta.url),"utf8");

test("R5: manager review UI reads the server-confirmed single-review gate and passes it to V2 child",()=>{
 const panel=src("../app/manager-approval-panel.tsx");
 const inner=src("../app/manager-v2-review-panel.tsx");
 assert.match(panel,/accountSingleReview\?:boolean/);
 assert.match(panel,/setSingleReview\(data\.accountV2===true&&data\.accountSingleReview===true\)/);
 assert.match(panel,/<ManagerV2ReviewPanel singleReview=\{singleReview\}\/>/);
 assert.match(inner,/if\(singleReview && action!=="review-first"\)return/);
 assert.match(inner,/!singleReview&&person\.onboardingStage==="profile_review"/);
});
test("R5: manager title does not promise a second human approval",()=>{
 const workspace=src("../app/manager-workspace.tsx");
 assert.match(workspace,/Quản lý tài khoản · xét duyệt theo chính sách hiện hành/);
 assert.doesNotMatch(workspace,/Quản lý tài khoản · phê duyệt hai vòng/);
});
test("R5: paired preview workflow pins exactly approved APP #387 and never implicitly installs bridge on read-only tests",()=>{
 const wf=src("../../.github/workflows/deploy-boi-ech-preview.yml");
 const contract=src("./preview-paired-v2-candidate.test.mjs");
 const app="e72df1176c44afd4342c02c6bb5ace5d5af70bc6";
 assert.ok(wf.includes(app));
 assert.ok(contract.includes(app));
 assert.doesNotMatch(wf,/80c400f6d4805b25fe21d2334afcbeaf3313f1b5/);
 assert.match(wf,/INSTALL_PREVIEW_BRIDGE/);
});
