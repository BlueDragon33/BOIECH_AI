import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import ts from "typescript";
const code=readFileSync(resolve("app/manager-ai-proposal-state-v43.ts"),"utf8");
const output=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};new Function("module","exports",output)(m,m.exports);
const {transitionProposal}=m.exports;
const base={id:"teacher:class:person",kind:"teacher",personId:"t1",classId:"cl1",
 sourceFingerprint:"sha256:revision:123",observedAt:"2030-06-06T09:00:00Z",createdAt:"2030-06-06T09:00:00Z",
 revision:1,status:"suggested",lastCommand:null,audit:[]};
const actor={deviceId:"manager1",role:"manager",authorized:true};
const step=(record,action,more={})=>transitionProposal({record,action,actor,expectedRevision:record.revision,
 currentSourceFingerprint:record.sourceFingerprint,commandId:"command_00001",at:"2030-06-06T10:00:00Z",reason:"Đã kiểm tra hồ sơ và lịch thực tế.",...more});
test("proposal lifecycle demands human review, then approve, and never auto-applies",()=>{
 assert.equal(step(base,"approve").ok,false);
 const reviewed=step(base,"review");
 assert.equal(reviewed.ok,true);assert.equal(reviewed.record.status,"reviewed");
 const approved=step(reviewed.record,"approve",{commandId:"command_00002"});
 assert.equal(approved.ok,true);assert.equal(approved.record.status,"approved");
 assert.deepEqual(approved.record.audit.map(x=>x.action),["review","approve"]);
 assert.equal(step(approved.record,"approve",{commandId:"command_00003"}).ok,false);
 assert.equal(code.includes("applied"),true,"only commentary mentions applied; no runtime apply function");
 assert.doesNotMatch(code,/\bfetch\(|\.prepare\(|\bdb\.batch\(/);
});
test("blocked actor, stale fingerprint, conflicting revision and invalid request are fail-closed",()=>{
 assert.equal(step(base,"review",{actor:{deviceId:"x",role:"learner",authorized:true}}).code,"DENIED");
 assert.equal(step(base,"review",{actor:{deviceId:"x",role:"manager",authorized:false}}).code,"DENIED");
 assert.equal(step(base,"review",{expectedRevision:2}).code,"CONFLICT");
 assert.equal(step(base,"review",{currentSourceFingerprint:"other"}).code,"STALE");
 assert.equal(step(base,"review",{reason:""}).code,"INVALID");
 assert.equal(step(base,"review",{commandId:"bad"}).code,"INVALID");
});
test("repeated command is idempotent but the same ID with different intent is rejected",()=>{
 const first=step(base,"review");
 assert.equal(first.ok,true);
 const replay=step(first.record,"review");
 assert.equal(replay.code,"REPLAY");
 assert.equal(replay.record.audit.length,1);
 const conflict=step(first.record,"approve");
 assert.equal(conflict.code,"CONFLICT");
});
test("rejection terminates proposal with auditable reason",()=>{
 const response=step(base,"reject");
 assert.equal(response.record.status,"rejected");
 assert.equal(response.record.audit[0].reason,"Đã kiểm tra hồ sơ và lịch thực tế.");
 assert.equal(step(response.record,"review",{commandId:"command_00002"}).ok,false);
});
