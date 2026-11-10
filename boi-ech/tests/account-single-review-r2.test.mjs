import test from "node:test";
import assert from "node:assert/strict";
import {accountStack} from "./helpers/account-stack.mjs";

const owner={role:"owner",actor:"owner@fixture.invalid"};
const profile=n=>({familyName:"Synthetic",givenName:"Profile",personCode:"R2PROFILE"+n,
  className:"Training class",phone:"090"+String(n).padStart(7,"0")});
async function approvedManager(f,n){
 const m=await f.register(n,"manager");
 const result=await f.flow.firstReview({kind:"owner",actor:owner.actor},m.account.accountId,1);
 assert.equal(result.stage,"profile_required");
 return m;
}
test("R2: manager gets ONE Owner approval, completes required profile and atomically activates scoped account",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const manager=await approvedManager(f,9201);
  const id=manager.account.accountId;
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?").get(id).n,0);
  await assert.rejects(()=>f.service.ownerCommand(owner,{
    accountId:id,operation:"approve-manager",expectedRevision:0
  }),e=>e.code==="ACCOUNT_REVIEW_SUPERSEDED"&&e.status===409);
  const result=await f.flow.submitProfile(manager.token,{...profile(9201),expectedRevision:2});
  assert.equal(result.stage,"active");
  assert.equal(result.status,"approved");
  const row=await f.service.ownerRead(id);
  assert.equal(row.entitlement?.active,true);
  assert.equal(row.entitlement?.state,"active");
  assert.ok(Math.abs(Date.parse(row.entitlement.expiresAt)-Date.now()-30*86400000)<120000);
  const grants=f.sqlite.prepare("SELECT scope,enabled FROM account_manager_permissions WHERE account_id=?").all(id);
  assert.equal(grants.length,2);
  assert.ok(grants.every(g=>g.enabled===1));
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit WHERE target=? AND action='account.profile.activated'").get(id).n,1);
  await assert.rejects(()=>f.flow.submitProfile(manager.token,{...profile(9201),expectedRevision:2}),
    e=>e.code==="ACCOUNT_CAS_CONFLICT");
 }finally{f.close()}
});
test("R2: learner waits for ONE authorized manager, then profile completion creates assignment+entitlement",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const manager=await approvedManager(f,9211);
  await f.flow.submitProfile(manager.token,{...profile(9211),expectedRevision:2});
  const learner=await f.register(9212,"learner");
  const id=learner.account.accountId;
  await assert.rejects(()=>f.flow.submitProfile(learner.token,{...profile(9212),expectedRevision:1}),
    e=>e.code==="ACCOUNT_CAS_CONFLICT");
  const state=await f.flow.firstReview({kind:"manager",token:manager.token},id,1);
  assert.equal(state.stage,"profile_required");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?").get(id).n,0);
  const completed=await f.flow.submitProfile(learner.token,{...profile(9212),expectedRevision:2});
  assert.equal(completed.stage,"active");
  assert.equal(completed.status,"approved");
  const assignment=f.sqlite.prepare("SELECT manager_device_id,person_role FROM manager_device_assignments WHERE target_device_id=?")
    .get(learner.account.storageDeviceId);
  assert.equal(assignment.manager_device_id,manager.account.storageDeviceId);
  assert.equal(assignment.person_role,"learner");
  const ent=await f.service.ownerRead(id);
  assert.equal(ent.entitlement.active,true);
  await assert.rejects(()=>f.service.review(manager.token,id,"approve"),
    e=>e.code==="ACCOUNT_REVIEW_SUPERSEDED"&&e.status===409);
 }finally{f.close()}
});
test("R2: incomplete profile and stale CAS never create an ACTIVE seat",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const manager=await approvedManager(f,9221);
  const id=manager.account.accountId;
  await assert.rejects(()=>f.flow.submitProfile(manager.token,{
    ...profile(9221),familyName:"",expectedRevision:2}),e=>e.code==="PROFILE_INVALID"&&e.status===400);
  await assert.rejects(()=>f.flow.submitProfile(manager.token,{
    ...profile(9221),expectedRevision:1}),e=>e.code==="ACCOUNT_CAS_CONFLICT"&&e.status===409);
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?").get(id).stage,"profile_required");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?").get(id).n,0);
  assert.equal(f.sqlite.prepare("SELECT status FROM device_access WHERE device_id=?").get(manager.account.storageDeviceId).status,"pending");
 }finally{f.close()}
});
test("R2: revoked manager entitlement blocks learner activation and rolls back ALL profile writes",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const manager=await approvedManager(f,9231);
  await f.flow.submitProfile(manager.token,{...profile(9231),expectedRevision:2});
  const learner=await f.register(9232,"learner");
  const id=learner.account.accountId;
  await f.flow.firstReview({kind:"manager",token:manager.token},id,1);
  f.sqlite.prepare("UPDATE account_entitlements SET state='suspended' WHERE account_id=?")
    .run(manager.account.accountId);
  await assert.rejects(()=>f.flow.submitProfile(learner.token,{...profile(9232),expectedRevision:2}),
    e=>e.code==="ACCOUNT_SCOPE_FORBIDDEN"&&e.status===403);
  const d=f.sqlite.prepare("SELECT status,person_code FROM device_access WHERE device_id=?")
    .get(learner.account.storageDeviceId);
  assert.equal(d.status,"pending");
  assert.equal(d.person_code,null);
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?").get(id).stage,"profile_required");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM manager_device_assignments WHERE target_device_id=?").get(learner.account.storageDeviceId).n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?").get(id).n,0);
 }finally{f.close()}
});
test("R2: manager cannot change another manager's application; single-review flag defaults safely OFF",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 const legacy=accountStack({v2:true});
 try{
  const manager=await f.register(9241,"manager");
  await assert.rejects(()=>f.flow.firstReview({kind:"manager",token:manager.token},manager.account.accountId,1),
    e=>["ACCOUNT_ONBOARDING_REQUIRED","ACCOUNT_PENDING"].includes(e.code));
  assert.equal(legacy.flow?.singleReview,false);
  assert.equal(f.flow?.singleReview,true);
 }finally{f.close();legacy.close()}
});
