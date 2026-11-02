import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(p,"utf8");
const sql=read("boi-ech/drizzle/0017_manager_approval_quota.sql");
const service=read("boi-ech/app/manager-device-review.server.ts");
const grant=read("boi-ech/app/api/control/management-access/route.ts");
const panel=read("boi-ech/app/manager-approval-panel.tsx");
const workspace=read("boi-ech/app/manager-workspace.tsx");
const api=read("boi-ech/app/api/manager/device-approvals/route.ts");
test("manager-tier uses ONE shared 50 learner / 5 teacher quota, not per-manager limits",()=>{
 assert.match(sql,/scope TEXT PRIMARY KEY NOT NULL CHECK\(scope='manager-tier'\)/);
 assert.match(sql,/VALUES\('manager-tier',50,5,'system:default'\)/);
 assert.match(sql,/FROM manager_device_assignments a\s+JOIN device_access d/);
 assert.match(sql,/WHERE scope='manager-tier'/);
 assert.doesNotMatch(sql,/manager_device_id TEXT PRIMARY KEY NOT NULL REFERENCES device_access\(device_id\) ON DELETE CASCADE,\s+learner_limit/);
 assert.match(service,/WHERE scope='manager-tier'/);
 assert.match(service,/Shared quotas across ALL managers/);
});
test("only owner may grant manager authority or edit shared tier limits",()=>{
 assert.match(grant,/role !== "owner"/);
 assert.match(grant,/set-tier-limits/);
 assert.match(grant,/get-tier-limits/);
 assert.match(grant,/management_enabled/);
 assert.match(grant,/MANAGEMENT_GRANT_CONFLICT/);
 assert.match(grant,/MANAGEMENT_GRANT_READBACK_FAILED/);
});
test("manager can approve only verified, eligible learner and teacher devices",()=>{
 assert.match(api,/verifyDeviceRequest\(payload,false\)/);
 assert.match(service,/requireManager\(actor\)/);
 assert.match(sql,/AND m\.person_role='manager' AND m\.management_enabled=1 AND m\.status='approved'/);
 assert.match(sql,/d\.person_role IN \('learner','teacher'\)/);
 assert.match(sql,/MANAGER_APPROVAL_QUOTA_REACHED/);
 assert.match(service,/MANAGER_REVIEW_READBACK_MISMATCH/);
});
test("preview reads only literal fixture; its buttons cannot call mutation API",()=>{
 assert.match(panel,/const PREVIEW_BOARD:Board/);
 assert.match(panel,/if\(previewOnly \|\| !getProof\)throw/);
 assert.match(panel,/if\(previewOnly\)\{setNotice\(/);
 assert.match(panel,/disabled=\{busy\|\|previewOnly/);
 assert.match(workspace,/data-manager-preview="read-only"/);
 assert.match(workspace,/<ManagerApprovalPanel previewOnly\/>/);
 assert.match(workspace,/Xem thử không cần cấp quyền/);
});
test("blanket auto-approval is disabled for migration into manager-tier review",()=>{
 assert.match(sql,/UPDATE access_automation_settings SET auto_confirm_new_devices=0/);
 const control=read("boi-ech/app/api/control/overview/route.ts");
 assert.match(control,/MANAGER_REVIEW_POLICY_ACTIVE/);
 const auth=read("boi-ech/app/device-auth.server.ts");
 assert.match(auth,/enabled: row\?\.auto_confirm_new_devices === 1/);
});
