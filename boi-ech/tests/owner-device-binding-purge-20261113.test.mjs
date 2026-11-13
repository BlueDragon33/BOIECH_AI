import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {accountStack} from "./helpers/account-stack.mjs";

const owner={role:"owner",actor:"owner@fixture.invalid"};
const hash=(account,device)=>createHash("sha256").update(JSON.stringify([account,device])).digest("hex");
async function pair(f,n) {
 const a=await f.register(n);
 const d=f.sqlite.prepare("SELECT account_id,device_id,created_at,approved,revoked FROM account_devices WHERE account_id=?").get(a.account.accountId);
 return {account:a,device:d,id:hash(d.account_id,d.device_id)};
}
const request=(a,extra={})=>({bindingId:a.id,expectedStatus:"approved",
 expectedCreatedAt:a.device.created_at,confirmation:a.id,reason:"Owner confirms unused device link",...extra});
test("Owner clicks the hash and reads real canonical account binding without publishing the signing key",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const a=await pair(f,60101);
  const before=await f.load("owner-device-bindings.server.ts").ownerDeviceBinding(f.db,owner,{action:"inspect",bindingId:a.id});
  assert.equal(before.contract,"boi-owner-device-binding.v1");
  assert.equal(before.bindingId,a.id);assert.equal(before.status,"approved");
  assert.equal(before.account.accountId,a.device.account_id);
  assert.equal(before.dependencies.sessions,1);
  assert.equal(before.purgeAllowed,false);
  assert.equal(before.preservesLearning,true);
  assert.ok(before.createdAt);
  assert.doesNotMatch(JSON.stringify(before),/private_key_jwk|public_key_jwk|token_hash|recovery_hash/);
 }finally{f.close();}
});
test("No hard purge is possible until Owner explicitly revokes; revocation blocks valid sessions",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const a=await pair(f,60102), api=f.load("owner-device-bindings.server.ts").ownerDeviceBinding;
  await assert.rejects(()=>api(f.db,owner,{action:"purge",...request(a)}),e=>e.code==="DEVICE_BINDING_REVOKE_FIRST");
  await assert.rejects(()=>api(f.db,{role:"viewer",actor:"viewer@fixture.invalid"},{action:"revoke",...request(a)}),e=>e.code==="OWNER_REQUIRED");
  await assert.rejects(()=>api(f.db,owner,{action:"revoke",...request(a),confirmation:"wrong"}),e=>e.code==="DEVICE_BINDING_INPUT");
  const revoked=await api(f.db,owner,{action:"revoke",...request(a)});
  assert.equal(revoked.status,"blocked");assert.equal(revoked.dependencies.activeSessions,0);
  await assert.rejects(()=>f.service.session(a.account.token),e=>e.code==="SESSION_INVALID");
  await assert.rejects(()=>api(f.db,owner,{action:"revoke",...request(a)}),e=>e.code==="DEVICE_BINDING_CAS_CONFLICT");
  const audit=f.sqlite.prepare("SELECT action FROM account_audit WHERE target=? ORDER BY id").all(a.id);
  assert.deepEqual(audit.map(x=>x.action),["owner.device-binding.revoke"]);
 }finally{f.close();}
});
test("Hard purge deletes device binding, sessions and sync metadata, not account/progress or immutable audit",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const a=await pair(f,60103),b=await pair(f,60104);
  const api=f.load("owner-device-bindings.server.ts").ownerDeviceBinding;
  await api(f.db,owner,{action:"revoke",...request(a)});
  const purged=await api(f.db,owner,{action:"purge",...request(a,{expectedStatus:"blocked"})});
  assert.equal(purged.deleted,true);assert.equal(purged.verified,true);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_devices WHERE account_id=?").get(a.device.account_id).n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_sessions WHERE account_id=?").get(a.device.account_id).n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM accounts WHERE account_id=?").get(a.device.account_id).n,1);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_devices WHERE account_id=?").get(b.device.account_id).n,1);
  assert.equal(f.sqlite.prepare("PRAGMA foreign_key_check").all().length,0);
  assert.deepEqual(f.sqlite.prepare("SELECT action FROM account_audit WHERE target=? ORDER BY id").all(a.id)
    .map(x=>x.action),["owner.device-binding.revoke","owner.device-binding.purge"]);
  await assert.rejects(()=>api(f.db,owner,{action:"inspect",bindingId:a.id}),e=>e.code==="DEVICE_BINDING_NOT_FOUND");
  await assert.rejects(()=>api(f.db,owner,{action:"purge",...request(a,{expectedStatus:"blocked"})}),e=>e.code==="DEVICE_BINDING_NOT_FOUND");
 }finally{f.close();}
});
test("Owner hard purge of the last device cannot let a fresh login auto-approve itself",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const a=await pair(f,60106),api=f.load("owner-device-bindings.server.ts").ownerDeviceBinding;
  await api(f.db,owner,{action:"revoke",...request(a)});
  await api(f.db,owner,{action:"purge",...request(a,{expectedStatus:"blocked"})});
  const keys=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  const publicKey=await crypto.subtle.exportKey("jwk",keys.publicKey);
  const fresh=await f.service.login({login:"fixture60106",password:"Local-only unique passphrase 60106",
    publicKey},"verified-login");
  const principal=await f.service.session(fresh.token);
  assert.equal(principal.deviceApproved,false,"existing account with zero bindings must not auto-trust a new browser");
  await assert.rejects(()=>f.service.authorize(fresh.token),e=>e.code==="DEVICE_APPROVAL_REQUIRED");
 }finally{f.close();}
});
test("An obsolete pending second-browser link can be purged while preserving the trusted login device",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const a=await pair(f,60105);
  const pendingDevice="c".repeat(64);
  f.sqlite.prepare("INSERT INTO account_devices(account_id,device_id,public_key_jwk,approved,revoked) VALUES(?,?,'{}',0,0)")
   .run(a.device.account_id,pendingDevice);
  const row=f.sqlite.prepare("SELECT account_id,device_id,created_at,approved,revoked FROM account_devices WHERE account_id=? AND device_id=?")
   .get(a.device.account_id,pendingDevice);
  const stale={account:a.account,device:row,id:hash(row.account_id,row.device_id)};
  const api=f.load("owner-device-bindings.server.ts").ownerDeviceBinding;
  const detail=await api(f.db,owner,{action:"inspect",bindingId:stale.id});
  assert.equal(detail.status,"pending");
  assert.equal(detail.dependencies.otherTrustedDevices,1);
  await api(f.db,owner,{action:"revoke",...request(stale,{expectedStatus:"pending"})});
  const result=await api(f.db,owner,{action:"purge",...request(stale,{expectedStatus:"blocked"})});
  assert.equal(result.deleted,true);
  assert.equal((await f.service.session(a.account.token)).accountId,a.device.account_id,
    "the unrelated trusted device must remain logged in");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_devices WHERE account_id=?").get(a.device.account_id).n,1);
 }finally{f.close();}
});
test("Purge blocks stale confirmations; no API grants access to non-Owner or generic control tickets",()=>{
 const route=readFileSync(new URL("../app/api/control/v2/device-bindings/route.ts",import.meta.url),"utf8");
 const service=readFileSync(new URL("../app/owner-device-bindings.server.ts",import.meta.url),"utf8");
 assert.match(route,/requireControlService\(request,"account-owner"\)/);
 assert.match(route,/owner\.role!=="owner"/);
 assert.match(service,/input\.confirmation!==id/);
 assert.match(service,/input\.expectedCreatedAt/);
 assert.match(service,/owner\.device-binding\.purge/);
 assert.match(service,/DELETE FROM account_sync_events/);
 assert.match(service,/DELETE FROM account_sync_grants/);
 assert.match(service,/DELETE FROM account_sessions/);
 assert.match(service,/DELETE FROM account_devices/);
 assert.doesNotMatch(service,/DELETE FROM accounts|DELETE FROM account_audit/);
});
