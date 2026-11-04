import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("drizzle/0017_manager_approval_quota.sql");
const service=read("app/manager-device-review.server.ts");
const grant=read("app/api/control/management-access/route.ts");
const panel=read("app/manager-approval-panel.tsx");
const workspace=read("app/manager-workspace.tsx");
const api=read("app/api/manager/device-approvals/route.ts");
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
 assert.match(grant,/role\s*!==\s*"owner"/);
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
 const control=read("app/api/control/overview/route.ts");
 assert.match(control,/MANAGER_REVIEW_POLICY_ACTIVE/);
 const auth=read("app/device-auth.server.ts");
 assert.match(auth,/enabled: row\?\.auto_confirm_new_devices === 1/);
});

test("legacy admin endpoints cannot bypass manager-only approval",()=>{
 const admin=read("app/api/admin/devices/route.ts");
 const overview=read("app/api/control/overview/route.ts");
 assert.match(admin,/WHERE d\.person_role = 'manager'/);
 assert.match(admin,/if \(exists\.person_role !== "manager"\)/);
 assert.match(overview,/if \(current\.person_role !== "manager"\)/);
});
test("manager write and audit are one D1 batch with separate readback",()=>{
 assert.match(service,/const \[update, auditWrite\]=await db\.batch\(\[/);
 assert.match(service,/const results=await db\.batch\(\[/);
 assert.match(service,/SELECT \?,\?,\?,\? WHERE changes\(\)=1/);
 assert.match(service,/MANAGER_REVIEW_READBACK_MISMATCH/);
 assert.doesNotMatch(service,/await db\.prepare\(`INSERT INTO course_audit_log/);
});

test("Owner-only manager account approval is atomic, pending-only and independently read back",()=>{
 assert.match(grant,/payload\.action==="approve-manager"/);
 assert.match(grant,/payload\.expectedStatus!=="pending"/);
 assert.match(grant,/person_role='manager' AND person_code=\?/);
 assert.match(grant,/payment_status='unassigned'/);
 assert.match(grant,/const \[approved,audited\]=await db\.batch\(\[/);
 assert.match(grant,/training_manager_approved/);
 assert.match(grant,/SELECT \?,'training_manager_approved',\?,\? WHERE changes\(\)=1/);
 assert.match(grant,/MANAGER_APPROVE_READBACK_FAILED/);
});
test("Owner quota changes and manager permissions use D1 compare-and-swap",()=>{
 assert.match(grant,/expectedLearnerLimit/);
 assert.match(grant,/expectedTeacherLimit/);
 assert.match(grant,/MANAGER_TIER_CAS_CONFLICT/);
 assert.match(grant,/expectedManagementEnabled/);
 assert.match(grant,/AND management_enabled=\?/);
 assert.match(grant,/MANAGEMENT_GRANT_CONFLICT/);
 assert.match(grant,/MANAGER_TIER_D1_MISSING/);
});

test("Owner approval renews expired pending manager access before independent readback",()=>{
 assert.match(grant,/payload\.action==="approve-manager"/);
 assert.match(grant,/access_expires_at=CASE\s+WHEN access_expires_at IS NULL OR datetime\(access_expires_at\)<=CURRENT_TIMESTAMP/);
 assert.match(grant,/THEN \? ELSE access_expires_at END/);
 assert.match(grant,/status='pending'/);
 assert.match(grant,/MANAGER_APPROVE_READBACK_FAILED/);
});

test("Owner read independently exposes raw persisted manager grant and effective access",()=>{
 assert.match(grant,/payload\.action==="get-manager-grant"/);
 assert.match(grant,/SELECT management_enabled,status,access_expires_at FROM device_access/);
 assert.match(grant,/managementConfigured:row\.management_enabled===1/);
 assert.match(grant,/managementEnabled:row\.management_enabled===1&&active/);
 assert.match(grant,/MANAGER_GRANT_D1_INVALID/);
});
test("Owner grant\/revoke verifies raw persisted manager grant via a fresh scoped D1 SELECT",()=>{
 assert.match(grant,/const persisted=await db\.prepare\(`SELECT management_enabled FROM device_access/);
 assert.match(grant,/person_role='manager' AND person_code=\? AND registration_submitted_at IS NOT NULL/);
 assert.match(grant,/\.bind\(payload\.deviceId,payload\.expectedPersonCode\)/);
 assert.match(grant,/persisted\.management_enabled===1\)!==payload\.enabled/);
 assert.match(grant,/if\(!persisted\|\|/);
 assert.match(grant,/managementConfigured:persisted\.management_enabled===1/);
 assert.match(grant,/MANAGEMENT_GRANT_READBACK_FAILED/);
});

test("registration timestamp and heartbeat evidence are exposed without inventing online duration",()=>{
 const overview=read("app/api/control/overview/route.ts");
 assert.match(overview,/registrationSubmittedAt: row\.registration_submitted_at/);
 assert.match(overview,/lastPresenceAt,\s*offlineSinceAt,/);
 assert.match(overview,/const lastPresenceAt = row\.last_seen_at/);
 assert.match(overview,/new Date\(lastPresenceTime \+ DEVICE_PRESENCE_TIMEOUT_MS\)\.toISOString\(\)/);
 assert.match(overview,/active \|\| !Number\.isFinite\(lastPresenceTime\)/);
 assert.doesNotMatch(overview,/totalOnlineSessionSeconds:|onlineSinceAt: row\.created_at/);
});
