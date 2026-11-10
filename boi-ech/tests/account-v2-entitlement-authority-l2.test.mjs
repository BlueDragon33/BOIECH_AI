import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {accountStack} from "./helpers/account-stack.mjs";

const owner={role:"owner",actor:"owner@fixture.invalid"};
const profile=n=>({familyName:"Synthetic",givenName:"Tester",personCode:"ENTITLE"+n,
 className:"Lab class",phone:"090"+String(n).padStart(7,"0")});
async function createActiveManager(f,n=801) {
 const manager=await f.register(n,"manager");
 await f.flow.firstReview({kind:"owner",actor:owner.actor},manager.account.accountId,1);
 await f.flow.submitProfile(manager.token,{...profile(n),expectedRevision:2});
 await f.service.ownerCommand(owner,{accountId:manager.account.accountId,
   operation:"approve-manager",expectedRevision:0});
 return manager;
}
test("V2 account entitlement overrules expired legacy device expiry for real manager and learner approval",async()=>{
 const f=accountStack({v2:true});
 try {
  const manager=await createActiveManager(f);
  const before=await f.service.ownerRead(manager.account.accountId);
  assert.equal(before.entitlement?.active,true);
  const legacy="2001-01-01T00:00:00.000Z";
  f.sqlite.prepare("UPDATE device_access SET access_expires_at=? WHERE device_id=?")
   .run(legacy,manager.account.storageDeviceId);
  const actor=await f.service.authorize(manager.token);
  assert.equal(actor.status,"approved");
  await f.service.capability(await f.service.session(manager.token),"manager.approve.registration");
  const now=await f.service.ownerRead(manager.account.accountId);
  assert.equal(now.permissions.find(p=>p.scope==="manager.approve.registration")?.effective,true);
  const learner=await f.register(802,"learner");
  await f.flow.firstReview({kind:"manager",token:manager.token},learner.account.accountId,1);
  await f.flow.submitProfile(learner.token,{...profile(802),expectedRevision:2});
  const accepted=await f.service.review(manager.token,learner.account.accountId,"approve");
  assert.equal(accepted.status,"approved");
  f.setCookie(manager.token);
  const response=await f.get("api/accounts/route.ts");
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.account.accountId,manager.account.accountId);
  assert.equal(data.account.entitlementActive,true);
  assert.equal(data.account.expiresAt,before.entitlement.expiresAt);
  assert.notEqual(data.account.expiresAt,legacy);
  assert.equal(data.account.onboardingStage,"active");
 }finally{f.close()}
});
test("V2 SQL trigger rejects suspended and expired manager entitlements even with valid legacy expiry",async()=>{
 const f=accountStack({v2:true});
 try {
  const manager=await createActiveManager(f,851);
  const learner=await f.register(852,"learner");
  await f.flow.firstReview({kind:"manager",token:manager.token},learner.account.accountId,1);
  await f.flow.submitProfile(learner.token,{...profile(852),expectedRevision:2});
  const sql="INSERT INTO manager_device_assignments(target_device_id,manager_device_id,person_role) VALUES (?,?,?)";
  const params=[learner.account.storageDeviceId,manager.account.storageDeviceId,"learner"];
  f.sqlite.prepare("UPDATE device_access SET access_expires_at='2099-01-01T00:00:00.000Z' WHERE device_id=?")
    .run(manager.account.storageDeviceId);
  f.sqlite.prepare("UPDATE account_entitlements SET state='suspended' WHERE account_id=?")
    .run(manager.account.accountId);
  assert.throws(()=>f.sqlite.prepare(sql).run(...params),/MANAGER_APPROVAL_FORBIDDEN/);
  f.sqlite.prepare("UPDATE account_entitlements SET state='active',expires_at='2000-01-01T00:00:00.000Z' WHERE account_id=?")
    .run(manager.account.accountId);
  assert.throws(()=>f.sqlite.prepare(sql).run(...params),/MANAGER_APPROVAL_FORBIDDEN/);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS total FROM manager_device_assignments WHERE target_device_id=?")
    .get(learner.account.storageDeviceId).total,0);
 }finally{f.close()}
});
test("V2 SQL assignment is denied if the learner is awaiting changes, not yet in second-review stage",async()=>{
 const f=accountStack({v2:true});
 try {
  const manager=await createActiveManager(f,871);
  const learner=await f.register(872,"learner");
  await f.flow.firstReview({kind:"manager",token:manager.token},learner.account.accountId,1);
  await f.flow.submitProfile(learner.token,{...profile(872),expectedRevision:2});
  await f.flow.requestChanges({kind:"manager",token:manager.token},
    learner.account.accountId,3,"Synthetic correction requested");
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?")
    .get(learner.account.accountId).stage,"changes_requested");
  // The old 0025 CASE fell back to legacy manager device expiry when
  // target stage was not profile_review, despite V2 manager entitlement.
  const sql="INSERT INTO manager_device_assignments(target_device_id,manager_device_id,person_role) VALUES(?,?,?)";
  assert.throws(()=>f.sqlite.prepare(sql).run(
    learner.account.storageDeviceId,manager.account.storageDeviceId,"learner"),
    /MANAGER_APPROVAL_FORBIDDEN/);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM manager_device_assignments WHERE target_device_id=?")
    .get(learner.account.storageDeviceId).n,0);
 } finally {f.close()}
});
test("V2 SQL assignment refuses a different manager from the recorded first reviewer",async()=>{
 const f=accountStack({v2:true});
 try {
  const assigned=await createActiveManager(f,881);
  const unrelated=await createActiveManager(f,882);
  const learner=await f.register(883,"learner");
  await f.flow.firstReview({kind:"manager",token:assigned.token},learner.account.accountId,1);
  await f.flow.submitProfile(learner.token,{...profile(883),expectedRevision:2});
  const sql="INSERT INTO manager_device_assignments(target_device_id,manager_device_id,person_role) VALUES(?,?,?)";
  assert.throws(()=>f.sqlite.prepare(sql).run(
    learner.account.storageDeviceId,unrelated.account.storageDeviceId,"learner"),
    /MANAGER_APPROVAL_FORBIDDEN/);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM manager_device_assignments WHERE target_device_id=?")
    .get(learner.account.storageDeviceId).n,0);
  const approved=await f.service.review(assigned.token,learner.account.accountId,"approve");
  assert.equal(approved.status,"approved");
 } finally {f.close()}
});
test("V2 new trigger preserves V1 legacy expiry guard for non-V2 staged intake",async()=>{
 const f=accountStack({v2:false});
 try{
  // V1 approvalExpiry needs an explicit legacy global policy in this fixture;
  // accountStack only seeds it automatically in V2 mode.
  f.sqlite.prepare("INSERT OR IGNORE INTO access_automation_settings(id,default_access_days) VALUES('global',90)").run();
  const manager=await f.register(861,"manager");
  await f.service.ownerCommand(owner,{
    accountId:manager.account.accountId,operation:"approve-manager",expectedRevision:0
  });
  const learner=await f.register(862,"learner");
  const sql="INSERT INTO manager_device_assignments(target_device_id,manager_device_id,person_role) VALUES(?,?,?)";
  const params=[learner.account.storageDeviceId,manager.account.storageDeviceId,"learner"];
  f.sqlite.prepare("UPDATE device_access SET access_expires_at='2000-01-01T00:00:00.000Z' WHERE device_id=?")
    .run(manager.account.storageDeviceId);
  assert.throws(()=>f.sqlite.prepare(sql).run(...params),/MANAGER_APPROVAL_FORBIDDEN/);
  f.sqlite.prepare("UPDATE device_access SET access_expires_at='2099-01-01T00:00:00.000Z' WHERE device_id=?")
    .run(manager.account.storageDeviceId);
  f.sqlite.prepare(sql).run(...params);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS total FROM manager_device_assignments WHERE target_device_id=?")
    .get(learner.account.storageDeviceId).total,1);
 }finally{f.close()}
});
test("V2 suspended/expired entitlements fail closed even if legacy device expiry remains valid",async()=>{
 const f=accountStack({v2:true});
 try{
  const manager=await createActiveManager(f,811);
  const id=manager.account.accountId;
  f.setCookie(manager.token);
  f.sqlite.prepare("UPDATE device_access SET access_expires_at=? WHERE device_id=?")
    .run("2099-01-01T00:00:00.000Z",manager.account.storageDeviceId);
  f.sqlite.prepare("UPDATE account_entitlements SET state='suspended' WHERE account_id=?").run(id);
  await assert.rejects(()=>f.service.authorize(manager.token),e=>e.code==="ACCOUNT_SUSPENDED");
  await assert.rejects(async()=>f.service.capability(await f.service.session(manager.token),"manager.approve.registration"),
    e=>e.code==="ACCOUNT_SUSPENDED");
  const suspended=await (await f.get("api/accounts/route.ts")).json();
  assert.equal(suspended.account.entitlementActive,false);
  assert.equal(suspended.account.canReadRegistrants,false);
  f.sqlite.prepare("UPDATE account_entitlements SET state='active',expires_at=? WHERE account_id=?")
   .run("2000-01-01T00:00:00.000Z",id);
  await assert.rejects(()=>f.service.authorize(manager.token),e=>e.code==="ACCOUNT_EXPIRED");
  const expired=await (await f.get("api/accounts/route.ts")).json();
  assert.equal(expired.account.entitlementActive,false);
  assert.equal(expired.account.expiresAt,"2000-01-01T00:00:00.000Z");
 }finally{f.close()}
});
test("Owner may manage role on V2 account with active entitlement even if legacy device expiry ended",async()=>{
 const f=accountStack({v2:true});
 try {
  const manager=await createActiveManager(f,821);
  const id=manager.account.accountId;
  f.sqlite.prepare("UPDATE device_access SET access_expires_at='2001-01-01T00:00:00.000Z' WHERE device_id=?")
   .run(manager.account.storageDeviceId);
  const before=await f.service.ownerRead(id);
  const updated=await f.service.ownerCommand(owner,{accountId:id,operation:"management",
    enabled:true,expectedRevision:before.revision});
  assert.equal(updated.revision,before.revision+1);
  assert.equal(updated.permissions.find(p=>p.scope==="manager.approve.registration")?.effective,true);
  f.sqlite.prepare("UPDATE account_entitlements SET state='suspended' WHERE account_id=?").run(id);
  await assert.rejects(()=>f.service.ownerCommand(owner,{accountId:id,operation:"management",
    enabled:true,expectedRevision:updated.revision}),e=>e.code==="ACCOUNT_SUSPENDED");
 }finally{f.close()}
});
test("UI shell requires V2 account entitlement and V1 legacy expiry path remains available",()=>{
 const gate=readFileSync(new URL("../app/account-gate.tsx",import.meta.url),"utf8");
 const api=readFileSync(new URL("../app/api/accounts/route.ts",import.meta.url),"utf8");
 const core=readFileSync(new URL("../app/account-core.server.ts",import.meta.url),"utf8");
 assert.match(gate,/account\.entitlementActive===true/);
 assert.match(gate,/Thời hạn tài khoản đã hết/);
 assert.match(api,/entitlementActive: config\.v2 \? entitlement\?\.active === true : undefined/);
 assert.match(api,/expiresAt: config\.v2 \? \(account\.deviceApproved \? entitlement\?\.expiresAt/);
 assert.match(core,/if \(!this\.v2Enabled && actor\.expiresAt/);
 assert.match(core,/datetime\(e\.expires_at\)>CURRENT_TIMESTAMP/);
});
