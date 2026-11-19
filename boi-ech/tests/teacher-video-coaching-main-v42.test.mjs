import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
import ts from "typescript";
const root=path.join(fileURLToPath(new URL("../",import.meta.url)),"app");
const source=fs.readFileSync(path.join(root,"teacher-video-priority-v42.ts"),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const mod={exports:{}};
new Function("require","module","exports",compiled)(createRequire(import.meta.url),mod,mod.exports);
const {prioritizeTeacherVideo}=mod.exports;
const analysis={
 score:95,confidence:91,captureQuality:"good",poseCoverage:90,averageVisibility:95,
 sampledFrames:40,detectedFrames:35,durationSec:10,cameraView:"rear",
 categories:{legs:45,arms:90,coordination:70,bodyLine:88},errorCount:1,
 topErrors:["Thu chân chưa gọn"],errors:[{
  title:"Thu chân chưa gọn",severity:"critical",timeSec:3,confidence:91,
  observed:"Gối mở quá rộng",expected:"Thu gối gọn",recommendation:"Luyện thu chân gọn rồi đạp khép"
 }],analyzedAt:"2030-06-06T10:00:00Z"
};
const learner={lastAnalysis:analysis,latestTeacherAction:null,adaptive:{priorityLesson:"03"},lastLesson:"02"};
test("V42-B source critical error remains priority even when video score is high",()=>{
 const original=JSON.stringify(learner);
 const r=prioritizeTeacherVideo(learner);
 assert.equal(r.rank,2);assert.equal(r.evidenceStatus,"sufficient");
 assert.equal(r.canDraftExercise,true);assert.equal(r.lessonNumber,"03");
 assert.match(r.exerciseNote,/Thu chân chưa gọn/);
 assert.match(r.exerciseNote,/Giảng viên kiểm tra lại/);
 assert.equal(JSON.stringify(learner),original);
});
test("V42-B low confidence and weak capture never invent corrective exercise",()=>{
 for(const changed of [{...analysis,confidence:40},{...analysis,captureQuality:"review"}]){
  const r=prioritizeTeacherVideo({...learner,lastAnalysis:changed});
  assert.equal(r.evidenceStatus,"capture-review");assert.equal(r.canDraftExercise,false);
  assert.match(r.nextStep,/quay lại/);
 }
 const none=prioritizeTeacherVideo({...learner,lastAnalysis:null});
 assert.equal(none.canDraftExercise,false);assert.equal(none.evidenceStatus,"missing");
});
test("V42-B review is specific to exact analysis, feedback does not reopen completed review",()=>{
 const reviewed={action:"review",analysisAt:analysis.analyzedAt,note:"Đã kiểm tra",
  reviewStatus:"reviewed",teacherName:"GV"};
 const feedback={...reviewed,action:"feedback",analysisAt:""};
 const r=prioritizeTeacherVideo({...learner,latestTeacherAction:feedback,latestVideoReview:reviewed});
 assert.equal(r.humanReviewed,true);assert.equal(r.canDraftExercise,false);
 const wrong=prioritizeTeacherVideo({...learner,latestTeacherAction:feedback,
 latestVideoReview:{...reviewed,analysisAt:"2025-01-01T00:00:00Z"}});
 assert.equal(wrong.humanReviewed,false);assert.equal(wrong.canDraftExercise,true);
});
test("V42-B source and UI never send a model request or assignment without teacher confirmation",()=>{
 const ui=fs.readFileSync(path.join(root,"teacher-role-shell.tsx"),"utf8");
 const route=fs.readFileSync(path.join(root,"api/teacher/overview/route.ts"),"utf8");
 assert.doesNotMatch(source,/fetch\s*\(|process\.env|\.prepare\(|\.batch\(|localStorage|sessionStorage/);
 assert.match(ui,/data-video-coaching-draft/);
 assert.match(ui,/Soạn bài luyện gợi ý/);
 assert.match(ui,/prioritizeTeacherVideo\(learner\)/);
 assert.match(ui,/mode:"assignment",learner,analysisAt:analysis\.analyzedAt/);
 assert.match(ui,/onSubmit\(draft, \{ note, title, lessonNumber/);
 assert.match(ui,/latestVideoReview \?\? learner\.latestTeacherAction/);
 assert.match(route,/const technicalNeedsSupport=Boolean/);
 assert.match(route,/analysis\.errors\.some\(issue=>issue\.severity==="critical"\)/);
});
test("V42-B teacher source query cap remains visible as unknown, not full historical coverage",()=>{
 const ui=fs.readFileSync(path.join(root,"teacher-role-shell.tsx"),"utf8");
 const route=fs.readFileSync(path.join(root,"api/teacher/overview/route.ts"),"utf8");
 assert.match(route,/learnerLimitReached:\(result\.results\?\?\[\]\)\.length>=200/);
 assert.match(route,/learningEventLimitReached:\(learningEventsResult\.results\?\?\[\]\)\.length>=12000/);
 assert.match(route,/return json\(\{\s*coverage,/);
 assert.match(ui,/overview\?\.coverage\?\.possiblyTruncated/);
 assert.match(ui,/chưa đầy đủ do giới hạn số bản ghi/);
 assert.match(route,/teacherActionSummary\("teacher_analysis_review"/);
 assert.match(route,/detail\.analysisAt===analysis\.analyzedAt/);
});
