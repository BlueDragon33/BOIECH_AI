import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
const source=readFileSync(resolve("app/manager-ai-profile-admission-v43.ts"),"utf8");
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
new Function("module","exports",output)(module,module.exports);
const {assessProfilePlacement}=module.exports;
const now="2030-06-06T09:00:00Z";
const session={startsAt:"2030-06-06T10:00:00Z",endsAt:"2030-06-06T11:00:00Z"};
const avail={startsAt:"2030-06-06T08:00:00Z",endsAt:"2030-06-06T13:00:00Z"};
const seal=sourceId=>({sourceId,revision:3,verifiedAt:"2030-06-05T09:00:00Z",expiresAt:"2030-07-06T09:00:00Z",approvedBy:"signed-owner",purpose:"class-allocation",consented:true});
function fixture(){
 return {now,teacherId:"T1",learnerId:"L1",classId:"C1",existingTeacherClasses:1,registeredLearners:8,
  teacher:{teacherId:"T1",seal:seal("staff:T1"),certificates:[{code:"breaststroke-coach",validUntil:"2031-01-01T00:00:00Z",verified:true}],
    available:[avail],maxActiveClasses:3,absences:[]},
  learner:{learnerId:"L1",seal:seal("learner:L1"),desiredWindows:[avail],declaredLevel:"beginner"},
  klass:{classId:"C1",seal:seal("class:C1"),requiredCertification:"breaststroke-coach",
    requiredLevel:"beginner",trainingWindows:[session],poolSafetyApproved:true,trainerToLearnerLimit:10}
 };
}
test("approved and fresh three-source profiles may yield explanation, never assignment command",()=>{
 const result=assessProfilePlacement(fixture());
 assert.equal(result.status,"eligible");
 assert.equal(result.checkedSourceIds.length,3);
 assert.ok(result.reasons.some(x=>x.includes("D1")));
 assert.doesNotMatch(source,/\bfetch\(|\.prepare\(|localStorage|process\.env|Cloudflare/);
});
test("missing, unconsented or stale additional profile never pretends candidate is free",()=>{
 const a=fixture();a.teacher=null;
 assert.equal(assessProfilePlacement(a).status,"insufficient-source");
 const b=fixture();b.learner.seal.consented=false;
 assert.equal(assessProfilePlacement(b).status,"insufficient-source");
 const c=fixture();c.teacher.seal.verifiedAt="2029-10-01T00:00:00Z";
 assert.equal(assessProfilePlacement(c).status,"insufficient-source");
 const d=fixture();d.klass.seal.expiresAt="2030-01-01T00:00:00Z";
 assert.equal(assessProfilePlacement(d).status,"insufficient-source");
});
test("certification, declared level, maximum class load and pool safety veto independently",()=>{
 for(const mutate of [
  x=>{x.teacher.certificates[0].verified=false},
  x=>{x.learner.declaredLevel="advanced"},
  x=>{x.existingTeacherClasses=3},
  x=>{x.registeredLearners=10},
  x=>{x.klass.poolSafetyApproved=false}
 ]){const b=fixture();mutate(b);assert.equal(assessProfilePlacement(b).status,"hard-veto");}
});
test("work hours, student requested hours and staff absence are hard schedule constraints",()=>{
 for(const mutate of [
  x=>{x.teacher.available=[{startsAt:"2030-06-06T12:00:00Z",endsAt:"2030-06-06T13:00:00Z"}]},
  x=>{x.learner.desiredWindows=[{startsAt:"2030-06-06T12:00:00Z",endsAt:"2030-06-06T13:00:00Z"}]},
  x=>{x.teacher.absences=[session]}
 ]){const b=fixture();mutate(b);assert.equal(assessProfilePlacement(b).status,"hard-veto");}
});
test("invalid source identity or invalid schedule is denied",()=>{
 const a=fixture();a.teacher.teacherId="wrong";
 assert.equal(assessProfilePlacement(a).status,"hard-veto");
 const b=fixture();b.klass.trainingWindows=[{startsAt:"invalid",endsAt:"not-a-date"}];
 assert.equal(assessProfilePlacement(b).status,"insufficient-source");
});
