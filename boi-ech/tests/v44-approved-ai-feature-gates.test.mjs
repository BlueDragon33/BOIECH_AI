import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {DatabaseSync} from "node:sqlite";
import ts from "typescript";

const code=(path)=>readFileSync(resolve(path),"utf8");
function moduleOf(path,dependencies={}){
 const output=ts.transpileModule(code(path),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText;
 const holder={exports:{}};
 new Function("require","module","exports",output)(
  key=>{if(key in dependencies)return dependencies[key];throw new Error("Unexpected import "+key);},
  holder,holder.exports
 );
 return holder.exports;
}
const retrieval=moduleOf("app/teacher-knowledge-retrieval-v43.ts");
const knowledge=moduleOf("app/teacher-approved-knowledge.server.ts",{
 "./course-content.server":{parseCourseDocument:v=>JSON.parse(v)}
});
const llm=moduleOf("app/teacher-llm-budget-v44.server.ts");

test("V44: two mandatory remote-provider gates, server-only key, token quota and no background request",()=>{
 const s=code("app/teacher-llm-budget-v44.server.ts");
 assert.match(s,/BOI_ECH_AI_LLM_ENABLED!=="enabled"/);
 assert.match(s,/BOI_ECH_AI_LLM_REMOTE_TRANSFER!=="approved"/);
 assert.match(s,/BOI_ECH_AI_LLM_PROVIDER!=="openai"/);
 assert.match(s,/typeof c.BOI_ECH_AI_LLM_API_KEY!=="string"/);
 assert.match(s,/dailyLimit:requested/);
 assert.match(s,/store:false/);
 assert.match(s,/https:\/\/api\.openai\.com\/v1\/responses/);
 assert.match(s,/reserveDailyInference\(db,/);
 assert.match(s,/if\(!await reserveDailyInference/);
 assert.doesNotMatch(s,/onMount|useEffect|setInterval|setTimeout\(/);
});

test("V44: D1 atomic daily reserve denies concurrent over-budget inference",async t=>{
 const sqlite=new DatabaseSync(":memory:");t.after(()=>sqlite.close());
 sqlite.exec(`CREATE TABLE training_ai_llm_daily_quota(
  utc_day TEXT PRIMARY KEY,reserved_tokens INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
 `);
 const db={prepare(sql){return {bind(...args){return {
  async run(){return {meta:{changes:sqlite.prepare(sql).run(...args).changes}};}
 };}};}};
 assert.equal(await llm.reserveDailyInference(db,"2026-11-17",4096),true);
 assert.equal(await llm.reserveDailyInference(db,"2026-11-17",4096),true);
 assert.equal(await llm.reserveDailyInference(db,"2026-11-17",4096),false);
 const row=sqlite.prepare("SELECT * FROM training_ai_llm_daily_quota").get();
 assert.equal(row.reserved_tokens,4096);
 assert.equal(row.request_count,2);
 assert.equal(await llm.reserveDailyInference(db,"2026-11-17",0),false);
 assert.equal(await llm.reserveDailyInference(db,"bad-day",4096),false);
});

test("V44: privacy gate denies identifiers, secret-like and oversized personal questions",()=>{
 assert.equal(llm.sanitizeCoachingQuestion("Làm sao phối hợp chân tay khi bơi ếch?"),"Làm sao phối hợp chân tay khi bơi ếch?");
 for(const value of [
  "Nhận xét em A email abc@school.com",
  "Hãy nhớ hộ chiếu của tôi",
  "Số điện thoại 09012345678 trong video",
  "Bí mật token xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "a".repeat(321)
 ])assert.equal(llm.sanitizeCoachingQuestion(value),null);
});

test("V44: model output requires only real [KBn] citations and remains a draft",()=>{
 const hits=[{id:"source1",revision:1,title:"Tay",excerpt:"...",citationLabel:"v1",sourceUri:"https://example.org/",
  approvedBy:"mgr",approvedAt:"2026-11-01"}];
 assert.equal(llm.validatedCitedDraft({output_text:"Phối hợp theo bài [KB1]."},hits),"Phối hợp theo bài [KB1].");
 assert.equal(llm.validatedCitedDraft({output_text:"Một quy tắc hoàn toàn mới."},hits),null);
 assert.equal(llm.validatedCitedDraft({output_text:"Thử bài [KB2]."},hits),null);
 assert.equal(llm.validatedCitedDraft({output_text:"Đến https://unverified.test [KB1]"},hits),null);
 assert.equal(llm.validatedCitedDraft({output:[{type:"message",content:[{type:"output_text",text:"Luyện theo bước [KB1]."}]}]},hits),"Luyện theo bước [KB1].");
});

function fakePublished(t,override={}){
 const sqlite=new DatabaseSync(":memory:");t.after(()=>sqlite.close());
 sqlite.exec(`CREATE TABLE course_content_versions(
  id TEXT,version_number INTEGER,status TEXT,payload_json TEXT,
  reviewed_by TEXT,reviewed_at TEXT,published_at TEXT);
 `);
 const document={lessonOutlines:{"03":{core:[{title:"Phối hợp chân tay",body:"Chân co và khép sau pha đạp để chuẩn bị lướt."}],
  practice:["Luyện phối hợp động tác với nhịp thở."],objectives:["Giữ thân cân bằng."]}},
  movement:{mistakes:[{name:"Tay chân lệch nhịp",sign:"Mất phối hợp",cause:"Thiếu nhịp",
   fix:"Thực hành theo nhịp",drill:"Luyện chậm theo nhịp"}],
   phases:[],practice:[]},foundationDetails:{}};
 const row={id:"CUR-9",version_number:9,status:"published",payload_json:JSON.stringify(document),
  reviewed_by:"manager-id",reviewed_at:"2026-11-01T00:00:00Z",published_at:"2026-11-02T00:00:00Z",...override};
 sqlite.prepare("INSERT INTO course_content_versions VALUES(?,?,?,?,?,?,?)").run(
  row.id,row.version_number,row.status,row.payload_json,row.reviewed_by,row.reviewed_at,row.published_at
 );
 const db={prepare(sql){return {first:async()=>sqlite.prepare(sql).get()??null};}};
 return db;
}
test("V44: published, actually human-reviewed D1 curriculum is source-cited and scoped",async t=>{
 const db=fakePublished(t);
 const corpus=await knowledge.loadPublishedSwimKnowledge(db,"03","https://example.org","2026-11-17T12:00:00Z");
 assert.equal(corpus.version.id,"CUR-9");
 assert.ok(corpus.entries.length>0);
 assert.ok(corpus.entries.every(x=>x.approvedBy==="manager-id"&&x.revision===9));
 const r=retrieval.retrieveApprovedKnowledge({documents:corpus.entries,role:"teacher",
  curriculumCode:"BREASTSTROKE-8",lessonNumber:"03",query:"Làm sao sửa phối hợp chân tay?",
  now:"2026-11-17T12:00:00Z"});
 assert.equal(r.mode,"approved-retrieval-only");
 assert.ok(r.hits.length>0);
 assert.ok(r.hits.every(x=>x.citationLabel.includes("phiên bản 9")));
 const denied=retrieval.retrieveApprovedKnowledge({documents:corpus.entries,role:"learner",
  curriculumCode:"BREASTSTROKE-8",lessonNumber:"03",query:"Phối hợp chân tay",
  now:"2026-11-17T12:00:00Z"});
 assert.equal(denied.mode,"unavailable");
});
test("V44: unreviewed, unpublished or future-dated course cannot be promoted to knowledge",async t=>{
 const docs=[
  fakePublished(t,{status:"draft"}),
  fakePublished(t,{reviewed_by:null}),
  fakePublished(t,{reviewed_at:"2026-12-01T00:00:00Z"})
 ];
 for(const db of docs){
  const r=await knowledge.loadPublishedSwimKnowledge(db,"03","https://example.org","2026-11-17T12:00:00Z");
  assert.equal(r.entries.length,0);
  assert.equal(r.version,null);
 }
});
test("V44: human-reviewed proposal application checks approved CAS inside canonical D1 batch",()=>{
 const management=code("app/training-management.server.ts"),
  proposals=code("app/api/training-ai-proposals/route.ts"),
  schema=code("drizzle/0046_ai_proposal_applied_receipts.sql");
 assert.match(management,/const aiGuard=aiApproval\?/);
 assert.match(management,/approved\.state='approved'/);
 assert.match(management,/approved\.revision=\?/);
 assert.match(management,/approved\.source_fingerprint=\?/);
 assert.match(management,/NOT EXISTS\([\s\S]*?training_ai_proposal_applications/);
 assert.match(management,/followups\.push\(db\.prepare\(`INSERT INTO training_ai_proposal_applications/);
 assert.match(management,/db\.batch\(\[write,[\s\S]*?\.\.\.followups\]/);
 assert.match(proposals,/action==="apply"/);
 assert.match(proposals,/proposal\.admissible!==true/);
 assert.match(proposals,/await trainingCommand\(actor,/);
 assert.match(proposals,/code:"AI_APPLY_READBACK_UNKNOWN"/);
 assert.match(schema,/command_id TEXT PRIMARY KEY REFERENCES training_commands/);
});
test("V44: teacher and learner have an independent opt-in, withdrawal and manager audit UI",()=>{
 const client=code("app/ai-personal-profile-v44.tsx"),
  manager=code("app/manager-ai-profiles-v44.tsx"),
  profile=code("app/api/training-ai-profiles/route.ts");
 assert.match(client,/action:"own-list"/);
 assert.match(client,/save\("withdraw"\)/);
 assert.match(client,/consent:true,profile/);
 assert.match(client,/signedConversationProof\(derived/);
 assert.match(manager,/action:"manager-list"/);
 assert.match(manager,/submit\("verify"/);
 assert.match(manager,/submit\("attest-class"\)/);
 assert.match(profile,/device_id IN \(SELECT value FROM json_each\(\?\)\)/);
 assert.match(profile,/sourcePossiblyTruncated/);
 assert.match(profile,/if\(!await profileAdmissionEnabled\(\)\)\s*return respond\(\{[^}]*code:"AI_PROFILE_ADMISSION_DISABLED"\},403\)/);
 assert.match(client,/!response\.ok&&data\.code==="AI_PROFILE_ADMISSION_DISABLED"/);
 assert.match(manager,/!response\.ok&&json\.code==="AI_PROFILE_ADMISSION_DISABLED"/);
});
