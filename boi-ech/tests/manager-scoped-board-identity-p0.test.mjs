import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { accountStack } from "./helpers/account-stack.mjs";

// Execute the actual trainingBoard TS function against local D1 SQLite while
// stubbing only the already-authenticated session principal.
function loadTraining(f,principal){
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
 return mod.exports;
}
const loadBoard=(f,principal)=>loadTraining(f,principal).trainingBoard;
const owner={kind:"owner",actor:"owner@fixture.invalid"};
const profile=n=>({familyName:"Assigned",givenName:"Person",personCode:"SCOPED"+n,className:"Private class",phone:"090"+String(n).padStart(7,"0"),expectedRevision:2});
async function manager(f,n){
 const m=await f.register(n,"manager");
 await f.flow.firstReview(owner,m.account.accountId,1);
 await f.flow.submitProfile(m.token,{familyName:"Assigned",givenName:"Manager",
  facultyUnit:"QA unit",jobTitle:"Trainer",jobPosition:"Coordinator",expectedRevision:2});
 return m;
}
async function learner(f,n,manager,role="learner"){
 const l=await f.register(n,role);
 await f.flow.firstReview({kind:"manager",token:manager.token},l.account.accountId,1);
 await f.flow.submitProfile(l.token,profile(n));
 return l;
}
const actor=m=>({accountId:m.account.accountId,deviceId:m.account.storageDeviceId,deviceCode:"BE-0000-AAAA-BBBB-CCCC",personRole:"manager",managementEnabled:true});
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

test("editing a session requires scope over its stored teacher as well as the proposed teacher",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const a=await manager(f,9521),b=await manager(f,9522);
  const mine=await learner(f,9523,a,"teacher"),theirs=await learner(f,9524,b,"teacher");
  f.sqlite.exec(`INSERT INTO training_resources(id,kind,name,capacity,status,version) VALUES
    ('test-building','building','Test building',1,'active',1),('test-class','class','Private class',20,'active',1);
    INSERT INTO training_resources(id,kind,name,parent_id,capacity,status,version)
    VALUES('test-room','room','Test room','test-building',20,'active',1);`);
  f.sqlite.prepare(`INSERT INTO training_sessions(id,title,class_id,room_id,teacher_id,starts_at,ends_at,status,version)
    VALUES('test-session','Original','test-class','test-room',?,?,?,'scheduled',1)`)
   .run(theirs.account.storageDeviceId,windowFrom,windowTo);
  const principal=await f.service.authorize(a.token);
  const write=loadTraining(f,principal).trainingCommand;
  const input={action:"save-session",id:"test-session",commandId:"edit-scope-test",title:"Updated",
   classId:"test-class",roomId:"test-room",teacherId:mine.account.storageDeviceId,
   startsAt:windowFrom,endsAt:windowTo,status:"scheduled",expectedVersion:1};
  await assert.rejects(()=>write(actor(a),input),error=>error.status===409);
  const read=()=>f.sqlite.prepare("SELECT title,teacher_id,version FROM training_sessions WHERE id='test-session'").get();
  assert.equal(read().teacher_id,theirs.account.storageDeviceId);assert.equal(read().version,1);
  f.sqlite.prepare("UPDATE training_sessions SET teacher_id=? WHERE id='test-session'").run(mine.account.storageDeviceId);
  await write(actor(a),{...input,commandId:"edit-scope-valid"});
  assert.equal(read().title,"Updated");assert.equal(read().version,2);
 }finally{f.close();}
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
