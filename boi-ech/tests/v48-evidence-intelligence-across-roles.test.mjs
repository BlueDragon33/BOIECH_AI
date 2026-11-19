import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const src=(name)=>readFileSync(new URL("../app/"+name,import.meta.url),"utf8");
function load(name){
 const js=ts.transpileModule(src(name),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText;
 const holder={exports:{}};
 new Function("require","module","exports",js)(()=>{throw new Error("Pure module must not import runtime dependencies");},
  holder,holder.exports);
 return holder.exports;
}
const {assessLearnerEvidenceV48}=load("learner-evidence-readiness-v48.ts");
const {buildTeacherEvidenceQueueV48}=load("teacher-evidence-triage-v48.ts");
const {buildManagerDecisionBriefV48}=load("manager-action-brief-v48.ts");
const NOW=Date.parse("2026-11-19T19:00:00.000Z");
const plan=(lessonNumber="01",id="one")=>({id,lessonNumber,section:"on-tap",minutes:12,title:"Ôn bài",reason:"Theo dữ liệu học"});
const lesson=(lessonNumber="01",attempts=0,score=null,mastery=0,unlocked=true)=>({
 lessonNumber,attempts,score,mastery,unlocked
});
const learning=(partial={})=>({
 generatedAt:"2026-11-19T18:59:00.000Z",priorityLesson:"01",
 competencies:[lesson("01"),lesson("02",2,75,70)],
 todayPlan:[plan("01"),plan("02","two")],...partial
});

test("V48 learner: untested priority is unknown, never inferred mastery=0",()=>{
 const out=assessLearnerEvidenceV48(learning(),NOW);
 assert.equal(out.priorityMastery,null);
 assert.equal(out.evidenceStatus,"provisional");
 assert.equal(out.planStatus,"exploratory");
 assert.equal(out.observedLessons,1);
 assert.equal(out.unlockedLessons,2);
 assert.ok(out.checkpoint.includes("Chưa đủ"));
});
test("V48 learner: measured zero stays a genuine zero; multi lesson evidence is provisional not certificate",()=>{
 const out=assessLearnerEvidenceV48(learning({competencies:[
  lesson("01",2,0,0),lesson("02",3,90,86)]}),NOW);
 assert.equal(out.priorityMastery,0);
 assert.equal(out.evidenceStatus,"observed");
 assert.equal(out.planStatus,"ready");
 assert.ok(out.limitations.some(x=>x.includes("không phải")));
});
test("V48 learner: stale and future-dated intelligence cannot send a plan to locked lessons",()=>{
 const stale=assessLearnerEvidenceV48(learning({generatedAt:"2026-11-17T09:00:00.000Z"}),NOW);
 assert.equal(stale.sourceStatus,"stale");
 assert.deepEqual(stale.usablePlan,[]);
 const future=assessLearnerEvidenceV48(learning({generatedAt:"2026-11-20T05:00:00.000Z"}),NOW);
 assert.equal(future.sourceStatus,"invalid");
 const locked=assessLearnerEvidenceV48(learning({
  competencies:[lesson("01",2,60,50),lesson("02",2,90,89,false)],
  todayPlan:[plan("01"),plan("02","locked"),plan("01","duplicate",),{...plan("01","bad"),minutes:-3}]
 }),NOW);
 assert.deepEqual(locked.usablePlan.map(x=>x.id),["one","duplicate"]);
});
test("V48 learner: unsafe/missing times, unbounded minutes and invalid scores fail closed",()=>{
 const data=learning({generatedAt:"not a timestamp",competencies:[
  lesson("01",100,Number.NaN,NaN)],todayPlan:[plan("01")]});
 const out=assessLearnerEvidenceV48(data,NOW);
 assert.equal(out.sourceStatus,"invalid");
 assert.equal(out.priorityMastery,null);
 assert.equal(out.observedLessons,0);
 assert.equal(out.planStatus,"paused");
});
const suggestion=(mode,lessonNumber,id,priority="critical")=>({
 id,mode,lessonNumber,priority,title:"Cần xem",reason:"Theo chứng cứ",evidence:[]
});
const teacher=(personCode,suggestions,extra={})=>({
 name:personCode,className:"Lớp A",personCode,interventionSuggestions:suggestions,...extra
});
test("V48 teacher: round-robin fairness, no learner monopolizes equal-priority queue",()=>{
 const rows=[
  teacher("A",[suggestion("feedback","01","A1"),suggestion("assignment","02","A2")]),
  teacher("B",[suggestion("review","01","B1")])
 ];
 const out=buildTeacherEvidenceQueueV48(rows,{limit:3});
 assert.deepEqual(out.items.map(x=>x.learner.personCode),["A","B","A"]);
 assert.equal(out.totalEligible,3);assert.equal(out.hidden,0);
});
test("V48 teacher: poor capture promotes human review, not skill diagnosis; shows limits",()=>{
 const poor={lastAnalysis:{confidence:45,captureQuality:"review"}};
 const rows=[teacher("A",[suggestion("assignment","02","A1","critical")],poor),
  teacher("B",[suggestion("review","01","B1","high")],poor)];
 const out=buildTeacherEvidenceQueueV48(rows,{limit:1,sourcePossiblyTruncated:true});
 assert.equal(out.items[0].learner.personCode,"B");
 assert.equal(out.items[0].urgency,4);
 assert.equal(out.hidden,1);assert.equal(out.possiblyIncomplete,true);
 assert.equal(buildTeacherEvidenceQueueV48(rows,{limit:3}).items
  .find(x=>x.learner.personCode==="A").evidenceCaution,true);
 const impossible=buildTeacherEvidenceQueueV48([
  teacher("C",[suggestion("review","01","C1","high")],{
   lastAnalysis:{confidence:140,captureQuality:"good"}
  })
 ]);
 assert.equal(impossible.items[0].urgency,4,"Impossible confidence >100 must trigger source review");
});
test("V48 teacher: rejects unauthorized empty learner identifiers, caps output, immutable input",()=>{
 const source=Object.freeze([Object.freeze(teacher("A",[suggestion("feedback","01","a")])),
  Object.freeze(teacher("",[suggestion("feedback","01","x")]))]);
 const out=buildTeacherEvidenceQueueV48(source);
 assert.equal(out.rejected,1);
 assert.equal(out.items.length,1);
 assert.equal(source[0].interventionSuggestions.length,1);
});
const finding=(id,target,priority,area="staff")=>({
 id,target,priority,area,title:id,details:id,
 recommendedAction:"Xác minh "+id,
 evidence:[{source:"people",recordId:"P-"+id,fields:"status",observedAt:"2026-11-19T18:59:00.000Z"}],
 limitations:[]
});
const report=(overrides={})=>({
 observedAt:"2026-11-19T18:59:00.000Z",engineVersion:"manager-ai-evidence-v41.0.0",
 engineMode:"rules-only",generativeAiActive:false,
 window:{from:"2026-11-01T00:00:00Z",to:"2026-11-30T00:00:00Z"},
 coverage:{classes:3,teachers:4,rooms:4,sessions:10},totalFindings:3,
 findings:[finding("one","people","critical"),finding("two","people","high"),
  finding("three","schedule","medium")],
 sourceMayBeTruncated:false,conflictExamplesLimited:false,truncated:false,
 counts:{critical:1,high:1,medium:1,info:0},...overrides
});
test("V48 manager: aggregate cited risk by exact destination and keep human approval",()=>{
 const r=buildManagerDecisionBriefV48(report(),NOW);
 assert.equal(r.status,"scoped");
 assert.equal(r.groups[0].target,"people");
 assert.equal(r.groups[0].priority,"critical");
 assert.equal(r.groups[0].reportedItems,2);
 assert.deepEqual(r.groups[0].referenceIds,["people:P-one","people:P-two"]);
 assert.equal(r.groups[0].requiresHumanReview,true);
});
test("V48 manager: incomplete or stale source cannot assert all clear",()=>{
 const partial=buildManagerDecisionBriefV48(report({truncated:true,totalFindings:99}),NOW);
 assert.equal(partial.status,"partial");
 assert.ok(partial.warnings.some(w=>w.includes("giới hạn")));
 const stale=buildManagerDecisionBriefV48(report({observedAt:"2026-11-19T18:40:00.000Z"}),NOW);
 assert.equal(stale.status,"stale");
 const future=buildManagerDecisionBriefV48(report({observedAt:"2026-11-20T19:00:00.000Z"}),NOW);
 assert.equal(future.status,"invalid");
 const none=buildManagerDecisionBriefV48(report({findings:[],totalFindings:0}),NOW);
 assert.ok(none.warnings.some(w=>w.includes("không chứng minh")));
});
test("V48 UI wiring uses only existing signed role snapshots and never calls remote model",()=>{
 const learner=src("student-adaptive-coach.tsx"),teacher=src("teacher-smart-interventions.tsx");
 const manager=src("manager-ai-workspace-v41.tsx"),shell=src("teacher-role-shell.tsx");
 assert.match(learner,/assessLearnerEvidenceV48\(intelligence/);
 assert.match(learner,/evidence\.usablePlan\.map/);
 assert.match(teacher,/buildTeacherEvidenceQueueV48\(learners/);
 assert.match(shell,/sourcePossiblyTruncated=\{Boolean\(overview\?\.coverage\?\.possiblyTruncated\)\}/);
 assert.match(manager,/buildManagerDecisionBriefV48\(report/);
 assert.match(manager,/data-manager-action-brief-v48/);
 for(const path of ["learner-evidence-readiness-v48.ts","teacher-evidence-triage-v48.ts","manager-action-brief-v48.ts"]){
  assert.doesNotMatch(src(path),/fetch\s*\(|\.run\s*\(|\.batch\s*\(|https?:\/\/|apiKey|openai|anthropic|D1Database/);
 }
});
