import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const route=fs.readFileSync(new URL("../app/api/teacher/roster/route.ts",import.meta.url),"utf8");
test("V9 teacher mutations cannot be replayed: no mutation branch exists",()=>{
 assert.match(route,/if\(payload\.action!=="list"\)/);
 assert.match(route,/ACCOUNT_REVIEW_MANAGER_REQUIRED/);
 assert.doesNotMatch(route,/UPDATE device_access|DELETE FROM device_access|INSERT INTO course_audit_log/);
});
test("V9 teacher roster has no legacy idempotency or arbitrary state-write path",()=>{
 assert.doesNotMatch(route,/alreadyInRequestedState|teacher_roster_approved|teacher_roster_removed/);
 assert.match(route,/status='approved'/);
 assert.match(route,/verifyDeviceRequest\(payload,false\)/);
});
