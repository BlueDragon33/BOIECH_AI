import test from "node:test";
import assert from "node:assert/strict";
import {accountStack} from "./helpers/account-stack.mjs";

const owner={kind:"owner",actor:"owner@fixture.invalid"};
const managerProfile=n=>({familyName:"Quan ly",givenName:"Kiem duyet",facultyUnit:"Trung tam",
 jobTitle:"Giao vien",jobPosition:"Phu trach",expectedRevision:2});
const learnerProfile=n=>({familyName:"Hoc vien",givenName:"Da khai",className:"Lop "+n,phone:"090"+String(n).padStart(7,"0"),expectedRevision:1});
async function activeManager(f,n){
 const m=await f.register(n,"manager");
 await f.flow.firstReview(owner,m.account.accountId,1);
 await f.flow.submitProfile(m.token,managerProfile(n));
 return m;
}
test("V9 canonical profile saved before approval; manager reviews named applicant; activation without retyping",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const manager=await activeManager(f,10101);
  const applicant=await f.register(10102,"learner");
  const draft=await f.flow.saveProfileDraft(applicant.token,learnerProfile(10102));
  assert.equal(draft.saved,true);
  const own=await f.flow.ownProfileDraft(applicant.token);
  assert.equal(own.ready,true);
  assert.equal(own.fields.personCode,undefined,"no personal code from user");
  const before=await f.service.reviewBoard(manager.token,"",50);
  const item=before.devices.find(x=>x.accountId===applicant.account.accountId);
  assert.equal(item?.name,"Hoc vien Da khai");
  assert.equal(item?.className,"Lop 10102");
  assert.equal(item?.onboardingStage,"requested");
  const reviewed=await f.flow.firstReview({kind:"manager",token:manager.token},applicant.account.accountId,1);
  assert.equal(reviewed.stage,"profile_required");
  const active=await f.flow.activateProfileDraft(applicant.token);
  assert.equal(active.stage,"active");
  assert.equal(active.status,"approved");
  const record=await f.service.ownerRead(applicant.account.accountId);
  assert.equal(record.registrationProfile?.givenName,"Da khai");
  assert.ok(record.personCode.startsWith("HV_"),"internal-only role code generated automatically");
  assert.equal(record.entitlement?.active,true);
  assert.ok(Math.abs(Date.parse(record.entitlement.expiresAt)-Date.now()-30*86400000)<120000);
  await assert.rejects(()=>f.flow.activateProfileDraft(applicant.token),
   e=>e.status===409&&e.code==="ACCOUNT_CAS_CONFLICT");
 }finally{f.close()}
});
test("V9 preapproval saves no access grants; wrong revision fails with no saved profile",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const learner=await f.register(10111,"learner");
  await assert.rejects(()=>f.flow.saveProfileDraft(learner.token,{...learnerProfile(10111),expectedRevision:88}),
   e=>e.status===409&&e.code==="ACCOUNT_CAS_CONFLICT");
  assert.equal((await f.flow.ownProfileDraft(learner.token)).ready,false);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?")
    .get(learner.account.accountId).n,0);
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?")
    .get(learner.account.accountId).stage,"requested");
 }finally{f.close()}
});
test("V9 revoked P-256 session immediately before D1 draft write rolls back",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const l=await f.register(10121,"learner");
  const actor=await f.service.session(l.token);
  const real=f.db.batch.bind(f.db);
  let inserted=false;
  f.db.batch=async stmts=>{
    if(!inserted){inserted=true;f.sqlite.prepare("UPDATE account_sessions SET revoked=1 WHERE token_hash=?")
      .run(actor.sessionHash);}
    return real(stmts);
  };
  await assert.rejects(()=>f.flow.saveProfileDraft(l.token,learnerProfile(10121)),
    e=>e.status===409&&e.code==="ACCOUNT_CAS_CONFLICT");
  assert.equal(inserted,true);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_profile_drafts WHERE account_id=?")
    .get(l.account.accountId).n,0);
 }finally{f.close()}
});
test("V9 manager invitation role retains separate Owner approval; no manager-invited trial can grant rights",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const applicant=await f.register(10131,"manager");
  await f.flow.saveProfileDraft(applicant.token,{...managerProfile(10131),expectedRevision:1});
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_manager_permissions WHERE account_id=?")
   .get(applicant.account.accountId).n,0);
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?")
   .get(applicant.account.accountId).stage,"requested");
 }finally{f.close()}
});

test("V9 Owner all-role directory reads pending profile only via privileged service, no authority mutation",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const pending=await f.register(10141,"teacher");
  await f.flow.saveProfileDraft(pending.token,{familyName:"Giang vien",givenName:"Moi",className:"Lop hoc",phone:"",expectedRevision:1});
  const directory=await f.service.ownerAllAccounts("",40);
  assert.equal(directory.verified,true);
  const person=directory.accounts.find(x=>x.accountId===pending.account.accountId);
  assert.equal(person?.registrationProfile?.givenName,"Moi");
  assert.equal(person?.onboardingStage,"requested");
  assert.equal(person?.status,"pending");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit WHERE action='account.review.first'")
    .get().n,0);
 }finally{f.close()}
});
