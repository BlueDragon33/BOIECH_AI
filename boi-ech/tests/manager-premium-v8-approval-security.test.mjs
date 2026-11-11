import test from "node:test";
import assert from "node:assert/strict";
import {accountStack} from "./helpers/account-stack.mjs";

const owner={kind:"owner",actor:"owner@fixture.invalid"};
const profile=n=>({
 familyName:"Quan ly",givenName:"V8",facultyUnit:"Trung tam huan luyen",
 jobTitle:"Giao vien",jobPosition:"Can bo quan ly",
 personCode:"V8"+n,className:"Lop "+n,phone:"090"+String(n).padStart(7,"0"),expectedRevision:2
});
async function activeManager(f,n){
 const m=await f.register(n,"manager");
 assert.equal((await f.flow.firstReview(owner,m.account.accountId,1)).stage,"profile_required");
 assert.equal((await f.flow.submitProfile(m.token,profile(n))).stage,"active");
 return m;
}
test("V8 real local D1: manager one-review appears in queue, CAS and activation grant 30-day entitlement",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const m=await activeManager(f,9910),l=await f.register(9911,"learner");
  const queued=await f.service.reviewBoard(m.token,"",50);
  assert.ok(queued.devices.some(d=>d.accountId===l.account.accountId&&d.onboardingStage==="requested"));
  const first=await f.flow.firstReview({kind:"manager",token:m.token},l.account.accountId,1);
  assert.equal(first.stage,"profile_required");
  assert.equal(first.revision,2);
  const reread=await f.service.reviewBoard(m.token,"",50);
  assert.ok(reread.devices.some(d=>d.accountId===l.account.accountId&&d.firstReviewMine===true&&d.onboardingStage==="profile_required"));
  await assert.rejects(()=>f.flow.firstReview({kind:"manager",token:m.token},l.account.accountId,1),e=>e.code==="ACCOUNT_CAS_CONFLICT"&&e.status===409);
  assert.equal((await f.flow.submitProfile(l.token,profile(9911))).stage,"active");
  const ent=await f.service.ownerRead(l.account.accountId);
  assert.equal(ent.entitlement.active,true);
  assert.ok(Math.abs(Date.parse(ent.entitlement.expiresAt)-Date.now()-30*86400000)<120000);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit WHERE target=? AND action='account.review.first'")
    .get(l.account.accountId).n,1);
 }finally{f.close()}
});
test("V8 backend RBAC: learner cannot review; manager cannot approve manager",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const m=await activeManager(f,9920),l=await f.register(9921,"learner");
  const another=await f.register(9922,"manager");
  await assert.rejects(()=>f.flow.firstReview({kind:"manager",token:l.token},another.account.accountId,1),
    e=>e.code==="TARGET_ROLE_FORBIDDEN"&&e.status===403);
  await assert.rejects(()=>f.flow.firstReview({kind:"manager",token:m.token},another.account.accountId,1),
    e=>e.code==="TARGET_ROLE_FORBIDDEN"&&e.status===403);
  await assert.rejects(()=>f.flow.firstReview({kind:"manager",token:l.token},l.account.accountId,1),
    e=>e.status===403);
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?").get(another.account.accountId).stage,"requested");
 }finally{f.close()}
});
test("V8 backend security: revoke reviewer session after authorize and before batch => no approval",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const m=await activeManager(f,9930),l=await f.register(9931,"teacher");
  const principal=await f.service.authorize(m.token);
  const original=f.db.batch.bind(f.db);
  let injected=false;
  f.db.batch=async statements=>{
    if(!injected){injected=true;f.sqlite.prepare("UPDATE account_sessions SET revoked=1 WHERE token_hash=?").run(principal.sessionHash);}
    return original(statements);
  };
  await assert.rejects(()=>f.flow.firstReview({kind:"manager",token:m.token},l.account.accountId,1),
    e=>e.code==="ACCOUNT_CAS_CONFLICT"&&e.status===409);
  assert.equal(injected,true);
  const state=f.sqlite.prepare("SELECT stage,first_review_by FROM account_onboarding WHERE account_id=?").get(l.account.accountId);
  assert.equal(state.stage,"requested");assert.equal(state.first_review_by,null);
 }finally{f.close()}
});
test("V8 backend atomicity: pre-granted manager privilege cannot return 409 after ACTIVE commit",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const m=await f.register(9940,"manager");
  await f.flow.firstReview(owner,m.account.accountId,1);
  f.sqlite.prepare("INSERT INTO account_manager_permissions(account_id,scope,enabled,granted_by) VALUES(?,'manager.approve.registration',1,'anomalous')").run(m.account.accountId);
  await assert.rejects(()=>f.flow.submitProfile(m.token,profile(9940)),e=>e.status===409);
  const state=f.sqlite.prepare("SELECT stage,revision FROM account_onboarding WHERE account_id=?").get(m.account.accountId);
  assert.equal(state.stage,"profile_required");assert.equal(state.revision,2);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?").get(m.account.accountId).n,0);
 }finally{f.close()}
});

test("V8 manager V2 quota display follows ACTIVE entitlement, not retired device access expiry",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const m=await activeManager(f,9950),l=await f.register(9951,"learner");
  await f.flow.firstReview({kind:"manager",token:m.token},l.account.accountId,1);
  await f.flow.submitProfile(l.token,profile(9951));
  const used=async()=>(await f.service.reviewBoard(m.token,"",50)).quotas.learner.used;
  assert.equal(await used(),1);
  f.sqlite.prepare("UPDATE device_access SET access_expires_at='2000-01-01T00:00:00Z' WHERE device_id=?")
    .run(l.account.storageDeviceId);
  assert.equal(await used(),1,"V2 active entitlement remains valid despite stale V1 date");
  f.sqlite.prepare("UPDATE account_entitlements SET state='suspended' WHERE account_id=?")
    .run(l.account.accountId);
  assert.equal(await used(),0,"Suspended V2 entitlement must not consume active quota");
 }finally{f.close()}
});
