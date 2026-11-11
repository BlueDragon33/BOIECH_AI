import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { accountStack } from "./helpers/account-stack.mjs";

// Execute the actual trainingBoard TS function against local D1 SQLite while
// stubbing only the already-authenticated session principal.
function loadBoard(f,principal){
 const mod={exports:{}};
 const src=readFileSync(new URL("../app/training-management.server.ts",import.meta.url),"utf8");
 const out=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const stubs={
  "./device-auth.server":{getCourseDatabase:async()=>f.db,DeviceAccessError:class extends Error{constructor(message,status,code){super(message);this.status=status;this.code=code;}}},
  "./training-schema":{TRAINING_SCHEMA:[]},
  "./training-types":{classKey:s=>String(s??"").trim().toLowerCase(),classNames:s=>String(s??"").split(";").map(z=>z.trim()).filter(Boolean)},
  "./account-runtime.server":{
    accountService:async()=>({authorize:async()=>principal,capability:async()=>true}),
    accountCookieToken:async()=> "signed-session-cookie"
  }
 };
 new Function("require","module","exports",out)(name=>{
  assert.ok(name in stubs,"unexpected module "+name);
  return stubs[name];
 },mod,mod.exports);
 return mod.exports.trainingBoard;
}
const owner={kind:"owner",actor:"owner@fixture.invalid"};
const profile=n=>({familyName:"Assigned",givenName:"Person",personCode:"SCOPED"+n,className:"Private class",phone:"090"+String(n).padStart(7,"0"),expectedRevision:2});
async function manager(f,n){
 const m=await f.register(n,"manager");
 await f.flow.firstReview(owner,m.account.accountId,1);
 await f.flow.submitProfile(m.token,{familyName:"Assigned",givenName:"Manager",
  facultyUnit:"QA unit",jobTitle:"Trainer",jobPosition:"Coordinator",expectedRevision:2});
 return m;
}
async function learner(f,n,manager){
 const l=await f.register(n,"learner");
 await f.flow.firstReview({kind:"manager",token:manager.token},l.account.accountId,1);
 await f.flow.submitProfile(l.token,profile(n));
 return l;
}
const actor=m=>({accountId:m.account.accountId,deviceId:m.account.storageDeviceId,personRole:"manager",managementEnabled:true});
const windowFrom="2030-01-01T09:00:00Z",windowTo="2030-01-01T10:00:00Z";

test("P0 manager scope: a cookie from manager B cannot authorize signed manager A roster",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const a=await manager(f,9501), b=await manager(f,9502),target=await learner(f,9503,a);
  const board=loadBoard(f,{accountId:b.account.accountId,role:"manager",deviceApproved:true});
  await assert.rejects(()=>board(windowFrom,windowTo,actor(a)),e=>e.status===403&&e.code==="MANAGER_ACCOUNT_MISMATCH");
  // The scoped roster exists, so a successful mismatched response would expose it.
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM manager_device_assignments WHERE manager_device_id=? AND target_device_id=?")
    .get(a.account.storageDeviceId,target.account.storageDeviceId).count,1);
 }finally{f.close()}
});
test("P0 manager scope: canonical account maps a linked device to assigned staff and scopes aggregate summaries",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const a=await manager(f,9511),b=await manager(f,9512),mine=await learner(f,9513,a),theirs=await learner(f,9514,b);
  const read=loadBoard(f,{accountId:a.account.accountId,role:"manager",deviceApproved:true});
  const linkedActor={...actor(a),deviceId:"synthetic-approved-linked-device"};
  const board=await read(windowFrom,windowTo,linkedActor);
  assert.deepEqual(board.people.map(p=>p.id),[mine.account.storageDeviceId]);
  assert.ok(!board.people.some(p=>p.id===theirs.account.storageDeviceId));
  assert.equal(board.summary.unassignedLearners,1,"summary must never count other managers' staff");
 }finally{f.close()}
});
test("P0 manager scope: V1 training actor remains on legacy path without account session binding",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const read=loadBoard(f,null);
  const board=await read(windowFrom,windowTo,{deviceId:"legacy-device",personRole:"manager",managementEnabled:true});
  assert.ok(Array.isArray(board.people));
 }finally{f.close()}
});
