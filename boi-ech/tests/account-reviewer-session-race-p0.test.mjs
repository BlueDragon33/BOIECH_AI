import test from "node:test";
import assert from "node:assert/strict";
import {accountStack} from "./helpers/account-stack.mjs";

async function setup(seed){
 const f=accountStack({v2:true,singleReview:true});
 const manager=await f.register(seed,"manager");
 await f.flow.firstReview({kind:"owner",actor:"owner@fixture.invalid"},manager.account.accountId,1);
 await f.flow.submitProfile(manager.token,{
  familyName:"Signed",givenName:"Reviewer",facultyUnit:"Authorized unit",
  jobTitle:"Trainer",jobPosition:"Coordinator",expectedRevision:2
 });
 const learner=await f.register(seed+1,"learner");
 const session=await f.service.authorize(manager.token);
 return {f,manager,learner,session};
}
async function race(seed,change){
 const {f,manager,learner,session}=await setup(seed);
 try{
  const previous=f.db.batch.bind(f.db);
  let executed=false;
  f.db.batch=async queries=>{
   if(!executed){executed=true;change(f,manager,session);}
   return previous(queries);
  };
  await assert.rejects(
    ()=>f.flow.firstReview({kind:"manager",token:manager.token},learner.account.accountId,1),
    e=>e?.code==="ACCOUNT_CAS_CONFLICT"&&e.status===409,
    "a reviewer whose security proof changed before D1 UPDATE must not approve"
  );
  assert.equal(executed,true,"injected revocation immediately before transaction");
  const state=f.sqlite.prepare("SELECT stage,revision,first_review_by FROM account_onboarding WHERE account_id=?")
   .get(learner.account.accountId);
  assert.equal(state.stage,"requested");
  assert.equal(state.revision,1);
  assert.equal(state.first_review_by,null);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit WHERE target=? AND action='account.review.first'")
   .get(learner.account.accountId).n,0);
 }finally{f.close()}
}

test("P0 auth race: revoked session between capability and commit cannot approve learner",async()=>race(9801,(f,m,p)=>{
 f.sqlite.prepare("UPDATE account_sessions SET revoked=1 WHERE token_hash=?").run(p.sessionHash);
}));
test("P0 auth race: untrusted linked reviewer device cannot approve after preflight",async()=>race(9811,(f,m,p)=>{
 f.sqlite.prepare("UPDATE account_devices SET approved=0 WHERE account_id=? AND device_id=?")
  .run(m.account.accountId,p.deviceId);
}));
test("P0 auth race: changed password generation invalidates reviewer before D1 CAS",async()=>race(9821,(f,m)=>{
 f.sqlite.prepare("UPDATE account_credentials SET generation=generation+1 WHERE account_id=?").run(m.account.accountId);
}));
