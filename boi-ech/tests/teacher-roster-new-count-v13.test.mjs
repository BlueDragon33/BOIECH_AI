import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const roster=fs.readFileSync(new URL("../app/teacher-roster-manager.tsx",import.meta.url),"utf8");
test("V9 teacher roster no longer counts unapproved or blocked applicants",()=>{
 assert.match(roster,/counts:\{pending:0,approved:0,blocked:0\}/);
 assert.doesNotMatch(roster,/countNewRosterMembers|rosterIdentitySignature|changedCount/);
});
test("V9 compact sync shows validated time rather than unauthorized approval badges",()=>{
 assert.match(roster,/Tự đồng bộ 60 giây · Chỉ đọc/);
 assert.doesNotMatch(roster,/Học viên chờ duyệt|className="approve"/);
 assert.match(roster,/clock\(syncedAt\)/);
});
