import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
import ts from "typescript";

const root=path.join(fileURLToPath(new URL("../",import.meta.url)),"app");
const nativeRequire=createRequire(import.meta.url);
function load(name){
 const cache=new Map();
 function read(file){
  if(cache.has(file))return cache.get(file).exports;
  const record={exports:{}};cache.set(file,record);
  const output=ts.transpileModule(fs.readFileSync(file,"utf8"),{
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  new Function("require","module","exports",output)(part=>{
   if(!part.startsWith("."))return nativeRequire(part);
   const base=path.resolve(path.dirname(file),part);
   return read([base,base+".ts",base+".tsx"].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()));
  },record,record.exports);
  return record.exports;
 }
 return read(path.join(root,name));
}
const {buildAllocationReview}=load("manager-ai-allocation-v42.ts");
const {assessManagerAiSnapshot}=load("manager-ai-snapshot-v46.ts");
const at="2030-06-06T10:00:00.000Z",until="2030-06-06T11:00:00.000Z";
function res(id,name,other={}){return {id,name,kind:"class",parentId:null,capacity:20,
 requiredTeachers:1,status:"active",version:1,learnerCount:10,teacherCount:0,remaining:10,
 missingTeachers:1,bookingCount:0,state:"missing",roomCount:0,...other};}
function person(id,role,className,other={}){return {id,name:id,code:"",role,className,status:"approved",
 expired:false,registered:true,bookingCount:0,deviceType:"unknown",devicePlatform:null,deviceLastSeenAt:null,...other};}
function session(id,teacherId="missing",other={}){return {id,title:id,classId:"a",roomId:"r1",teacherId,
 assistantTeacherId:null,periodStart:null,periodEnd:null,startsAt:at,endsAt:until,
 status:"scheduled",version:1,...other};}
function board(){return {resources:[res("a","A"),res("b","B",{teacherCount:1,missingTeachers:0,learnerCount:5,state:"available"})],
 people:[person("t1","teacher",""),person("blocked","teacher","",{status:"blocked"}),
 person("l1","learner","Chưa phân lớp")],sessions:[session("sA")],teacherClassTerms:[],
 leaders:[],leaderHistory:[],periods:[],observedAt:"2030-06-06T11:30:00.000Z",
 from:"2030-06-06T00:00:00.000Z",to:"2030-06-07T00:00:00.000Z",
 summary:{freeRooms:0,occupiedRooms:0,missingLearners:1,missingTeachers:1,
 unassignedLearners:1,unassignedTeachers:1}};}
test("V42 manager shortlists only approved, active, non-expired people; no source mutation",()=>{
 const b=board(),before=JSON.stringify(b),r=buildAllocationReview(b);
 assert.ok(r.teacherShortlist.some(p=>p.personId==="t1"&&p.classId==="a"));
 assert.ok(r.teacherShortlist.every(p=>p.personId!=="blocked"&&p.decision==="human-review-required"));
 assert.ok(r.learnerShortlist.every(p=>p.decision==="human-review-required"));
 assert.ok(r.teacherShortlist.every(p=>p.warnings.some(x=>x.includes("chứng chỉ"))));
 assert.equal(JSON.stringify(b),before);
});
test("V42 does not fabricate teacher availability from an overlapping booked session",()=>{
 const b=board();b.sessions.push(session("busy","t1",{classId:"b"}));
 const r=buildAllocationReview(b);
 assert.equal(r.teacherShortlist.find(p=>p.personId==="t1"),undefined);
});
test("V42 learner shortlist includes only active staffed class with free seats",()=>{
 const b=board(),r=buildAllocationReview(b);
 assert.equal(r.learnerShortlist.length,1);assert.equal(r.learnerShortlist[0].classId,"b");
 b.resources[1].learnerCount=20;
 assert.equal(buildAllocationReview(b).learnerShortlist.length,0);
});
test("V42 capacity forecast caps primary recommendations at simulated free seats, not real reservations",()=>{
 const b=board();b.resources[0].teacherCount=1;b.resources[0].missingTeachers=0;
 b.resources[0].capacity=11;b.resources[0].learnerCount=10;
 b.resources[1].capacity=6;b.resources[1].learnerCount=5;
 for(let i=2;i<=10;i++)b.people.push(person("l"+i,"learner","Chưa phân lớp"));
 const before=JSON.stringify(b),r=buildAllocationReview(b),primary=r.learnerShortlist.filter(x=>x.suggestedRole==="primary");
 assert.equal(primary.length,2);
 assert.equal(new Set(primary.map(x=>x.classId)).size,2);
 assert.ok(r.learnerShortlist.every(x=>x.warnings.some(w=>w.includes("không giữ chỗ"))));
 assert.equal(JSON.stringify(b),before);
});
test("V42 reports no teacher session as unknown availability rather than safe",()=>{
 const b=board();b.sessions=[];
 const r=buildAllocationReview(b);
 assert.ok(r.teacherShortlist.every(x=>x.evidenceStatus==="no-class-sessions"&&x.priority==="medium"));
});
test("V42 source cap catches malformed times, roster and session pagination",()=>{
 const b=board();
 b.sessions.push(session("invalid","t1",{startsAt:"not-a-date"}));
 assert.equal(buildAllocationReview(b).sourceMayBeTruncated,true);
 b.sessions=[];b.people=Array.from({length:1000},(_,i)=>person("p"+i,"learner",""));
 assert.equal(buildAllocationReview(b).sourceMayBeTruncated,true);
});
test("V46 gate refuses stale, future, partial, bad timestamp; allows fresh board review only",()=>{
 const now=Date.parse("2030-06-06T11:31:00.000Z");
 const accepted=assessManagerAiSnapshot({observedAt:"2030-06-06T11:30:00.000Z",sourceMayBeTruncated:false},now);
 assert.equal(accepted.canDecide,true);assert.equal(accepted.status,"fresh");
 assert.equal(assessManagerAiSnapshot({observedAt:"2030-06-06T11:30:00.000Z",sourceMayBeTruncated:true},now).status,"partial");
 assert.equal(assessManagerAiSnapshot({observedAt:"2030-06-06T11:00:00.000Z",sourceMayBeTruncated:false},now).status,"stale");
 assert.equal(assessManagerAiSnapshot({observedAt:"2030-06-06T11:35:00.000Z",sourceMayBeTruncated:false},now).status,"future");
 assert.equal(assessManagerAiSnapshot({observedAt:"2030-06-06",sourceMayBeTruncated:false},now).status,"invalid");
});
test("V42 UI gates confirmation at time of click and routes only through current human form",()=>{
 const panel=fs.readFileSync(path.join(root,"manager-ai-allocation-panel-v42.tsx"),"utf8");
 const manager=fs.readFileSync(path.join(root,"manager-ai-workspace-v41.tsx"),"utf8");
 const rootUi=fs.readFileSync(path.join(root,"manager-workspace.tsx"),"utf8");
 assert.match(panel,/const reviewProposal=/);
 assert.match(panel,/assessManagerAiSnapshot\(\{/);
 assert.match(panel,/Date\.now\(\)/);
 assert.match(panel,/if\(!gate\.canDecide\)/);
 assert.match(panel,/onReviewProposal\(personId,classId\)/);
 assert.match(panel,/role="alert"/);
 assert.match(manager,/<ManagerAiAllocationPanelV42 board=\{board\}/);
 assert.match(rootUi,/onReviewAllocation=\{reviewAllocation\}/);
 assert.match(rootUi,/function reviewAllocation\(/);
 assert.match(rootUi,/if\(!review\.canDecide\)/);
 assert.match(rootUi,/assignPerson\(person,classId\)/);
 assert.match(rootUi,/if\(p\.role==="teacher"&&ids\.length>12\)/);
 assert.doesNotMatch(panel,/\bfetch\(|\.prepare\(|process\.env|localStorage|sessionStorage/);
});
