import test from "node:test";
import assert from "node:assert/strict";
import {evaluateLocalVideoCorpus} from "../scripts/evaluate-local-video-corpus-v47.mjs";
const phases=["pull","breath","leg-recovery","kick","glide"];
const clip=(index,{unlabeled=false}={})=>{
 const frames=phases.map((phase,i)=>({time:i*0.2,phase,armFlexion:60,kneeFlexion:50,
  wristSpread:0.4,ankleSpread:0.3,visibility:0.9}));
 return {id:"clip-test"+String(index).padStart(6,"0"),cameraView:"side",
  lighting:"bright",engineVersion:"local-phase-v1",reviewedByRef:"trainer-review-001",
  frames,labelsByTime:unlabeled?{}:
   Object.fromEntries(frames.map((f,i)=>[f.time.toFixed(3),phases[i]]))};
};
test("V47 video corpus report retains real per-phase evidence but never certifies AI accuracy",()=>{
 const x=evaluateLocalVideoCorpus({schema:"boi-ech-local-groundtruth/v1",
   clips:[clip(1),clip(2),clip(3),clip(4),clip(5)]},{minClips:5,minPerPhase:3});
 assert.equal(x.evidenceStatus,"REVIEW_REQUIRED");
 assert.equal(x.independentHumanValidation,"NOT_VERIFIED");
 assert.equal(x.clipCount,5);
 assert.ok(phases.every(p=>x.phases[p].f1===1));
 assert.equal(x.clips.length,5);
});
test("V47 empty labels, insufficient clips and false match never imply a passed benchmark",()=>{
 const manifest={schema:"boi-ech-local-groundtruth/v1",clips:[clip(1,{unlabeled:true})]};
 const x=evaluateLocalVideoCorpus(manifest,{minClips:5,minPerPhase:20});
 assert.equal(x.evidenceStatus,"INSUFFICIENT_DATA");
 assert.ok(phases.every(p=>x.phases[p].f1===null));
 assert.equal(x.independentHumanValidation,"NOT_VERIFIED");
});
test("V47 rejects leaked personal data or video paths in corpus",()=>{
 for(const leaked of [{name:"Nguyễn Văn A"},{mediaUrl:"https://example.org/private.mp4"},{phone:"09012345678"}]){
  const x={...clip(1),...leaked};
  assert.throws(()=>evaluateLocalVideoCorpus({schema:"boi-ech-local-groundtruth/v1",clips:[x]}),/unexpected field/);
 }
});
test("V47 rejects clock disorder, unmatched or invalid labels, duplicate source IDs",()=>{
 const good=clip(1);
 for(const changed of [
  {...good,labelsByTime:{"99.000":"pull"}},
  {...good,frames:[good.frames[1],good.frames[0]]},
  {...good,labelsByTime:{"0.000":"unknown"}}
 ])assert.throws(()=>evaluateLocalVideoCorpus({schema:"boi-ech-local-groundtruth/v1",clips:[changed]}));
 assert.throws(()=>evaluateLocalVideoCorpus({schema:"boi-ech-local-groundtruth/v1",clips:[good,good]}),/repeated clip ID/);
});
