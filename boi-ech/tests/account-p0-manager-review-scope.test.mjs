import test from "node:test";
import assert from "node:assert/strict";
import {accountStack} from "./helpers/account-stack.mjs";

const profile=n=>({familyName:"Synthetic",givenName:"Owner-tested",personCode:"TEST"+n,
 className:"Group A",phone:"090"+String(n).padStart(7,"0"),facultyUnit:"Training Department",jobTitle:"Instructor",jobPosition:"Unit Manager"});

async function activateManager(f,n){
 const user=await f.register(n,"manager");
 await f.flow.firstReview({kind:"owner",actor:"owner@fixture.invalid"},user.account.accountId,1);
 await f.flow.submitProfile(user.token,{...profile(n),expectedRevision:2});
 const approved=await f.service.ownerCommand({role:"owner",actor:"owner@fixture.invalid"},
 {accountId:user.account.accountId,operation:"approve-manager",expectedRevision:0});
 assert.equal(approved.status,"approved");
 return user;
}
test("P0 reviewer board: only learners/teachers, not manager requests, are visible to managers",async()=>{
 const f=accountStack({v2:true});
 try{
  const reviewer=await activateManager(f,910);
  const pendingTeacher=await f.register(911,"teacher");
  const pendingManager=await f.register(912,"manager");
  const result=await f.service.reviewBoard(reviewer.token);
  const ids=result.devices.map(d=>d.accountId);
  assert.ok(ids.includes(pendingTeacher.account.accountId));
  assert.ok(!ids.includes(pendingManager.account.accountId));
 }finally{f.close()}
});
test("Manager shared roster shows the same learner after another manager first reviews",async()=>{
 const f=accountStack({v2:true});
 try{
  const first=await activateManager(f,920);
  const other=await activateManager(f,921);
  const learner=await f.register(922,"learner");
  assert.ok((await f.service.reviewBoard(first.token)).devices.some(x=>x.accountId===learner.account.accountId));
  assert.ok((await f.service.reviewBoard(other.token)).devices.some(x=>x.accountId===learner.account.accountId));
  await f.flow.firstReview({kind:"manager",token:first.token},learner.account.accountId,1);
  const own=(await f.service.reviewBoard(first.token)).devices.find(x=>x.accountId===learner.account.accountId);
  const foreign=(await f.service.reviewBoard(other.token)).devices.find(x=>x.accountId===learner.account.accountId);
  assert.equal(own.onboardingStage,"profile_required");
  assert.equal(foreign?.onboardingStage,"profile_required");
  assert.equal(foreign?.accountId,own.accountId);
  assert.equal(foreign?.firstReviewMine,false);
 }finally{f.close()}
});
