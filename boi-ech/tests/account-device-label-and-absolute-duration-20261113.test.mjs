import test from "node:test";
import assert from "node:assert/strict";
import {accountStack} from "./helpers/account-stack.mjs";
const owner={actor:"owner@fixture.invalid",role:"owner"};
const day=86400000;
test("current trusted device gets readable OS/browser label and cannot revoke its own active P-256 key",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const a=await f.register(99100,"learner");
  const ua="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
  const devices=await f.service.devices(a.token,ua);
  assert.equal(devices.length,1);
  assert.equal(devices[0].display_label,"Máy tính Windows · Chrome");
  assert.equal(devices[0].current,true);
  await assert.rejects(()=>f.service.revokeDevice(a.token,devices[0].device_id),e=>e.code==="DEVICE_CURRENT_IN_USE");
  assert.equal(f.sqlite.prepare("SELECT revoked FROM account_devices WHERE account_id=?").get(a.account.accountId).revoked,0);
 }finally{f.close();}
});
test("Owner 4-year lease can be reduced to exactly 7 days without accumulation; forever is explicit",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const a=await f.register(99101,"learner");
  await f.flow.completeProfileWithoutReview(a.token,{
   expectedRevision:1,familyName:"Example",givenName:"Student",
   className:"Swim",phone:"0900009981"
  });
  const svc=new (f.load("account-entitlement.server.ts").AccountEntitlementService)(f.db);
  const before=await svc.read(a.account.accountId);
  const fourYears=await svc.change(owner,{accountId:a.account.accountId,operation:"set-preset",
   period:"4y",expectedRevision:before.revision,reason:"Owner sets four-year lease"});
  assert.ok(Date.parse(fourYears.expiresAt)>Date.now()+1000*day);
  const shorter=await svc.change(owner,{accountId:a.account.accountId,operation:"set-preset",
   period:"7d",expectedRevision:fourYears.revision,reason:"Owner resets shorter seven-day lease"});
  assert.ok(Date.parse(shorter.expiresAt)<Date.parse(fourYears.expiresAt));
  assert.ok(Math.abs(Date.parse(shorter.expiresAt)-Date.now()-7*day)<120000);
  const forever=await svc.change(owner,{accountId:a.account.accountId,operation:"set-preset",
   period:"forever",expectedRevision:shorter.revision,reason:"Owner grants permanent entitlement"});
  assert.equal(forever.expiresAt,"9999-12-31T23:59:59.000Z");
  await assert.rejects(()=>svc.change(owner,{accountId:a.account.accountId,operation:"set-preset",
    period:"bad",expectedRevision:forever.revision,reason:"Invalid period should fail"}),e=>e.code==="ACCOUNT_INPUT");
 }finally{f.close();}
});
