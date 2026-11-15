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
 assert.match(result.note,/chưa thể xác thực môi trường nước/i);
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
 assert.match(source,/swimConfirmed/);
 assert.match(source,/setContentEvidence\(contentGate\)/);
 assert.match(source,/Video gốc không rời thiết bị/);
});
