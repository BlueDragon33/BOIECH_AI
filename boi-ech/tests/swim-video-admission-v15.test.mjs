import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {inspectSwimmingEvidence} from "../app/phan-tich-video/swim-content-gate.mjs";

function frame(i,kind="swim"){
 const moving=kind!=="still"&&kind!=="no-pose";
 const s=moving?Math.sin(i*.95):0;
 const p=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:1}));
 if(kind==="no-pose")return {time:i/5,landmarks:[],visibility:0};
 const vertical=kind==="standing"||kind==="still";
 // Side clip: horizontal spine; standing clip: near-vertical spine.
 p[11]={x:.30,y:.44,z:0,visibility:1};p[12]={x:.3,y:.47,z:0,visibility:1};
 p[23]={x:vertical?.32:.65,y:vertical?.8:.45,z:0,visibility:1};
 p[24]={x:vertical?.34:.67,y:vertical?.82:.47,z:0,visibility:1};
 p[13]={x:.18,y:.4,z:0,visibility:1};p[14]={x:.18,y:.44,z:0,visibility:1};
 p[15]={x:.04+(.12*s),y:.36+(.25*s),z:0,visibility:1};
 p[16]={x:.04+(.12*s),y:.42+(.25*s),z:0,visibility:1};
 p[25]={x:vertical?.34:.74,y:.55,z:0,visibility:1};
 p[26]={x:vertical?.36:.76,y:.57,z:0,visibility:1};
 p[27]={x:vertical?.38:.87,y:.58+(.3*s),z:0,visibility:1};
 p[28]={x:vertical?.4:.88,y:.61+(.3*s),z:0,visibility:1};
 return {time:i/5,landmarks:p,visibility:1};
}
const samples=(n,kind)=>Array.from({length:n},(_,i)=>frame(i,kind));
test("swim content gate rejects absent/short/no-human clip before any scoring",()=>{
 const no=inspectSwimmingEvidence(samples(20,"no-pose"),20,"side");
 const short=inspectSwimmingEvidence(samples(5,"swim"),20,"side");
 assert.notEqual(no.status,"plausible");
 assert.notEqual(short.status,"plausible");
 assert.ok(no.issues.length>0);
});
test("stationary standing person is not accepted as swimming video",()=>{
 const result=inspectSwimmingEvidence(samples(22,"still"),22,"side");
 assert.equal(result.status,"reject");
 assert.match(result.note,/video|bơi/i);
});
test("moving horizontal swimmer pose is plausible but not certified as water",()=>{
 const result=inspectSwimmingEvidence(samples(26,"swim"),26,"side");
 assert.equal(result.status,"plausible",JSON.stringify(result));
 assert.ok(result.movingRatio>19);
 assert.match(result.note,/chưa xác thực được môi trường nước/i);
});
test("low visibility cannot yield a high-confidence swim admission",()=>{
 const video=samples(20,"swim").map((f,i)=>({...f,visibility:i<16?.35:.88}));
 const result=inspectSwimmingEvidence(video,20,"side");
 assert.notEqual(result.status,"plausible");
});
test("main video evaluator calls gate before score, sync or grade persistence",()=>{
 const source=readFileSync(new URL("../app/phan-tich-video/video-analyzer-impl.tsx",import.meta.url),"utf8");
 const gate=source.indexOf("const contentGate=inspectSwimmingEvidence");
 const save=source.indexOf("await putLocalAnalysis(analysis)");
 const scoring=source.indexOf("const categories = scoreCategories(errors)");
 assert.ok(gate>0&&gate<scoring&&scoring<save);
 assert.match(source,/if\(contentGate\.status!=="plausible"\)/);
 assert.match(source,/scoreSwimmingTechnique\(scoreCategories\(errors\), contentGate, view\)/);
 assert.match(source,/swimConfirmed/);
 assert.match(source,/setContentEvidence\(contentGate\)/);
 assert.match(source,/Video gốc không rời thiết bị/);
});

test("incorrect breaststroke actions are graded, not falsely rejected as an irrelevant video",()=>{
 const clip=inspectSwimmingEvidence(samples(26,"standing"),26,"side");
 assert.equal(clip.status,"plausible",JSON.stringify(clip));
 assert.ok(clip.horizontalRatio<56,"upright form is a grading signal, not an admission blocker");
});
test("poor technique can actually score below 5/10 and explicitly asks for learning check",async()=>{
 const {scoreSwimmingTechnique,LOW_SWIM_SCORE_BELOW}=await import("../app/phan-tich-video/swim-technique-score.mjs");
 const baseline={legs:100,arms:100,coordination:100,bodyLine:100};
 const weak=scoreSwimmingTechnique(baseline,{kneeExcursion:9,armExcursion:13,movingRatio:19,horizontalRatio:38},"side");
 assert.ok(weak.score<50,JSON.stringify(weak));
 assert.equal(weak.needsLearningCheck,true);
 assert.equal(LOW_SWIM_SCORE_BELOW,50);
 const strong=scoreSwimmingTechnique(baseline,{kneeExcursion:70,armExcursion:80,movingRatio:80,horizontalRatio:95},"side");
 assert.equal(strong.score,100);
 assert.equal(strong.needsLearningCheck,false);
 const component=readFileSync(new URL("../app/phan-tich-video/video-analyzer-impl.tsx",import.meta.url),"utf8");
 assert.match(component,/result\.score < LOW_SWIM_SCORE_BELOW/);
 assert.match(component,/Bạn có đang thực sự học bơi không vậy\?/);
 assert.match(component,/\(result\.score \/ 10\)\.toFixed\(1\)/);
});
test("wrong swimming body position never disqualifies a clip with visible movement",()=>{
 const data=readFileSync(new URL("../app/phan-tich-video/swim-content-gate.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(data,/horizontalRatio<LIMITS\.minimumSideHorizontal/);
 assert.doesNotMatch(data,/kneeExcursion<LIMITS\.minimumKneeExcursion/);
});
