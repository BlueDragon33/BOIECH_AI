import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {accountStack} from "./helpers/account-stack.mjs";

async function key(){
 const p=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 return crypto.subtle.exportKey("jwk",p.publicKey);
}
test("R2: matching self-declared contact on new device NEVER approves device or grants app access",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const login="contactnewdevice1",password="Long private password for contact test";
  const reg=await f.service.register({role:"learner",login,password,privacyAccepted:true,
    contactType:"email",contactValue:"learner@fixture.invalid",publicKey:await key()},"peer-a");
  const other=await f.service.login({login,password,publicKey:await key()},"peer-b");
  const actor=await f.service.session(other.token);
  assert.equal(actor.deviceApproved,false);
  f.setCookie(other.token);
  const wrong=await f.post("api/accounts/route.ts",{
    action:"contact-check",contactType:"email",contactValue:"wrong@fixture.invalid"});
  assert.equal(wrong.status,200);
  assert.equal((await wrong.json()).matched,false);
  const correct=await f.post("api/accounts/route.ts",{
    action:"contact-check",contactType:"email",contactValue:"LEARNER@fixture.invalid"});
  assert.equal(correct.status,200);
  const result=await correct.json();
  assert.equal(result.matched,true);
  assert.equal(result.verified,false);
  assert.equal(result.deviceApproved,false);
  assert.equal((await f.service.session(other.token)).deviceApproved,false);
  assert.equal(f.sqlite.prepare("SELECT approved FROM account_devices WHERE account_id=? AND device_id=?")
    .get(reg.account.accountId,other.deviceId).approved,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?")
    .get(reg.account.accountId).n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit WHERE action='account.contact.compared' AND target=?")
    .get(other.deviceId).n,2);
 }finally{f.close()}
});
test("R2: contact prompt is rejected for already trusted devices, no extra enrollment",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const reg=await f.service.register({role:"teacher",login:"contactnewdevice2",
    password:"Another long private password for contact",privacyAccepted:true,
    contactType:"phone",contactValue:"+79991234567",publicKey:await key()},"peer-a");
  f.setCookie(reg.token);
  const resp=await f.post("api/accounts/route.ts",{
    action:"contact-check",contactType:"phone",contactValue:"+7 (999) 123-45-67"});
  assert.equal(resp.status,409);
  assert.equal((await resp.json()).code,"CONTACT_CHECK_NOT_REQUIRED");
 }finally{f.close()}
});
test("R2: new-device contact form shows requested type and labels required profile fields",()=>{
 const source=readFileSync(new URL("../app/account-gate.tsx",import.meta.url),"utf8");
 const core=readFileSync(new URL("../app/account-core.server.ts",import.meta.url),"utf8");
 assert.match(source,/Thiết bị mới · Đối chiếu liên hệ/);
 assert.match(source,/name="contactValue" required/);
 assert.match(source,/Để mở dữ liệu, cần xác nhận từ thiết bị tin cậy/);
 assert.match(source,/<span>\{label\} <span className=\{styles\.requiredMark\}/);
 assert.match(core,/return \{matched,deviceApproved:false,verified:false\}/);
 const compareMethod=core.slice(core.indexOf("async compareRegisteredContact"),core.indexOf("async recover("));
 assert.ok(compareMethod.length>100);
 assert.doesNotMatch(compareMethod,/UPDATE account_devices|INSERT INTO account_entitlements|SET approved=1/);
});
