import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const source=readFileSync(new URL("../app/teacher-learning-analytics.server.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const holder={exports:{}};
new Function("module","exports",compiled)(holder,holder.exports);
const {buildLearningAnalytics}=holder.exports;
const event=(id,type,day,detail,lesson="03")=>({
 id,device_id:"qa-only",event_type:type,lesson_number:lesson,part:null,
 created_at:`2030-06-${day}T10:00:00Z`,detail_json:JSON.stringify(detail)
});
const video=(score,extra={})=>({score,confidence:85,captureQuality:{level:"good"},cameraView:"side",engineVersion:"pose-v1",...extra});
const report=(before,after,beforeLesson="03")=>buildLearningAnalytics([
 event(1,"video_ai_analysis","01",before,beforeLesson),
 event(2,"teacher_assignment","02",{note:"Tập khép chân"}),
 event(3,"video_ai_analysis","03",after)
]).latest;

test("missing scores stay unknown and never create a positive improvement",()=>{
 for(const missing of [null,undefined,"",true,[],{},"invalid",-1,101]){
  const result=report(video(missing),video(82));
  assert.equal(result.beforeVideo.score,null);
  assert.equal(result.videoDelta,null);
  assert.equal(result.observedChange,"new-evidence");
  assert.match(result.videoComparisonNote,/chưa có điểm/);
 }
 assert.equal(report(video(0),video(82)).videoDelta,82);
 assert.equal(report(video("0"),video("82")).videoDelta,82);
});

test("unknown confidence, changed engine, view, lesson or low capture quality prevents comparison",()=>{
 for(const changed of [
  {confidence:null},{confidence:""},{confidence:false},{confidence:69},
  {captureQuality:{level:"review"}},{cameraView:"rear"},{cameraView:null},
  {engineVersion:"pose-v2"},{engineVersion:null}
 ]){
  const result=report(video(20),video(82,changed));
  assert.equal(result.videoDelta,null);
  assert.notEqual(result.observedChange,"positive");
 }
 assert.equal(report(video(20),video(82),"02").videoDelta,null);
 assert.equal(report(video(20),video(82,{confidence:null})).afterVideo.confidence,null);
});

test("valid equal-condition video comparisons and genuine zero quiz scores remain usable",()=>{
 const result=report(video(70),video(82));
 assert.equal(result.videoDelta,12);
 assert.equal(result.observedChange,"positive");
 const quiz=before=>buildLearningAnalytics([
  event(1,"quiz_submit","01",{score:before}),
  event(2,"teacher_feedback","02",{}),event(3,"quiz_submit","03",{score:8})
 ]).latest;
 assert.equal(quiz(0).quizDelta,8);
 assert.equal(quiz(null).quizDelta,null);
 assert.equal(quiz("").beforeQuiz.score,null);
});

test("corrupt legacy JSON is tolerated and follow-up stops at the next intervention",()=>{
 const rows=[event(1,"video_ai_analysis","01",null),event(2,"teacher_assignment","02",{}),
  event(3,"teacher_feedback","03",{}),event(4,"video_ai_analysis","04",video(90))];
 const result=buildLearningAnalytics(rows);
 assert.equal(result.interventions[1].afterVideo,null);
 assert.equal(result.interventions[0].videoDelta,null);
 for(const detail_json of ["{", "null", "[]", "42"]){
  const old={...rows[0],detail_json};
  assert.doesNotThrow(()=>buildLearningAnalytics([old,...rows.slice(1)]));
 }
});
