import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import ts from "typescript";

const nativeRequire=createRequire(import.meta.url);
const root=path.resolve(new URL("../app/",import.meta.url).pathname);
function load(entry){
 const cache=new Map();
 function read(file){
  if(cache.has(file))return cache.get(file).exports;
  const record={exports:{}};cache.set(file,record);
  const source=fs.readFileSync(file,"utf8");
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function("require","module","exports",output)(name=>{
   if(!name.startsWith("."))return nativeRequire(name);
   const base=path.resolve(path.dirname(file),name);
   return read([base,base+".ts",base+".tsx"].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()));
  },record,record.exports);
  return record.exports;
 }
 return read(path.join(root,entry));
}
const {
 scanAllManagerConflicts,reviewTeacherCandidates,summarizeManagerTrainingQuality,
 evaluateScheduleOption,compareRoomOptions,auditManagerEvidence,MANAGER_AI_FUTURE_CAPABILITIES,
}=load("manager-ai-followon-v41.ts");
const {analyzeManagerBoard}=load("manager-ai-evidence-v41.ts");
const resource=(id,kind,name,more={})=>({id,kind,name,parentId:null,capacity:25,
 requiredTeachers:1,status:"active",version:1,learnerCount:0,teacherCount:0,remaining:0,
 missingTeachers:0,bookingCount:0,state:"available",roomCount:0,...more});
const person=(id,role,className,more={})=>({id,name:id,role,className,code:"",registered:true,
 status:"approved",expired:false,deviceType:"unknown",devicePlatform:null,
 deviceLastSeenAt:null,bookingCount:0,...more});
const session=(id,roomId,teacherId,start,end,more={})=>({
 id,title:id,roomId,teacherId,classId:"clA",assistantTeacherId:null,periodStart:null,periodEnd:null,
 startsAt:start,endsAt:end,status:"scheduled",version:1,...more
});
const starts="2030-06-06T10:00:00.000Z",ends="2030-06-06T11:00:00.000Z";
function board(){
 return {resources:[
  resource("clA","class","A",{learnerCount:24,capacity:25,teacherCount:1}),
  resource("clB","class","B",{learnerCount:8,teacherCount:1}),
  resource("r1","room","Bể A",{capacity:25}),
  resource("r2","room","Bể B",{capacity:15})
 ],people:[person("teacher1","teacher","A"),person("teacher2","teacher","B"),
   person("learner1","learner","A"),person("learner2","learner","Chưa phân lớp"),
   person("learner3","learner","Không tồn tại")],
 sessions:[session("s1","r1","teacher1",starts,ends),
   session("s2","r1","teacher2","2030-06-06T10:10:00.000Z","2030-06-06T10:50:00.000Z",{classId:"clB"}),
   session("s3","r2","teacher1","2030-06-06T10:20:00.000Z","2030-06-06T11:20:00.000Z",{classId:"clB"})],
 teacherClassTerms:[],leaderHistory:[],leaders:[],periods:[],summary:{
  freeRooms:0,occupiedRooms:2,missingLearners:0,missingTeachers:0,
  unassignedLearners:2,unassignedTeachers:0},
 observedAt:"2030-06-06T11:30:00.000Z",
 from:"2030-06-06T00:00:00.000Z",to:"2030-06-07T00:00:00.000Z"};
}
test("V41 P1 enumerates all overlapping pairs, including assistant/teacher crossings",()=>{
 const b=board();
 // All 3 overlap in time; s1-s2 share room, s1-s3 share teacher, s2-s3 share class B.
 const scan=scanAllManagerConflicts(b,1);
 assert.equal(scan.totalPairs,3);
 assert.equal(scan.shownPairs.length,1);
 assert.equal(scan.pairDisplayTruncated,true);
 assert.equal(scan.scannedSessions,3);
 assert.equal(scan.sourcePotentiallyTruncated,false);
 assert.match(scan.coverageNote,/khoảng dữ liệu/);
 // Third party's assistant is also busy as a primary teacher elsewhere.
 b.sessions.push(session("assistant-cross","r2","teacher2",starts,ends,{assistantTeacherId:"teacher1",classId:"clA"}));
 assert.ok(scanAllManagerConflicts(b).shownPairs.some(x=>x.reasons.includes("teacher")));
});
test("P1 candidate ranking is bounded to registered valid teachers and does not infer qualifications",()=>{
 const b=board();
 b.people.push(person("suspended","teacher","",{status:"blocked"}));
 b.people.push(person("expired","teacher","",{expired:true}));
 const candidates=reviewTeacherCandidates(b,"clA");
 assert.equal(candidates.length,2);
 assert.ok(candidates.every(c=>c.limitations.some(x=>x.includes("chứng chỉ"))));
 assert.ok(!candidates.some(c=>c.teacherId==="suspended"||c.teacherId==="expired"));
 const t2=candidates.find(c=>c.teacherId==="teacher2");
 assert.ok(t2.overlappingExistingSessions>=1);
 assert.equal(reviewTeacherCandidates(b,"unknown").length,0);
 const before=JSON.stringify(b);
 reviewTeacherCandidates(b,"clA");
 assert.equal(JSON.stringify(b),before,"candidates must never rewrite roster");
});
test("V41.1 training quality uses only roster/session aggregates and explicitly denies personal-video conclusions",()=>{
 const q=summarizeManagerTrainingQuality(board());
 assert.equal(q.learnerAccounts.total,3);
 assert.equal(q.learnerAccounts.withoutActiveClass,2);
 assert.equal(q.sessions.scheduled,3);
 assert.equal(q.sessions.completed,0);
 assert.equal(q.unavailableDatasets.length,5);
 assert.ok(q.unavailableDatasets.includes("messages")&&q.unavailableDatasets.includes("videoProvenance"));
 assert.match(q.explanation,/Chưa có quyền/);
});
test("V41.2 scenario detects room/class/teacher conflicts without creating schedules",()=>{
 const b=board(),before=JSON.stringify(b);
 const existing=evaluateScheduleOption(b,"s1","r1",starts);
 assert.equal(existing.state,"conflict");
 assert.ok(existing.overlappingSessions.includes("s2"));
 const other=evaluateScheduleOption(b,"s1","r2","2030-06-06T13:00:00.000Z");
 assert.equal(other.state,"review-required","room too small requires independent attendance review");
 assert.equal(other.overlappingSessions.length,0);
 const outside=evaluateScheduleOption(b,"s1","r1","2030-06-08T10:00:00.000Z");
 assert.equal(outside.state,"invalid");
 assert.match(outside.reason,/ngoài khoảng dữ liệu/);
 const missing=evaluateScheduleOption(b,"s1","missing",starts);
 assert.equal(missing.state,"invalid");
 const cancelled=board();cancelled.sessions[0].status="cancelled";
 assert.equal(evaluateScheduleOption(cancelled,"s1","r1",starts).state,"invalid");
 assert.equal(JSON.stringify(b),before,"what-if cannot mutate source board");
});
test("V41.2 alternatives compare actual rooms, retain unresolved capacity and cannot claim approval",()=>{
 const b=board();
 const options=compareRoomOptions(b,"s1","2030-06-06T13:00:00.000Z",8);
 assert.equal(options.length,2);
 assert.equal(options[0].state,"no-conflict-in-loaded-window");
 assert.equal(options[1].state,"review-required");
 assert.ok(options.every(x=>x.warnings.length>0));
 assert.equal(compareRoomOptions(b,"s1","2030-06-09T13:00:00.000Z").every(x=>x.state==="invalid"),true);
});
test("V41.3 evidence audit verifies source identities and timestamps without claiming AI accuracy",()=>{
 const b=board();
 const report=analyzeManagerBoard(b);
 const actual=auditManagerEvidence(b,report);
 assert.equal(actual.notAnAccuracyScore,true);
 assert.equal(actual.resolvableReferencePercent,100);
 const altered={...report,findings:[...report.findings,{...report.findings[0],
  id:"injected",evidence:[{source:"resources",recordId:"ghost",fields:"capacity",observedAt:b.observedAt}]}]};
 const stale=auditManagerEvidence(b,altered);
 assert.ok(stale.missingEvidenceIds.some(id=>id.includes("ghost")));
 const duplicated={...report,findings:[...report.findings,report.findings[0]]};
 assert.ok(auditManagerEvidence(b,duplicated).duplicateFindingIds.length===1);
 assert.equal(auditManagerEvidence(b,{...report,findings:[]}).referenceCoveragePercent,null);
});
test("No generative model, unauthorized message/video pipeline or automatic administrative operation",()=>{
 const engine=fs.readFileSync(path.join(root,"manager-ai-followon-v41.ts"),"utf8");
 const view=fs.readFileSync(path.join(root,"manager-ai-followon-panel-v41.tsx"),"utf8");
 const main=fs.readFileSync(path.join(root,"manager-ai-workspace-v41.tsx"),"utf8");
 assert.doesNotMatch(engine,/\bfetch\(|new WebSocket|process\.env|Math\.random|db\.prepare|onCommand|MODEL_API_KEY/);
 assert.doesNotMatch(view,/\bfetch\(|onCommand|\/api\/|sendMessage|updateClass|commitProposal/);
 assert.match(main,/<ManagerAiFollowonV41 board=\{board\} report=\{report\}/);
 assert.match(view,/chưa được cấp nguồn để đọc kết quả video/);
 assert.match(view,/không phải điểm chính xác AI/);
 assert.match(view,/không sửa lịch và không phê duyệt/);
 assert.ok(MANAGER_AI_FUTURE_CAPABILITIES.some(c=>c.name.includes("AI tạo sinh")&&c.status==="approval-required"));
});
