import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";
import {createRequire} from "node:module";

const app=path.join(fileURLToPath(new URL("../",import.meta.url)),"app");
const root=path.join(fileURLToPath(new URL("../",import.meta.url)));
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
function load(name){
 const code=ts.transpileModule(read("app/"+name),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText;
 const module={exports:{}};
 new Function("require","module","exports",code)(createRequire(import.meta.url),module,module.exports);
 return module.exports;
}
const {validateSubmittedTrainingProfile,validateClassSafetyProfile}=load("training-ai-profile-data.server.ts");
const teacher={
 certificates:[{code:"SWIM_COACH_01",validUntil:"2030-11-19T09:00:00Z"}],
 available:[{startsAt:"2030-11-20T10:00:00Z",endsAt:"2030-11-20T12:00:00Z"}],
 absences:[],maxActiveClasses:3
};
const learner={declaredLevel:"beginner",desiredWindows:[
 {startsAt:"2030-11-20T10:00:00Z",endsAt:"2030-11-20T12:00:00Z"}]};

test("V44 teacher and learner declarations are narrowly validated and never infer hidden health fields",()=>{
 const t=validateSubmittedTrainingProfile("teacher",teacher),l=validateSubmittedTrainingProfile("learner",learner);
 assert.equal(t.ok,true);assert.equal(l.ok,true);
 assert.equal(validateSubmittedTrainingProfile("teacher",{...teacher,maxActiveClasses:20}).ok,false);
 assert.equal(validateSubmittedTrainingProfile("learner",{...learner,declaredLevel:"expert"}).ok,false);
 assert.equal(validateSubmittedTrainingProfile("learner",{...learner,desiredWindows:[
 {startsAt:"2030-11-20T12:00:00Z",endsAt:"2030-11-20T10:00:00Z"}]}).ok,false);
 assert.equal(validateClassSafetyProfile({requiredCertification:"SWIM_COACH_01",
  requiredLevel:"beginner",poolSafetyApproved:false,trainerToLearnerLimit:16,
  trainingWindows:teacher.available}).ok,false);
 assert.equal(JSON.stringify(t.payload).includes("health"),false);
});
test("V44 signed opt-in UI cannot submit without explicit checkbox and current revision",()=>{
 const ui=read("app/training-ai-consent-panel-v44.tsx");
 const teacherShell=read("app/teacher-role-shell.tsx");
 const learnerShell=read("app/student-role-shell.tsx");
 const learnerProof=read("app/student-ai-consent-v44.tsx");
 const manager=read("app/manager-workspace.tsx");
 const managerPanel=read("app/manager-ai-profile-review-v44.tsx");
 assert.match(ui,/!consent/);
 assert.match(ui,/expectedRevision:revision,consent:true/);
 assert.match(ui,/action:"withdraw",expectedRevision:revision/);
 assert.match(ui,/withdrawConfirm/);
 assert.match(ui,/role="alert"/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|audio|video\/mp4|camera|getUserMedia/);
 assert.match(teacherShell,/TrainingAiConsentPanelV44 key=\{deviceId\} role="teacher"/);
 assert.match(teacherShell,/signedTeacherProof\(credential,deviceId\)/);
 assert.match(learnerShell,/StudentAiConsentV44 key=\{snapshot\.deviceId\}/);
 assert.match(learnerProof,/signedLearnerProof\(credential,deviceId\)/);
 assert.match(manager,/ManagerAiProfileReviewV44 board=\{board\} getProof=\{getProof\}/);
 assert.match(managerPanel,/const proof=await getProof\(\)/);
 assert.match(managerPanel,/!safetyConfirmed/);
 assert.match(managerPanel,/expectedRevision:record\.revision/);
});
test("V43 inbox UI is explicit signed polling and never claims a seen receipt is reviewed footage",()=>{
 const ui=read("app/teacher-video-inbox-panel-v43.tsx");
 const teacher=read("app/teacher-role-shell.tsx");
 const route=read("app/api/teacher/video-inbox/route.ts");
 const service=read("app/teacher-video-inbox.server.ts");
 assert.match(ui,/onRequest\(\{action:"list"\}\)/);
 assert.match(ui,/onRequest\(\{action:"seen",eventId:item\.eventId,expectedRevision:item\.revision\}\)/);
 assert.match(ui,/Chưa đồng nghĩa đã đánh giá kỹ thuật video/);
 assert.match(ui,/possiblyTruncated/);
 assert.match(teacher,/TeacherVideoInboxPanelV43 key=\{deviceId\}/);
 assert.match(teacher,/signedTeacherProof\(credential,deviceId\)/);
 assert.match(route,/verifyDeviceRequest\(payload,previewRequest\)/);
 assert.match(route,/teacher\.personRole!=="teacher"/);
 assert.match(service,/AND \$\{activeLearnerSql\}/);
 assert.match(service,/AND \$\{assignedClassSql\}/);
 assert.doesNotMatch(service,/\.put\(|\.delete\(|video\/mp4/);
});
test("V44 disabled policy is server-side before D1 and has no paid-provider activation",()=>{
 const route=read("app/api/training-ai-profiles/route.ts");
 const core=read("app/training-ai-profile-data.server.ts");
 assert.match(route,/if\(!await profileAdmissionEnabled\(\)\)/);
 const indexFlag=route.indexOf("if(!await profileAdmissionEnabled())");
 const indexDb=route.indexOf("const db=await getCourseDatabase()");
 assert.ok(indexFlag>=0&&indexDb>indexFlag);
 assert.match(core,/BOI_ECH_AI_PROFILE_ADMISSION==="enabled"/);
 assert.match(route,/expectedRevision/);
 assert.match(route,/state='pending' AND consent_at IS NOT NULL/);
 assert.match(route,/AI_PROFILE_VERIFY_CONFLICT/);
 assert.doesNotMatch(route,/OPENAI_API_KEY|ANTHROPIC_API_KEY|\bpaid\b/);
});
test("Staged migration creates empty receipt and consent tables, not existing account rewrites",()=>{
 const inbox=read("drizzle/0043_teacher_video_inbox.sql");
 const consent=read("drizzle/0045_training_ai_consented_profiles.sql");
 for(const script of [inbox,consent]){
  assert.match(script,/CREATE TABLE IF NOT EXISTS/);
  assert.doesNotMatch(script,/DELETE FROM|INSERT INTO|UPDATE\s+device_access|DROP TABLE|ALTER TABLE/);
 }
 assert.match(inbox,/PRIMARY KEY \(teacher_device_id,video_event_id\)/);
 assert.match(consent,/CHECK\(state!='verified' OR/);
});
