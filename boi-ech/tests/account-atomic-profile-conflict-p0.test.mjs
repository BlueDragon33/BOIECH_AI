import test from "node:test";
import assert from "node:assert/strict";
import {accountStack} from "./helpers/account-stack.mjs";

async function pendingApprovedOwner(f,seed){
 const manager=await f.register(seed,"manager");
 await f.flow.firstReview({kind:"owner",actor:"owner@fixture.invalid"},manager.account.accountId,1);
 return manager;
}
const profile=seed=>({familyName:"Concurrency",givenName:"Guard",personCode:"P0"+seed,className:"QA class",phone:"090"+String(seed).padStart(7,"0"),expectedRevision:2});
function assertUnchanged(f,manager){
 const id=manager.account.accountId;
 const onboarding=f.sqlite.prepare("SELECT stage,revision FROM account_onboarding WHERE account_id=?").get(id);
 const d=f.sqlite.prepare("SELECT status,person_code,management_enabled FROM device_access WHERE device_id=?").get(manager.account.storageDeviceId);
 assert.equal(onboarding.stage,"profile_required","an exception MUST NOT commit ACTIVE before error");
 assert.equal(onboarding.revision,2);
 assert.equal(d.status,"pending");
 assert.equal(d.person_code,null);
 assert.equal(d.management_enabled,0);
 assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM account_entitlements WHERE account_id=?").get(id).count,0);
 assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM account_audit WHERE target=? AND action='account.profile.activated'").get(id).count,0);
}
test("P0 atomic D1: preexisting manager permission cannot yield 409 while account already ACTIVE",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const m=await pendingApprovedOwner(f,9401);
  const id=m.account.accountId;
  f.sqlite.prepare("INSERT INTO account_manager_permissions(account_id,scope,enabled,granted_by) VALUES(?,'manager.approve.registration',1,'anomalous-pregrant')").run(id);
  await assert.rejects(()=>f.flow.submitProfile(m.token,profile(9401)),e=>
    e.status===409, "anomalous pregrant must fail as a conflict");
  assertUnchanged(f,m);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM account_manager_permissions WHERE account_id=?").get(id).count,1);
 }finally{f.close()}
});
test("P0 atomic D1: preexisting active entitlement cannot be silently ignored then commit ACTIVE",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const m=await pendingApprovedOwner(f,9402);
  const id=m.account.accountId;
  f.sqlite.prepare("INSERT INTO account_entitlements(account_id,state,activated_at,expires_at,changed_by) VALUES(?,'active',?,?,?)").run(
    id,new Date().toISOString(),new Date(Date.now()+86400000).toISOString(),"anomalous-pregrant");
  await assert.rejects(()=>f.flow.submitProfile(m.token,profile(9402)),e=>e.status===409);
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?").get(id).stage,"profile_required");
  const d=f.sqlite.prepare("SELECT status,person_code FROM device_access WHERE device_id=?").get(m.account.storageDeviceId);
  assert.equal(d.status,"pending");
  assert.equal(d.person_code,null);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM account_audit WHERE target=? AND action='account.profile.activated'").get(id).count,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM account_manager_permissions WHERE account_id=?").get(id).count,0);
 }finally{f.close()}
});
