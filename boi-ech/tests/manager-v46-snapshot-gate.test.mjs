import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const path=new URL("../app/manager-ai-snapshot-v46.ts",import.meta.url);
const source=readFileSync(path,"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const holder={exports:{}};
new Function("module","exports",compiled)(holder,holder.exports);
const {assessManagerAiSnapshot}=holder.exports;
const now=Date.parse("2026-11-17T19:35:00.000Z");
const shot=(ago,partial=false)=>({
 observedAt:new Date(now-ago).toISOString(),sourceMayBeTruncated:partial
});

test("V46 manager AI accepts only fresh, full source snapshots (review only)",()=>{
 const fresh=assessManagerAiSnapshot(shot(120000),now);
 assert.equal(fresh.status,"fresh");
 assert.equal(fresh.canDecide,true);
 assert.equal(fresh.ageSeconds,120);
 const boundary=assessManagerAiSnapshot(shot(300000),now);
 assert.equal(boundary.status,"fresh");
 assert.equal(boundary.canDecide,true);
 const stale=assessManagerAiSnapshot(shot(300001),now);
 assert.equal(stale.status,"stale");
 assert.equal(stale.canDecide,false);
 assert.match(stale.message,/5 phút/);
});

test("V46 rejects truncated roster even when recently refreshed",()=>{
 const partial=assessManagerAiSnapshot(shot(1000,true),now);
 assert.equal(partial.status,"partial");
 assert.equal(partial.canDecide,false);
 assert.match(partial.message,/giới hạn/);
});

test("V46 rejects invalid, untrusted, future or unverified timestamps",()=>{
 const invalid=[
  {observedAt:"",sourceMayBeTruncated:false},
  {observedAt:"2026-02-30T00:00:00.000Z",sourceMayBeTruncated:false},
  {observedAt:"2026-11-17",sourceMayBeTruncated:false},
  {observedAt:"Tue Nov 17 2026",sourceMayBeTruncated:false},
  {observedAt:"2026-11-17T19:00:00+00:00",sourceMayBeTruncated:false}
 ];
 for(const value of invalid){
  const result=assessManagerAiSnapshot(value,now);
  assert.equal(result.status,"invalid",value.observedAt);
  assert.equal(result.canDecide,false);
 }
 assert.equal(assessManagerAiSnapshot(shot(-29000),now).status,"fresh");
 assert.equal(assessManagerAiSnapshot(shot(-31000),now).status,"future");
 assert.equal(assessManagerAiSnapshot(shot(0),NaN).canDecide,false);
 assert.equal(assessManagerAiSnapshot(shot(0),now,-1).canDecide,false);
});

test("V46 source guard is pure and cannot mutate D1 or call an AI provider",()=>{
 assert.doesNotMatch(source,/fetch\s*\(|db\.prepare|\.batch\s*\(|\.run\s*\(|process\.env|Date\.now\s*\(/);
 const frozen=Object.freeze(shot(10000));
 const before=JSON.stringify(frozen);
 assert.equal(assessManagerAiSnapshot(frozen,now).canDecide,true);
 assert.equal(JSON.stringify(frozen),before);
});
