import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {accountStack} from "./helpers/account-stack.mjs";

const source=readFileSync(new URL("../app/training-management.server.ts",import.meta.url),"utf8");
const authority=source.match(/const authorityGuard=actor\.accountId\?\`([\s\S]*?)\`:AUTH_GUARD/);
assert.ok(authority,"source V2 account guard must remain extractable for negative tests");
const guard=new Function("scopedTarget","return `"+authority[1]+"`;")(null);
const boardSql=source.match(/db\.prepare\(`(SELECT d\.device_id[\s\S]*?LIMIT 1001)`\)\.all<TrainingPerson>\(\)/)?.[1];
assert.ok(boardSql,"read-only person status query not found");
const owner={kind:"owner",actor:"owner@fixture.invalid"};
const profile=n=>({familyName:"Guard",givenName:"Candidate",personCode:"R3TEST"+n,
 className:"Unit",phone:"090"+String(n).padStart(7,"0"),facultyUnit:"Training Department",jobTitle:"Instructor",jobPosition:"Unit Manager"});
async function activateManager(f,n){
 const m=await f.register(n,"manager");
 await f.flow.firstReview(owner,m.account.accountId,1);
 await f.flow.submitProfile(m.token,{...profile(n),expectedRevision:2});
 return m;
}
function accepts(f,m,sessionHash){
 return Boolean(f.sqlite.prepare("SELECT 1 AS allowed WHERE "+guard)
  .get(m.account.storageDeviceId,sessionHash));
}
test("R3: V2 manager training writes use account entitlement, not expired V1 device date",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const manager=await activateManager(f,9301);
  const session=await f.service.session(manager.token);
  assert.equal(accepts(f,manager,session.sessionHash),true);
  f.sqlite.prepare("UPDATE device_access SET access_expires_at='2000-01-01T00:00:00Z' WHERE device_id=?")
    .run(manager.account.storageDeviceId);
  assert.equal(accepts(f,manager,session.sessionHash),true);
  f.sqlite.prepare("UPDATE account_entitlements SET state='suspended' WHERE account_id=?")
    .run(manager.account.accountId);
  assert.equal(accepts(f,manager,session.sessionHash),false,"no fallback to non-expiring legacy access");
  f.sqlite.prepare("UPDATE account_entitlements SET state='active' WHERE account_id=?").run(manager.account.accountId);
  assert.equal(accepts(f,manager,session.sessionHash),true);
  f.sqlite.prepare("UPDATE account_manager_permissions SET enabled=0 WHERE account_id=? AND scope='manager.manage.assigned'")
    .run(manager.account.accountId);
  assert.equal(accepts(f,manager,session.sessionHash),false);
 }finally{f.close()}
});
test("R3: revoke session/device or suspend onboarding => deny manager operations",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const m=await activateManager(f,9302), session=await f.service.session(m.token);
  const q="UPDATE account_sessions SET revoked=? WHERE token_hash=?";
  assert.equal(accepts(f,m,session.sessionHash),true);
  f.sqlite.prepare(q).run(1,session.sessionHash);
  assert.equal(accepts(f,m,session.sessionHash),false);
  f.sqlite.prepare(q).run(0,session.sessionHash);
  f.sqlite.prepare("UPDATE account_devices SET approved=0 WHERE account_id=? AND device_id=?")
    .run(m.account.accountId,session.deviceId);
  assert.equal(accepts(f,m,session.sessionHash),false);
  f.sqlite.prepare("UPDATE account_devices SET approved=1 WHERE account_id=? AND device_id=?")
    .run(m.account.accountId,session.deviceId);
  f.sqlite.prepare("UPDATE account_onboarding SET stage='suspended' WHERE account_id=?").run(m.account.accountId);
  assert.equal(accepts(f,m,session.sessionHash),false);
 }finally{f.close()}
});
test("R3: board marks active V2 learner by entitlement instead of stale legacy expiry",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const manager=await activateManager(f,9303);
  const l=await f.register(9304,"learner");
  await f.flow.firstReview({kind:"manager",token:manager.token},l.account.accountId,1);
  await f.flow.submitProfile(l.token,{...profile(9304),expectedRevision:2});
  const read=()=>f.sqlite.prepare(boardSql).all().find(x=>x.id===l.account.storageDeviceId);
  assert.equal(read()?.expired,0);
  f.sqlite.prepare("UPDATE device_access SET access_expires_at='2000-01-01T00:00:00Z' WHERE device_id=?").run(l.account.storageDeviceId);
  assert.equal(read()?.expired,0);
  f.sqlite.prepare("UPDATE account_entitlements SET state='suspended' WHERE account_id=?").run(l.account.accountId);
  assert.equal(read()?.expired,1);
  f.sqlite.prepare("UPDATE account_entitlements SET state='active',expires_at='2000-01-01T00:00:00Z' WHERE account_id=?").run(l.account.accountId);
  assert.equal(read()?.expired,1);
 }finally{f.close()}
});
test("R3: V1 legacy management path remains and V2 does not silently select legacy for scoped actor",()=>{
 assert.match(source,/const AUTH_GUARD=`EXISTS\(SELECT 1 FROM device_access/);
 assert.match(source,/actor\.accountId\?\`EXISTS/);
 assert.match(source,/JOIN account_onboarding o ON o.account_id=ca.account_id/);
 assert.match(source,/JOIN account_entitlements e ON e.account_id=ca.account_id/);
 assert.match(source,/AND b.approved=1/);
});
