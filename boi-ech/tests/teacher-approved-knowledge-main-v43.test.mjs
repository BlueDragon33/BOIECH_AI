import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const base=path.join(fileURLToPath(new URL("../",import.meta.url)),"app");
const route=fs.readFileSync(path.join(base,"api/teacher/approved-knowledge/route.ts"),"utf8");
const server=fs.readFileSync(path.join(base,"teacher-approved-knowledge.server.ts"),"utf8");
const shell=fs.readFileSync(path.join(base,"teacher-role-shell.tsx"),"utf8");
const panel=fs.readFileSync(path.join(base,"teacher-approved-knowledge-panel-v43.tsx"),"utf8");

test("V43 secure knowledge endpoint validates signed teacher and actual assigned class before D1",()=>{
 assert.match(route,/verifyDeviceRequest\(payload,preview\)/);
 assert.match(route,/teacher\.personRole!=="teacher"/);
 assert.match(route,/TEACHER_ROLE_REQUIRED/);
 assert.match(route,/TEACHER_CLASS_REQUIRED/);
 assert.match(route,/approvedHosts\.has\(url\.hostname\)/);
 assert.ok(route.indexOf('verifyDeviceRequest(payload,preview)')<route.indexOf('getCourseDatabase()'));
 assert.ok(route.indexOf('teacher.className?.trim()')<route.indexOf('getCourseDatabase()'));
 assert.match(route,/no-store, private/);
 assert.doesNotMatch(route,/(?:method\s*:\s*["'](?:PUT|DELETE)["']|\.run\(|\.batch\(|\.bind\(.*INSERT)/);
});
test("V43 D1 knowledge service only trusts reviewed and published content",()=>{
 assert.match(server,/FROM course_content_versions/);
 assert.match(server,/status='published' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL/);
 assert.match(server,/parseCourseDocument\(row\.payload_json\)/);
 assert.match(server,/return none\("Không có giáo trình đã được người có thẩm quyền duyệt và xuất bản/);
 assert.match(server,/sourceUri,title:item\.title,text:item\.text,active:true/);
 assert.doesNotMatch(server,/\bfetch\s*\(|\.run\s*\(|\.batch\s*\(|INSERT\s+INTO|UPDATE\s+course_content/);
});
test("V43 manual teacher UI sends bounded search only after signed device proof, no auto-exercise",()=>{
 assert.match(shell,/TeacherApprovedKnowledgePanelV43 onSearch=\{searchApprovedKnowledge\}/);
 assert.match(shell,/const proof=await signedTeacherProof\(credential,deviceId\)/);
 assert.match(shell,/fetch\("\/api\/teacher\/approved-knowledge"/);
 assert.match(shell,/JSON\.stringify\(\{\.\.\.proof,lessonNumber,query\}\)/);
 assert.match(panel,/data-v43-approved-knowledge/);
 assert.match(panel,/role="alert"/);
 assert.match(panel,/Giảng viên kiểm tra bản gốc/);
 assert.match(panel,/maxLength=\{160\}/);
 assert.doesNotMatch(panel,/openai|anthropic|gemini|localStorage|sessionStorage|fetch\(/i);
});
test("V43 remains ZERO-SPEND and DOES NOT provide fabricated approved content when D1 has none",()=>{
 assert.match(route,/loadPublishedSwimKnowledge\(db,lessonNumber,url\.origin,now\)/);
 assert.match(route,/retrieveApprovedKnowledge\(\{/);
 assert.match(route,/role:"teacher",curriculumCode:"BREASTSTROKE-8"/);
 assert.match(route,/personalDataReturned:false,mediaStored:false/);
 assert.doesNotMatch(route,/OPENAI|ANTHROPIC|GEMINI|fetch\s*\(|wrangler d1 migrations/);
});
