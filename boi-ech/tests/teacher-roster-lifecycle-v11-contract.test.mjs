import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../app/teacher-roster-manager.tsx",import.meta.url),"utf8");
test("V9 roster guards the teacher role before any signed fetch",()=>{
 assert.match(source,/document\.body\.dataset\.teacherRoleUi!=="active"/);
 assert.match(source,/readApprovedRoster\(id\)/);
 assert.match(source,/if\(data\.canManage!==false\)/);
});
test("V9 role change purges data and stale requests",()=>{
 assert.match(source,/generation\.current\+\+;device\.current="";busy\.current=false/);
 assert.match(source,/setData\(EMPTY\)/);
 assert.match(source,/epoch!==generation\.current/);
});
test("V9 device switch clears previous account records before fetching new roster",()=>{
 assert.match(source,/liveDevice!==device\.current/);
 assert.match(source,/generation\.current\+\+;device\.current="";busy\.current=false/);
});
test("V9 request and status are scoped to assigned approved teacher learners",()=>{
 assert.match(source,/body:JSON\.stringify\(\{action:"list",deviceId,challenge:challenge\.challenge,signature\}\)/);
 assert.match(source,/data\.roster\.some\(person=>person\.status!=="approved"\)/);
});
test("V9 background update retains one 60-second timer",()=>{
 assert.match(source,/window\.setInterval\(\(\)=>\{if\(document\.body\.dataset\.teacherRoleUi==="active"\)void sync\(\);\},60000\)/);
 assert.match(source,/window\.addEventListener\("focus",onVisible\)/);
});
test("V9 teacher roster has no old mutate UI or pending approval count",()=>{
 assert.doesNotMatch(source,/const mutate = async|requestRoster\(deviceId, action/);
 assert.doesNotMatch(source,/canManage=\{data\.canManage !== false\}/);
 assert.doesNotMatch(source,/Phê duyệt<\/button>|Loại khỏi lớp<\/button>/);
});
