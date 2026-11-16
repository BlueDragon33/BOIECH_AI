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
  const output=ts.transpileModule(fs.readFileSync(file,"utf8"),{
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  new Function("require","module","exports",output)(name=>{
   if(!name.startsWith("."))return nativeRequire(name);
   const base=path.resolve(path.dirname(file),name);
   return read([base,base+".ts",base+".tsx"].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()));
  },record,record.exports);
  return record.exports;
 }
 return read(path.join(root,entry));
}
const {buildAllocationReview}=load("manager-ai-allocation-v42.ts");
const {prioritizeTeacherVideo}=load("teacher-video-priority-v42.ts");
const resource=(id,name,other={})=>({
 id,kind:"class",name,parentId:null,capacity:25,requiredTeachers:1,
 status:"active",version:1,learnerCount:0,teacherCount:0,remaining:25,
 missingTeachers:0,bookingCount:0,state:"available",roomCount:0,...other
});
const person=(id,role,className,other={})=>({
 id,name:id,code:"",role,className,status:"approved",registered:true,expired:false,
 bookingCount:0,deviceType:"unknown",devicePlatform:null,deviceLastSeenAt:null,...other
});
const time="2030-06-06T10:00:00.000Z",end="2030-06-06T11:00:00.000Z";
function board(){
 return {
  resources:[
   resource("a","A",{teacherCount:0,missingTeachers:1,learnerCount:12}),
   resource("b","B",{teacherCount:1,missingTeachers:0,learnerCount:6})
  ],
  people:[person("t1","teacher",""),person("t2","teacher","B"),
   person("t3","teacher","",{status:"blocked"}),
   person("l1","learner","Chưa phân lớp"),person("l2","learner","B")],
  sessions:[{id:"sA",title:"A",classId:"a",roomId:"r1",teacherId:"missing",
   assistantTeacherId:null,periodStart:null,periodEnd:null,startsAt:time,endsAt:end,
   status:"scheduled",version:1}],
  teacherClassTerms:[],leaders:[],leaderHistory:[],periods:[],
  observedAt:"2030-06-06T11:30:00.000Z",
  from:"2030-06-06T00:00:00.000Z",to:"2030-06-07T00:00:00.000Z",
  summary:{freeRooms:0,occupiedRooms:0,missingLearners:0,missingTeachers:1,
   unassignedLearners:1,unassignedTeachers:1}
 };
}
test("V42 ranks account-eligible teachers, never blocked staff, and never mutates board",()=>{
 const b=board(),before=JSON.stringify(b);
 const r=buildAllocationReview(b);
 assert.equal(r.classesNeedingTeachers,1);
 assert.equal(r.unassignedTeachers,1);
 assert.ok(r.teacherShortlist.some(x=>x.personId==="t1"&&x.classId==="a"));
 assert.ok(r.teacherShortlist.every(x=>x.personId!=="t3"&&x.decision==="human-review-required"));
 assert.ok(r.teacherShortlist.every(x=>x.warnings.some(w=>w.includes("chứng chỉ"))));
 assert.equal(JSON.stringify(b),before);
});
test("V42 rejects known colliding teacher schedule and does not invent profile time availability",()=>{
 const b=board();
 b.sessions.push({id:"busy",title:"B",classId:"b",roomId:"r2",teacherId:"t1",
  assistantTeacherId:null,periodStart:null,periodEnd:null,
  startsAt:time,endsAt:end,status:"scheduled",version:1});
 const r=buildAllocationReview(b);
 assert.equal(r.teacherShortlist.find(x=>x.personId==="t1"),undefined);
 assert.equal(r.unassignedLearners,1);
 assert.ok(r.learnerShortlist.every(x=>x.warnings.some(w=>w.includes("giờ mong muốn"))));
});
test("V42 only suggests learners for active classes with remaining seats and configured staff",()=>{
 const b=board();
 const r=buildAllocationReview(b);
 assert.equal(r.learnerShortlist.length,1);
 assert.equal(r.learnerShortlist[0].classId,"b");
 b.resources[1].learnerCount=25;
 assert.equal(buildAllocationReview(b).learnerShortlist.length,0);
});
const analysis={
 score:95,confidence:91,captureQuality:"good",poseCoverage:90,averageVisibility:95,
 sampledFrames:40,detectedFrames:35,durationSec:10,cameraView:"rear",
 categories:{legs:45,arms:90,coordination:70,bodyLine:88},errorCount:1,
 topErrors:["Thu chân chưa gọn"],errors:[{
  title:"Thu chân chưa gọn",severity:"critical",timeSec:3,confidence:91,
  observed:"Gối mở quá rộng",expected:"Thu gối gọn",
  recommendation:"Luyện thu chân gọn rồi đạp khép"
 }],analyzedAt:"2030-06-06T10:00:00Z"
};
const learner={lastAnalysis:analysis,latestTeacherAction:null,adaptive:{priorityLesson:"03"},lastLesson:"02"};
test("V42 high video score does not suppress a source critical error; only draft, never send",()=>{
 const result=prioritizeTeacherVideo(learner);
 assert.equal(result.rank,2);
 assert.equal(result.evidenceStatus,"sufficient");
 assert.equal(result.canDraftExercise,true);
 assert.equal(result.lessonNumber,"03");
 assert.match(result.exerciseNote,/Thu chân chưa gọn/);
 assert.match(result.exerciseNote,/Giảng viên kiểm tra lại/);
});
test("V42 poor capture cannot produce technical corrective assignment",()=>{
 const result=prioritizeTeacherVideo({...learner,lastAnalysis:{...analysis,confidence:40}});
 assert.equal(result.evidenceStatus,"capture-review");
 assert.equal(result.canDraftExercise,false);
 assert.match(result.nextStep,/quay lại/);
});
test("V42 review is linked to the exact analysis and suppresses repeated task draft",()=>{
 const result=prioritizeTeacherVideo({...learner,latestTeacherAction:{
  action:"review",analysisAt:analysis.analyzedAt,note:"Đã đối chiếu",
  reviewStatus:"reviewed",teacherName:"Giảng viên"
 }});
 assert.equal(result.humanReviewed,true);
 assert.equal(result.canDraftExercise,false);
 const other=prioritizeTeacherVideo({...learner,latestTeacherAction:{
  action:"review",analysisAt:"2029-01-01T00:00:00Z",note:"Khác video",
  reviewStatus:"reviewed",teacherName:"Giảng viên"
 }});
 assert.equal(other.humanReviewed,false);
});
test("V43 allocation remains source-pure; only signed audited manager decisions may reach its dedicated API",()=>{
 for(const name of ["manager-ai-allocation-v42.ts","teacher-video-priority-v42.ts"]){
  const c=fs.readFileSync(path.join(root,name),"utf8");
  assert.doesNotMatch(c,/\bfetch\(|\.prepare\(|process\.env|localStorage|sessionStorage|onCommand\(/);
 }
 const approvalPanel=fs.readFileSync(path.join(root,"manager-ai-allocation-panel-v42.tsx"),"utf8");
 assert.match(approvalPanel,/api\\/training-ai-proposals/);
 assert.match(approvalPanel,/const proof=await getProof/);
 assert.match(approvalPanel,/action==="approve"\\)onReviewProposal/);
 assert.doesNotMatch(approvalPanel,/\\.prepare\\(|process\\.env|localStorage|sessionStorage|\\btrainingCommand\\(/);
 const shell=fs.readFileSync(path.join(root,"teacher-role-shell.tsx"),"utf8");
 assert.match(shell,/data-video-coaching-draft/);
 assert.match(shell,/prioritizeTeacherVideo\(learner\)/);
 assert.match(shell,/Soạn bài luyện gợi ý/);
 const manager=fs.readFileSync(path.join(root,"manager-ai-workspace-v41.tsx"),"utf8");
 assert.match(manager,/<ManagerAiAllocationPanelV42 board=\{board\} onNavigate=\{onNavigate\} onReviewProposal=\{onReviewAllocation\}/);
 const managerRoot=fs.readFileSync(path.join(root,"manager-workspace.tsx"),"utf8");
 assert.match(managerRoot,/onReviewAllocation=\{reviewAllocation\}/);
 assert.match(managerRoot,/assignPerson\(person,classId\)/);
 assert.match(managerRoot,/targetClassId/);
 const panel=fs.readFileSync(path.join(root,"manager-ai-allocation-panel-v42.tsx"),"utf8");
 assert.match(panel,/onReview\(r.personId,r.classId\)/);
 assert.match(managerRoot,/action:"assign-person"/);
});

test("V42 limits simulated primary seats and labels alternative proposals as non-reservations",()=>{
 const b=board();
 b.resources[0].teacherCount=1;b.resources[0].missingTeachers=0;
 b.resources[0].capacity=13;b.resources[0].learnerCount=12;
 b.resources[1].capacity=7;b.resources[1].learnerCount=6;
 for(let i=2;i<=6;i++)b.people.push(person("l"+i,"learner","Chưa phân lớp",{name:"HV "+i}));
 const copy=JSON.stringify(b);
 const r=buildAllocationReview(b);
 const preferred=r.learnerShortlist.filter(x=>x.suggestedRole==="primary");
 assert.equal(preferred.length,2,"only two seats are left in the signed class snapshot");
 const used=new Map();
 for(const p of preferred)used.set(p.classId,(used.get(p.classId)??0)+1);
 assert.equal(used.get("a"),1);assert.equal(used.get("b"),1);
 assert.ok(r.learnerShortlist.every(x=>x.warnings.some(w=>w.includes("không giữ chỗ"))));
 assert.equal(JSON.stringify(b),copy);
});
test("No class sessions is an explicit unverified teacher candidate, not confirmed availability",()=>{
 const b=board();b.sessions=[];
 const r=buildAllocationReview(b);
 assert.ok(r.teacherShortlist.length>0);
 assert.ok(r.teacherShortlist.every(x=>x.priority==="medium"&&x.evidenceStatus==="no-class-sessions"));
 assert.ok(r.teacherShortlist.every(x=>/chưa thể xác nhận/.test(x.reason)));
});
test("An exact-video human review remains effective after unrelated teacher feedback",()=>{
 const priorReview={action:"review",analysisAt:analysis.analyzedAt,note:"Đã đối chiếu",
  reviewStatus:"reviewed",teacherName:"Giảng viên"};
 const laterFeedback={...priorReview,action:"feedback",analysisAt:""};
 const result=prioritizeTeacherVideo({...learner,latestTeacherAction:laterFeedback,
   latestVideoReview:priorReview});
 assert.equal(result.humanReviewed,true);
 assert.equal(result.canDraftExercise,false);
});
test("Existing signed assignment requires atomic current-capacity guard for learner moves",()=>{
 const server=fs.readFileSync(path.join(root,"training-management.server.ts"),"utf8");
 assert.match(server,/const learnerNewClass=target.role==="learner"/);
 assert.match(server,/const capacityGuard=learnerNewClass/);
 assert.match(server,/seat\.capacity > \(/);
 assert.match(server,/member\.person_role='learner'/);
 assert.match(server,/entitlement\.state='active'/);
 assert.match(server,/AND \$\{authorityGuard\} \$\{capacityGuard\}/);
 assert.match(server,/\.bind\(className,personId,expectedClassName,target.role,ids.length,\.\.\.authorityBindings,\.\.\.\(learnerNewClass/);
});

test("Credible critical technique error reaches teacher watchlist, not only the video tab",()=>{
 const route=fs.readFileSync(path.join(root,"api/teacher/overview/route.ts"),"utf8");
 const shell=fs.readFileSync(path.join(root,"teacher-role-shell.tsx"),"utf8");
 assert.match(route,/const technicalNeedsSupport = Boolean\(analysis/);
 assert.match(route,/analysis\.errors\.some\(\(issue\) => issue\.severity === "critical"\)/);
 assert.match(route,/score !== null && score < 60/);
 assert.match(route,/const needsSupport = technicalNeedsSupport \|\|/);
 assert.match(shell,/Video AI cần sửa:/);
 assert.match(shell,/sort\(compareAttention\)/);
 assert.match(shell,/function compareAttention\(/);
});

test("Teacher source LIMIT saturation is disclosed, never misrepresented as complete review history",()=>{
 const route=fs.readFileSync(path.join(root,"api/teacher/overview/route.ts"),"utf8");
 const shell=fs.readFileSync(path.join(root,"teacher-role-shell.tsx"),"utf8");
 assert.match(route,/const coverage = \{/);
 assert.match(route,/learningEventLimitReached: \(learningEventsResult\.results \?\? \[\]\)\.length >= 12000/);
 assert.match(route,/learnerLimitReached: \(result\.results \?\? \[\]\)\.length >= 200/);
 assert.match(route,/return json\(\{\s*coverage,/);
 assert.match(shell,/coverage\?: \{ possiblyTruncated:boolean/);
 assert.match(shell,/overview\?\.coverage\?\.possiblyTruncated/);
 assert.match(shell,/chưa đầy đủ do giới hạn số bản ghi/);
});

test("V43 cross-class scheduler never marks the same teacher primary for overlapping proposed classes",()=>{
 const b=board();
 b.resources.push(resource("c","C",{learnerCount:5,teacherCount:0,missingTeachers:1}));
 b.people.push(person("t4","teacher","",{name:"Instructor 4"}));
 b.sessions.push({id:"sC",title:"C",classId:"c",roomId:"r3",teacherId:"missing2",
  assistantTeacherId:null,periodStart:null,periodEnd:null,startsAt:time,endsAt:end,status:"scheduled",version:1});
 const r=buildAllocationReview(b);
 const primaries=r.teacherShortlist.filter(x=>x.suggestedRole==="teacher-primary");
 const sameTeacher=primaries.filter(x=>x.personId==="t1");
 assert.ok(primaries.length>0);
 assert.ok(sameTeacher.length<=1,"do not double-book one teacher across overlapping proposals");
 assert.ok(r.teacherShortlist.some(x=>x.suggestedRole==="teacher-alternative"));
 assert.ok(r.teacherShortlist.every(x=>x.warnings.some(w=>w.includes("không khóa giờ"))));
 assert.equal(r.teacherShortlist.filter(x=>x.suggestedRole==="teacher-primary"&&x.classId==="c").length,1);
});
test("V43 candidate with missing or invalid target class sessions is NEVER marked primary",()=>{
 const b=board();
 b.sessions[0].endsAt=b.sessions[0].startsAt;
 const r=buildAllocationReview(b);
 assert.ok(r.teacherShortlist.every(x=>x.suggestedRole==="teacher-alternative"));
 assert.ok(r.teacherShortlist.every(x=>x.evidenceStatus==="no-class-sessions"));
});
