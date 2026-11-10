import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {accountStack} from "./helpers/account-stack.mjs";

const owner={role:"owner",actor:"owner@fixture.invalid"};
const profile={familyName:"Nguyen Dinh",givenName:"Nam",facultyUnit:"Technology Department",
 jobTitle:"Instructor",jobPosition:"Unit manager"};
const stage=async(f,seed=8801)=>{
 const m=await f.register(seed,"manager");
 const reviewed=await f.flow.firstReview({kind:"owner",actor:owner.actor},m.account.accountId,1);
 assert.equal(reviewed.stage,"profile_required");
 return m;
};
test("R4: manager completes five professional fields WITHOUT person code or repeated phone",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const m=await stage(f),id=m.account.accountId;
  const result=await f.flow.submitProfile(m.token,{...profile,expectedRevision:2});
  assert.equal(result.stage,"active");
  const row=f.sqlite.prepare("SELECT faculty_unit,job_title,job_position FROM account_manager_profiles WHERE account_id=?").get(id);
  assert.equal(row.faculty_unit,"Technology Department");
  assert.equal(row.job_title,"Instructor");
  assert.equal(row.job_position,"Unit manager");
  const device=f.sqlite.prepare("SELECT person_code,phone,learner_name FROM device_access WHERE device_id=?").get(m.account.storageDeviceId);
  assert.match(device.person_code,/^MGR_[A-F0-9]{20}$/);
  assert.equal(device.phone,"");
  assert.equal(device.learner_name,"Nguyen Dinh Nam");
  assert.equal((await f.service.ownerRead(id)).entitlement.active,true);
 }finally{f.close();}
});
test("R4: missing manager professional fields cannot activate or grant entitlement",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const m=await stage(f,8802),id=m.account.accountId;
  for(const field of ["facultyUnit","jobTitle","jobPosition"]){
   const invalid={...profile,expectedRevision:2};delete invalid[field];
   await assert.rejects(()=>f.flow.submitProfile(m.token,invalid),e=>e.code==="PROFILE_INVALID");
  }
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?").get(id).stage,"profile_required");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_manager_profiles WHERE account_id=?").get(id).n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?").get(id).n,0);
 }finally{f.close();}
});
test("R4: local Owner cancellation deletes ONLY a pending manager by exact ID and CAS, retains audit",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const m=await stage(f,8803),id=m.account.accountId;
  const cancel=f.load("manager-local-reset.server.ts").cancelLocalPendingManager;
  await assert.rejects(()=>cancel(f.db,{role:"manager",actor:"manager"},id,2,id),e=>e.code==="OWNER_REQUIRED");
  await assert.rejects(()=>cancel(f.db,owner,id,2,"wrong"),e=>e.code==="ACCOUNT_INPUT");
  await assert.rejects(()=>cancel(f.db,owner,id,1,id),e=>e.code==="ACCOUNT_RESET_NOT_ELIGIBLE");
  const observedDb={...f.db,batch:async statements=>{
   try{return await f.db.batch(statements);}catch(e){
    console.error("R4_LOCAL_SQLITE_ROOT_CAUSE:",e instanceof Error?e.message:String(e));
    throw e;
   }
  }};
  const result=await cancel(observedDb,owner,id,2,id);
  assert.equal(result.verified,true);assert.equal(result.deletedAccountId,id);
  for(const table of ["accounts","account_devices","account_credentials","account_onboarding","account_sessions","account_contacts"]){
   const count=f.sqlite.prepare("SELECT COUNT(*) AS n FROM "+table+" WHERE account_id=?").get(id).n;
   assert.equal(count,0,table);
  }
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM device_access WHERE device_id=?").get(m.account.storageDeviceId).n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit WHERE action='owner.manager-intake.delete-verified' AND target=?").get(id).n,1);
  const again=await f.register(8803,"manager");
  assert.notEqual(again.account.accountId,id,"login was released for a new account");
 }finally{f.close();}
});
test("R4: active manager, learner and wrong CAS cannot be removed by pending-local cancellation",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const cancel=f.load("manager-local-reset.server.ts").cancelLocalPendingManager;
  const m=await stage(f,8804),id=m.account.accountId;
  await f.flow.submitProfile(m.token,{...profile,expectedRevision:2});
  await assert.rejects(()=>cancel(f.db,owner,id,4,id),e=>e.code==="ACCOUNT_RESET_NOT_ELIGIBLE");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM accounts WHERE account_id=?").get(id).n,1);
  const learner=await f.register(8805,"learner");
  await assert.rejects(()=>cancel(f.db,owner,learner.account.accountId,1,learner.account.accountId),
   e=>e.code==="ACCOUNT_RESET_NOT_ELIGIBLE");
 }finally{f.close();}
});
test("R4: UI never asks manager for personal code, and reset cannot run outside loopback",()=>{
 const gate=readFileSync(new URL("../app/account-gate.tsx",import.meta.url),"utf8");
 const api=readFileSync(new URL("../app/api/control/accounts/route.ts",import.meta.url),"utf8");
 const core=readFileSync(new URL("../app/manager-local-reset.server.ts",import.meta.url),"utf8");
 assert.match(gate,/account.role==="manager"/);
 for(const name of ["facultyUnit","jobTitle","jobPosition"])assert.match(gate,new RegExp(name));
 assert.match(api,/LOCAL_CONTROL_PLANE!=="true"/);
 assert.match(api,/config.origin!==url.origin/);
 assert.match(core,/ACCOUNT_RESET_NOT_ELIGIBLE/);
 assert.match(core,/owner.manager-intake.delete-verified/);
 assert.doesNotMatch(core,/PRAGMA foreign_keys=OFF|DROP TABLE|TRUNCATE/);
});
