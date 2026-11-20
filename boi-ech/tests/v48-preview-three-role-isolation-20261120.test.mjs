import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accountStack } from "./helpers/account-stack.mjs";

const owner={kind:"owner",actor:"owner@fixture.invalid"};
const pass=n=>"Local-only unique passphrase "+n;
const profile=(n,className)=>({
  familyName:"Synthetic",givenName:"Test",personCode:"PERSON"+n,className,
  phone:"090"+String(n).padStart(7,"0"),
  facultyUnit:"Preview QA",jobTitle:"Instructor",jobPosition:"Unit manager",
  expectedRevision:2
});
async function activateManager(f,n=48310){
  const person=await f.register(n,"manager");
  await assert.rejects(()=>f.service.authorize(person.token),e=>e.code==="ACCOUNT_ONBOARDING_REQUIRED");
  await f.flow.firstReview(owner,person.account.accountId,1);
  const accepted=await f.flow.submitProfile(person.token,profile(n,"QA UNIT"));
  assert.equal(accepted.stage,"active");
  assert.equal((await f.service.authorize(person.token)).role,"manager");
  await f.service.capability(await f.service.session(person.token),"manager.approve.registration");
  return person;
}
async function activate(f,manager,n,role,className){
  const person=await f.register(n,role);
  await assert.rejects(()=>f.service.authorize(person.token),e=>e.code==="ACCOUNT_ONBOARDING_REQUIRED");
  await assert.rejects(()=>f.flow.firstReview({kind:"manager",token:person.token},person.account.accountId,1));
  const reviewed=await f.flow.firstReview({kind:"manager",token:manager.token},person.account.accountId,1);
  assert.equal(reviewed.stage,"profile_required");
  const activated=await f.flow.submitProfile(person.token,profile(n,className));
  assert.equal(activated.stage,"active");
  assert.equal((await f.service.authorize(person.token)).role,role);
  return person;
}
async function http(f,token,path,body={}){
  f.setCookie(token);
  return f.post(path,body);
}
test("V48 three roles: distinct human review, per-role entitlement, no two-review or permission escalation",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
   const manager=await activateManager(f,48310);
   const teacher=await activate(f,manager,48311,"teacher","QA CLASS A");
   const learner=await activate(f,manager,48312,"learner","QA CLASS A");
   const entries=f.sqlite.prepare("SELECT d.person_role AS role,o.stage AS stage FROM accounts a JOIN device_access d ON a.storage_device_id=d.device_id JOIN account_onboarding o ON o.account_id=a.account_id").all();
   assert.deepEqual(entries.map(x=>x.role).sort(),["learner","manager","teacher"]);
   assert.ok(entries.every(x=>x.stage==="active"));
   assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit WHERE action='account.review.first'").get().n,3);
   for(const person of [teacher,learner]){
     await assert.rejects(()=>f.service.capability(await f.service.session(person.token),"manager.approve.registration"),
       e=>e.code==="ACCOUNT_PERMISSION_REQUIRED");
     await assert.rejects(()=>f.service.reviewBoard(person.token),e=>e.code==="ACCOUNT_PERMISSION_REQUIRED");
   }
   await assert.rejects(()=>f.service.review(manager.token,learner.account.accountId,"approve"),
     e=>e.code==="ACCOUNT_REVIEW_SUPERSEDED");
   const board=await f.service.reviewBoard(manager.token);
   const ids=board.devices.map(x=>x.accountId);
   assert.ok(ids.includes(teacher.account.accountId) && ids.includes(learner.account.accountId));
   assert.ok(!ids.includes(manager.account.accountId));
 }finally{f.close();}
});
test("V48 teacher HTTP: wrong-role denied, current class only, unrelated class excluded",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const manager=await activateManager(f,48320);
  const teacher=await activate(f,manager,48321,"teacher","QA CLASS A");
  const learnerA=await activate(f,manager,48322,"learner","QA CLASS A");
  const learnerB=await activate(f,manager,48323,"learner","QA CLASS B");
  const teacherResponse=await http(f,teacher.token,"api/teacher/overview/route.ts",{});
  assert.equal(teacherResponse.status,200,await teacherResponse.clone().text());
  const body=await teacherResponse.json();
  assert.equal(body.summary.learnerCount,1);
  assert.ok(body.learners.some(x=>x.personCode==="PERSON48322"));
  assert.ok(!body.learners.some(x=>x.personCode==="PERSON48323"));
  assert.ok(body.learners.every(x=>x.className==="QA CLASS A"));
  for(const who of [manager,learnerA,learnerB]){
   const response=await http(f,who.token,"api/teacher/overview/route.ts",{});
   assert.equal(response.status,403,await response.clone().text());
   const denied=await response.json();
   assert.equal(denied.code,"TEACHER_ROLE_REQUIRED");
  }
 }finally{f.close();}
});
test("V48 learner HTTP: foreign device claim denied, per-account progress not disclosed",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const m=await activateManager(f,48330);
  const a=await activate(f,m,48331,"learner","QA CLASS A");
  const b=await activate(f,m,48332,"learner","QA CLASS B");
  const own=await http(f,a.token,"api/course/route.ts",{action:"bootstrap",lessonNumber:"01"});
  assert.equal(own.status,200,await own.clone().text());
  const wrong=await http(f,a.token,"api/course/route.ts",{
   action:"bootstrap",lessonNumber:"01",deviceId:b.account.storageDeviceId
  });
  assert.notEqual(wrong.status,200,"a signed session must not read a foreign device progress");
  assert.ok(!JSON.stringify(await wrong.json()).includes("PERSON48332"));
  const bOwn=await http(f,b.token,"api/course/route.ts",{action:"bootstrap",lessonNumber:"01"});
  assert.equal(bOwn.status,200,await bOwn.clone().text());
 }finally{f.close();}
});
test("V48 V2 devices: unapproved second device, expired entitlement and revoked session fail closed",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const m=await activateManager(f,48340);
  const learner=await activate(f,m,48341,"learner","QA CLASS A");
  const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  const key=await crypto.subtle.exportKey("jwk",pair.publicKey);
  const second=await f.service.login({login:"fixture48341",password:pass(48341),publicKey:key},"qa-browser-2");
  await assert.rejects(()=>f.service.authorize(second.token),e=>e.code==="DEVICE_APPROVAL_REQUIRED");
  await assert.rejects(()=>f.service.approveDevice(second.token,second.deviceId,pass(48341),"unknown"),
    e=>e.code==="DEVICE_APPROVAL_REQUIRED");
  await f.service.approveDevice(learner.token,second.deviceId,pass(48341),"trusted");
  assert.equal((await f.service.authorize(second.token)).accountId,learner.account.accountId);
  f.sqlite.prepare("UPDATE account_entitlements SET state='active',expires_at='2000-01-01T00:00:00Z' WHERE account_id=?").run(learner.account.accountId);
  await assert.rejects(()=>f.service.authorize(learner.token),e=>e.code==="ACCOUNT_EXPIRED");
  f.sqlite.prepare("UPDATE account_entitlements SET expires_at='2099-01-01T00:00:00Z' WHERE account_id=?").run(learner.account.accountId);
  await f.service.revokeDevice(learner.token,second.deviceId);
  await assert.rejects(()=>f.service.session(second.token),e=>e.code==="SESSION_INVALID");
  assert.equal((await f.service.authorize(learner.token)).role,"learner");
 }finally{f.close();}
});
test("V48 Preview activation is isolated and never enables single-review on Production",()=>{
 const p=readFileSync(new URL("../wrangler.cloudflare.preview.example.jsonc",import.meta.url),"utf8");
 const cfg=JSON.parse(p);
 assert.equal(cfg.name,"boi-ech-preview");
 assert.equal(cfg.vars.BOI_ECH_ACCOUNT_V2,"true");
 assert.equal(cfg.vars.BOI_ECH_SINGLE_REVIEW,"true");
 const workflow=readFileSync(new URL("../../.github/workflows/deploy-boi-ech-preview.yml",import.meta.url),"utf8");
 assert.match(workflow,/NEXT_PUBLIC_BOI_ECH_SINGLE_REVIEW: "true"/);
 assert.match(workflow,/boiPreviewConfig\.vars\?\.BOI_ECH_SINGLE_REVIEW !== "true"/);
 assert.match(workflow,/environment: boi-ech-preview/);
 assert.doesNotMatch(workflow,/migrations apply boi-ech-db --remote/);
 const production=readFileSync(new URL("../../.github/workflows/deploy-cloudflare.yml",import.meta.url),"utf8");
 assert.doesNotMatch(production,/BOI_ECH_SINGLE_REVIEW: "true"/);
});
