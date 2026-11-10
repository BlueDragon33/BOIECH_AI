import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {accountStack} from "./helpers/account-stack.mjs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
async function publicKey(){
 const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 return crypto.subtle.exportKey("jwk",pair.publicKey);
}
function payload(n,contactType,contactValue){
 return {action:"register",role:"learner",login:"r1contact"+n,
  password:"A private passphrase for R1 "+n,
  privacyAccepted:true,contactType,contactValue};
}
test("R1: email-only registration is stored as unverified and never sends OTP",async()=>{
 const f=accountStack({v2:true});
 try{
  const response=await f.post("api/accounts/route.ts",{...payload(101,"email","  STUDENT@GMAIL.COM  "),publicKey:await publicKey()});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.account.status,"pending");
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?").get(data.account.accountId).stage,"requested");
  const contact=f.sqlite.prepare("SELECT kind,value,verified FROM account_contacts WHERE account_id=?").get(data.account.accountId);
  assert.deepEqual(contact,{kind:"email",value:"student@gmail.com",verified:0});
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements").get().n,0);
 }finally{f.close()}
});
test("R1: phone-only registration accepts international formats but never treats contact as device trust",async()=>{
 const f=accountStack({v2:true});
 try{
  const response=await f.post("api/accounts/route.ts",{...payload(102,"phone","+7 (999) 123-45-67"),publicKey:await publicKey()});
  assert.equal(response.status,200);
  const data=await response.json();
  const c=f.sqlite.prepare("SELECT kind,value,verified FROM account_contacts WHERE account_id=?").get(data.account.accountId);
  assert.deepEqual(c,{kind:"phone",value:"+79991234567",verified:0});
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_devices WHERE account_id=? AND approved=1").get(data.account.accountId).n,1);
  const invalid=await f.post("api/accounts/route.ts",{...payload(103,"phone","000"),publicKey:await publicKey()});
  assert.equal(invalid.status,400);
  assert.equal((await invalid.json()).code,"ACCOUNT_CONTACT_INVALID");
 }finally{f.close()}
});
test("R1: missing/invalid contact is rejected before writing accounts",async()=>{
 const f=accountStack({v2:true});
 try{
  for(const [i,kind,value] of [[1,undefined,undefined],[2,"email","not-an-email"],[3,"sms","+84912345678"],[4,"phone","123abc"],[5,"email","attacker@example.com\nFake"]]){
   const response=await f.post("api/accounts/route.ts",{...payload(200+i,kind,value),publicKey:await publicKey()});
   assert.equal(response.status,400,JSON.stringify({i,kind,value}));
   assert.equal((await response.json()).code,"ACCOUNT_CONTACT_INVALID");
  }
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM accounts").get().n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_contacts").get().n,0);
 }finally{f.close()}
});
test("R1: manager application still requires Owner invitation and no public role escalation",async()=>{
 const f=accountStack({v2:true});
 try {
  const response=await f.post("api/accounts/route.ts",{
    ...payload(300,"email","manager@example.org"),role:"manager",publicKey:await publicKey()
  });
  assert.equal(response.status,403);
  assert.equal((await response.json()).code,"MANAGER_OWNER_INTAKE_REQUIRED");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM accounts").get().n,0);
 }finally{f.close()}
});
test("R1: UX stays on distinct login/register screens, with a contact icon switch and profile device management",()=>{
 const gate=read("../app/account-gate.tsx"),css=read("../app/account-gate.module.css"),api=read("../app/api/accounts/route.ts");
 assert.match(gate,/setContactType\("email"\)/);
 assert.match(gate,/setContactType\("phone"\)/);
 assert.match(gate,/name="contactValue"/);
 assert.match(gate,/name="contactType"/);
 assert.match(gate,/onClick=\{\(\)=>setMode\("recover"\)\}/);
 assert.match(gate,/className=\{styles.profileDevices\}/);
 assert.doesNotMatch(gate,/"Đăng ký một lần"|"Chuyển hồ sơ cũ"|"Gỡ máy cũ khi đủ 3 thiết bị"/);
 assert.match(css,/\.authRoot \.contactMethods button\[aria-pressed=true\]/);
 assert.match(api,/normalizeRegistrationContact\(p.contactType,p.contactValue\)/);
});
