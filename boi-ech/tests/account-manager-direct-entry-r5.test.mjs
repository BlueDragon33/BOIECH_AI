import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {accountStack} from "./helpers/account-stack.mjs";

const owner={role:"owner",actor:"owner@fixture.invalid"};
const profile={familyName:"Nguyen Dinh",givenName:"Nam",
 facultyUnit:"Training department",jobTitle:"Instructor",jobPosition:"Head of section"};
async function makeManager(f,kind,n){
 const invite=await f.service.issueManagerInvite(owner,1);
 const keyPair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const publicKey=await crypto.subtle.exportKey("jwk",keyPair.publicKey);
 const input={role:"manager",login:"manager-r5-"+n,password:"A private manager passphrase 2026! "+n,
   managerInviteToken:invite.inviteToken,privacyAccepted:true,contactType:kind,
   contactValue:kind==="email"?"manager"+n+"@fixture.invalid":"+7 (999) 123-45-"+String(n).padStart(2,"0"),
   publicKey};
 const result=await f.service.registerManagerWithInvite(input,"peer-"+n);
 const stage=await f.flow.firstReview({kind:"owner",actor:owner.actor},result.account.accountId,1);
 assert.equal(stage.stage,"profile_required");
 return result;
}
test("R5: email-first manager may add mobile in same atomic activation, without second registration",async()=>{
 const f=accountStack({legacyPolicy:true,v2:true,singleReview:true});
 try{
  const manager=await makeManager(f,"email",41),id=manager.account.accountId;
  f.setCookie(manager.token);
  const res=await f.get("api/accounts/route.ts");
  assert.equal(res.status,200);
  const body=await res.json();
  assert.equal(body.account.primaryContactKind,"email");
  assert.equal(body.account.storageDeviceId,manager.account.storageDeviceId);
  assert.ok(!JSON.stringify(body).includes("manager41@fixture.invalid"),"do not disclose account contacts");
  const stage=await f.flow.submitProfile(manager.token,{...profile,secondaryContact:"+84 (912) 345-678",
     expectedRevision:2});
  assert.equal(stage.stage,"active");
  const row=f.sqlite.prepare("SELECT kind,value,secondary_kind,secondary_value,verified FROM account_contacts WHERE account_id=?").get(id);
  assert.equal(row.kind,"email");assert.equal(row.value,"manager41@fixture.invalid");
  assert.equal(row.secondary_kind,"phone");assert.equal(row.secondary_value,"+84912345678");
  assert.equal(row.verified,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM accounts").get().n,1);
  assert.equal((await f.service.ownerRead(id)).entitlement.active,true);
 }finally{f.close();}
});
test("R5: phone-first manager may add email, preserving original phone and one trusted account",async()=>{
 const f=accountStack({legacyPolicy:true,v2:true,singleReview:true});
 try{
  const manager=await makeManager(f,"phone",42),id=manager.account.accountId;
  f.setCookie(manager.token);
  const read=await f.get("api/accounts/route.ts");
  assert.equal((await read.json()).account.primaryContactKind,"phone");
  const state=await f.flow.submitProfile(manager.token,{...profile,secondaryContact:"MiXeD@Example.COM",expectedRevision:2});
  assert.equal(state.stage,"active");
  const row=f.sqlite.prepare("SELECT kind,value,secondary_kind,secondary_value FROM account_contacts WHERE account_id=?").get(id);
  assert.equal(row.kind,"phone");assert.equal(row.secondary_kind,"email");
  assert.equal(row.secondary_value,"mixed@example.com");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM accounts").get().n,1);
  assert.equal((await f.service.ownerRead(id)).status,"approved");
 }finally{f.close();}
});
test("R5: invalid secondary contact is denied before activation, with no partial write or entitlement",async()=>{
 const f=accountStack({legacyPolicy:true,v2:true,singleReview:true});
 try{
  const manager=await makeManager(f,"email",43),id=manager.account.accountId;
  for(const invalid of ["broken phone",{value:"123"},"123"]){
   await assert.rejects(()=>f.flow.submitProfile(manager.token,{...profile,secondaryContact:invalid,expectedRevision:2}),
     e=>e.code==="ACCOUNT_CONTACT_INVALID");
  }
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?").get(id).stage,"profile_required");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?").get(id).n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_manager_profiles WHERE account_id=?").get(id).n,0);
  assert.equal(f.sqlite.prepare("SELECT secondary_value FROM account_contacts WHERE account_id=?").get(id).secondary_value,null);
 }finally{f.close();}
});
test("R5: optional supplemental contact may be omitted without blocking existing valid manager activation",async()=>{
 const f=accountStack({legacyPolicy:true,v2:true,singleReview:true});
 try{
  const manager=await makeManager(f,"email",44),id=manager.account.accountId;
  const stage=await f.flow.submitProfile(manager.token,{...profile,expectedRevision:2});
  assert.equal(stage.stage,"active");
  const value=f.sqlite.prepare("SELECT secondary_value FROM account_contacts WHERE account_id=?").get(id);
  assert.equal(value.secondary_value,null);
 }finally{f.close();}
});
test("R5: raw D1 constraint rejects same-kind secondary contact and leaves primary unchanged",async()=>{
 const f=accountStack({legacyPolicy:true,v2:true,singleReview:true});
 try{
  const manager=await makeManager(f,"email",45),id=manager.account.accountId;
  assert.throws(()=>f.sqlite.prepare("UPDATE account_contacts SET secondary_kind='email', secondary_value='same@example.invalid' WHERE account_id=?").run(id),
    /ACCOUNT_SECONDARY_CONTACT_INVALID/);
  const record=f.sqlite.prepare("SELECT secondary_kind,secondary_value FROM account_contacts WHERE account_id=?").get(id);
  assert.equal(record.secondary_kind,null);
  assert.equal(record.secondary_value,null);
 }finally{f.close();}
});
test("R5: after server-confirmed active manager, AccountGate opens ManagerWorkspace and does not mount legacy DeviceGate",()=>{
 const ui=readFileSync(new URL("../app/account-gate.tsx",import.meta.url),"utf8");
 const page=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
 const proof=readFileSync(new URL("../app/multi-account-switcher.tsx",import.meta.url),"utf8");
 assert.match(ui,/managerDashboard=Boolean\(ready && active && v2/);
 assert.match(ui,/<ManagerWorkspace deviceId=\{account.storageDeviceId\} getProof=\{getManagerProof\}/);
 assert.match(ui,/!managerDashboard && ready && active && account/);
 assert.doesNotMatch(ui,/ready && active && !recovery && account/);
 assert.match(ui,/recoveryMustRemainVisible\(active,recovery\)/);
 assert.match(ui,/primaryContactKind==="email"\?"Số điện thoại bổ sung":"Email bổ sung"/);
 assert.match(proof,/portableManagerProof\(storageDeviceId: string\)/);
 assert.match(proof,/action:"legacy-challenge",deviceId:storageDeviceId/);
 assert.match(page,/<DeviceGate/);
 assert.doesNotMatch(ui,/save-registration|setPersonCode|submitDeviceRegistration/);
});
