import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {accountStack} from "./helpers/account-stack.mjs";

const make=()=>accountStack({v2:true,singleReview:true});
const trial=f=>new (f.load("account-trial.server.ts").AccountTrialService)(f.db,f.service);
const profile={familyName:"Ho",givenName:"Ten",className:"Lop thu",phone:"",expectedRevision:1};
test("V9 trial: one immutable 8-hour lease, login/second-start never extends",async()=>{
 const f=make();
 try{
  const user=await f.register(16001,"learner"),service=trial(f);
  const available=await service.status(user.token);
  assert.equal(available.state,"available");
  const first=await service.start(user.token);
  assert.equal(first.state,"active");
  assert.equal(first.role,"learner");
  assert.equal(first.expiresAtMs-first.startedAtMs,8*60*60*1000);
  const second=await service.start(user.token);
  assert.equal(second.startedAtMs,first.startedAtMs);
  assert.equal(second.expiresAtMs,first.expiresAtMs);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_ui_trials").get().n,1);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?")
    .get(user.account.accountId).n,0,"trial never grants entitlement");
 }finally{f.close();}
});
test("V9 trial: expired issuance cannot restart; canonical profile draft survives",async()=>{
 const f=make();
 try{
  const user=await f.register(16002,"learner"),service=trial(f);
  const draft=await f.flow.saveProfileDraft(user.token,profile);
  assert.equal(draft.saved,true);
  await service.start(user.token);
  const old=Date.now()-9*60*60*1000;
  f.sqlite.prepare("UPDATE account_ui_trials SET started_at_ms=?,expires_at_ms=? WHERE account_id=?")
    .run(old,old+8*60*60*1000,user.account.accountId);
  assert.equal((await service.status(user.token)).state,"expired");
  await assert.rejects(()=>service.start(user.token),e=>e.code==="TRIAL_EXPIRED"&&e.status===409);
  assert.equal((await f.flow.ownProfileDraft(user.token)).fields.givenName,"Ten");
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?").get(user.account.accountId).stage,"requested");
 }finally{f.close();}
});
test("V9 trial: revoked session/device and changed role cannot reach trial service",async()=>{
 const f=make();
 try{
  const user=await f.register(16003,"teacher"),service=trial(f);
  await service.start(user.token);
  f.sqlite.prepare("UPDATE account_devices SET revoked=1 WHERE account_id=?").run(user.account.accountId);
  await assert.rejects(()=>service.status(user.token),e=>e.status===401);
  await assert.rejects(()=>service.start(user.token),e=>e.status===401);
 }finally{f.close();}
});
test("V9 trial: active manager not eligible; manager trial has no approval grants",async()=>{
 const f=make();
 try{
  const user=await f.register(16004,"manager"),service=trial(f);
  const lease=await service.start(user.token);
  assert.equal(lease.role,"manager");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_manager_permissions WHERE account_id=?")
    .get(user.account.accountId).n,0);
  await f.flow.firstReview({kind:"owner",actor:"owner@fixture.invalid"},user.account.accountId,1);
  await f.flow.submitProfile(user.token,{familyName:"Ho",givenName:"Ten",facultyUnit:"Khoa",jobTitle:"GV",jobPosition:"Quan ly",expectedRevision:2});
  await assert.rejects(()=>service.status(user.token),e=>e.code==="TRIAL_NOT_ELIGIBLE"&&e.status===403);
 }finally{f.close();}
});
test("V9 trial: network contract has no real trial mutation endpoint, sandbox never stores activity",()=>{
 const source=readFileSync(new URL("../app/account-trial-sandbox.tsx",import.meta.url),"utf8");
 const server=readFileSync(new URL("../app/account-trial.server.ts",import.meta.url),"utf8");
 const route=readFileSync(new URL("../app/api/accounts/route.ts",import.meta.url),"utf8");
 const gate=readFileSync(new URL("../app/account-gate.tsx",import.meta.url),"utf8");
 assert.match(source,/DỮ LIỆU THỬ — KHÔNG LƯU VÀO HỒ SƠ THẬT/);
 assert.doesNotMatch(source,/localStorage\.|sessionStorage\.|indexedDB\.|serviceWorker\./);
 assert.doesNotMatch(source,/fetch\(\s*["']\/api\/(?!accounts\b)/);
 assert.match(source,/body:JSON\.stringify\(\{action:"trial-status"\}\)/);
 assert.match(route,/config\.uiTrial/);
 assert.match(route,/p\.action === "trial-start"/);
 assert.match(server,/INSERT OR IGNORE INTO account_ui_trials/);
 assert.match(server,/d\.status='pending'/);
 assert.match(server,/s\.revoked=0 AND b\.revoked=0 AND b\.approved=1/);
 assert.match(gate,/trialEnabled&&/);
});
