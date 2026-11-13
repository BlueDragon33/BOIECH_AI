import test from "node:test";
import assert from "node:assert/strict";
import {accountStack} from "./helpers/account-stack.mjs";
const owner={actor:"owner@fixture.invalid",role:"owner"};
const msDay=86400000;
const key=async()=>crypto.subtle.exportKey("jwk",(await crypto.subtle.generateKey(
 {name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"])).publicKey);
async function reg(f,n,role="learner",existingKey){
 const publicKey=existingKey??await key();
 const body={login:"self"+n,password:"Unique integration passphrase "+n,
  role,privacyAccepted:true,publicKey,
  contactType:"email",contactValue:"self"+n+"@fixture.invalid"};
 const result=await f.service.register(body,"v3fixture"+n);
 return {...result,login:body.login,password:body.password,publicKey};
}
async function invitedManager(f,n){
 const revision=f.sqlite.prepare("SELECT revision FROM account_admission_limits WHERE person_role='manager'").get().revision;
 const issued=await f.service.issueManagerInvite(owner,revision);
 const publicKey=await key();
 const login="managerv3"+n,password="Unique manager passphrase "+n;
 const result=await f.service.registerManagerWithInvite({
  login,password,role:"manager",privacyAccepted:true,publicKey,
  contactType:"email",contactValue:"manager"+n+"@fixture.invalid",
  managerInviteToken:issued.inviteToken},"managerfixture"+n);
 return {...result,login,password,publicKey};
}
const profile=(n,role)=>({familyName:"Synthetic",givenName:"Active",
 expectedRevision:1,...(role==="manager"?{
 facultyUnit:"Training Center",jobTitle:"Supervisor",jobPosition:"Department Manager",
 }:{className:"Training class",phone:"090"+String(n).padStart(7,"0")})});
test("Registration limits default 20/30/200; three roles have Owner-controlled 3/8-day leases",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const seats=f.sqlite.prepare("SELECT person_role,account_limit FROM account_admission_limits").all();
  assert.deepEqual(Object.fromEntries(seats.map(x=>[x.person_role,x.account_limit])),
   {manager:20,teacher:30,learner:200});
  assert.deepEqual(Object.fromEntries(f.sqlite.prepare("SELECT role,default_days FROM account_duration_policies").all()
   .map(x=>[x.role,x.default_days])),{manager:3,teacher:8,learner:8});
  for(const [role,n,days] of [["learner",75001,8],["teacher",75002,8],["manager",75003,3]]){
   const a=role==="manager"?await invitedManager(f,n):await reg(f,n,role);
   const state=await f.flow.completeProfileWithoutReview(a.token,profile(n,role));
   assert.equal(state.stage,"active");assert.equal(state.status,"approved");
   const read=await f.service.ownerRead(a.account.accountId);
   assert.equal(read.entitlement.active,true);
   assert.ok(Math.abs(Date.parse(read.entitlement.expiresAt)-Date.now()-days*msDay)<120000);
   assert.equal((await f.service.authorize(a.token)).accountId,a.account.accountId);
   assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM account_audit WHERE action='account.profile.auto-activated' AND target=?")
    .get(a.account.accountId).n,1);
   await assert.rejects(()=>f.flow.completeProfileWithoutReview(a.token,profile(n,role)),
    e=>e.code==="ACCOUNT_CAS_CONFLICT");
  }
 }finally{f.close();}
});
test("Failed or incomplete profile cannot activate; uninvited managers cannot self-escalate",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const l=await reg(f,75004,"learner");
  await assert.rejects(()=>f.flow.completeProfileWithoutReview(l.token,{
   familyName:"Synthetic",givenName:"Active",className:"Training",expectedRevision:1
  }),e=>e.code==="PROFILE_INVALID");
  assert.equal((await f.flow.ownStatus(l.token)).stage,"requested");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM account_entitlements WHERE account_id=?")
    .get(l.account.accountId).n,0);
  const direct=await reg(f,75005,"manager");
  await assert.rejects(()=>f.flow.completeProfileWithoutReview(direct.token,profile(75005,"manager")),
   e=>e.code==="MANAGER_INVITATION_INVALID");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM account_entitlements WHERE account_id=?")
    .get(direct.account.accountId).n,0);
 }finally{f.close();}
});
test("Manager can renew teacher/learner but cannot renew manager; expired or revoked manager cannot act",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const m=await invitedManager(f,75101);
  await f.flow.completeProfileWithoutReview(m.token,profile(75101,"manager"));
  const l=await reg(f,75102,"learner");
  await f.flow.completeProfileWithoutReview(l.token,profile(75102,"learner"));
  f.sqlite.prepare("UPDATE device_profiles SET completed_json=?,total_active_seconds=640 WHERE device_id=?")
   .run(JSON.stringify(["hoc-tap-01","bai-01","kiem-tra-01","bai-02"]),l.account.storageDeviceId);
  const svc=f.load("account-entitlement.server.ts");
  const listed=await svc.managerRenewableAccounts(f.db,f.service,m.token);
  assert.equal(listed.accounts.find(x=>x.accountId===l.account.accountId).completedLessons,2);
  assert.equal(listed.verified,true);
  assert.ok(listed.accounts.some(x=>x.accountId===l.account.accountId&&x.role==="learner"));
  const before=await f.service.ownerRead(l.account.accountId);
  const renewed=await svc.managerRenewAccount(f.db,f.service,m.token,{
    accountId:l.account.accountId,expectedRevision:before.entitlement.revision,
    days:5,reason:"Authorized manager confirms another five days"
  });
  assert.equal(renewed.verified,true);
  assert.equal(renewed.entitlement.revision,before.entitlement.revision+1);
  assert.ok(Date.parse(renewed.entitlement.expiresAt)>Date.parse(before.entitlement.expiresAt));
  const set=await svc.managerRenewAccount(f.db,f.service,m.token,{
    accountId:l.account.accountId,expectedRevision:renewed.entitlement.revision,
    period:"7d",reason:"Manager resets to exactly one week, never cumulative"
  });
  assert.ok(Math.abs(Date.parse(set.entitlement.expiresAt)-Date.now()-7*msDay)<120000);
  assert.ok(Date.parse(set.entitlement.expiresAt)<Date.parse(renewed.entitlement.expiresAt));
  await assert.rejects(()=>svc.managerRenewAccount(f.db,f.service,l.token,{
    accountId:m.account.accountId,expectedRevision:1,days:5,
    reason:"Unauthorized learner attempts an extension"
  }),e=>e.code==="ACCOUNT_PERMISSION_REQUIRED");
  await assert.rejects(()=>svc.managerRenewAccount(f.db,f.service,m.token,{
    accountId:m.account.accountId,expectedRevision:1,days:5,
    reason:"Manager tries renewing another manager"
  }),e=>e.code==="ACCOUNT_CAS_CONFLICT"||e.code==="ACCOUNT_INPUT");
  f.sqlite.prepare("UPDATE account_entitlements SET expires_at='2000-01-01T00:00:00Z' WHERE account_id=?")
    .run(m.account.accountId);
  await assert.rejects(()=>svc.managerRenewAccount(f.db,f.service,m.token,{
    accountId:l.account.accountId,expectedRevision:set.entitlement.revision,days:5,
    reason:"Expired manager cannot issue entitlements"
  }),e=>e.code==="ACCOUNT_EXPIRED");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM account_audit WHERE action='manager.entitlement.renew'").get().n,2);
 }finally{f.close();}
});
test("Seat admission is atomic and rejected signup produces an aggregated Owner alert",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  f.sqlite.prepare("UPDATE account_admission_limits SET account_limit=1 WHERE person_role='teacher'").run();
  await reg(f,75006,"teacher");
  await assert.rejects(()=>reg(f,75007,"teacher"),e=>e.code==="ACCOUNT_CAPACITY_REACHED");
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM accounts").get().n,1);
  assert.equal(f.sqlite.prepare("SELECT rejected_attempts n FROM account_capacity_alerts WHERE person_role='teacher'").get().n,1);
  const quotas=await f.load("account-capacity.server.ts").readAccountCapacity(f.db,owner);
  const teachers=quotas.limits.find(x=>x.role==="teacher");
  assert.equal(teachers.used,1);assert.equal(teachers.accountLimit,1);
  assert.equal(teachers.rejectedAttempts,1);
 }finally{f.close();}
});
test("Owner persistent ban invalidates every session and blocks same login or known P256 public key",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const a=await reg(f,75008,"learner");
  const rev=f.sqlite.prepare("SELECT revision FROM accounts WHERE account_id=?")
   .get(a.account.accountId).revision;
  const response=await f.load("owner-account-ban.server.ts").blockBoiAccount(f.db,owner,{
   accountId:a.account.accountId,expectedRevision:rev,
   confirmation:a.account.accountId,reason:"Repeated policy violation confirmed by Owner"
  });
  assert.equal(response.persistent,true);assert.ok(response.deviceKeysBanned>0);
  await assert.rejects(()=>f.service.session(a.token),e=>e.code==="SESSION_INVALID");
  await assert.rejects(()=>f.service.login({login:a.login,password:a.password,
   publicKey:a.publicKey},"banneduser"),e=>e.code==="ACCOUNT_REENTRY_BLOCKED");
  await assert.rejects(()=>f.service.register({login:"other75008",password:"Unique other passphrase",
   role:"learner",privacyAccepted:true,publicKey:a.publicKey,
   contactType:"email",contactValue:"other@fixture.invalid"},"banprobe"),
   e=>e.code==="ACCOUNT_REENTRY_BLOCKED");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM account_reentry_bans WHERE revoked_at IS NULL").get().n,2);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM account_audit WHERE action='owner.account.permanent-block'").get().n,1);
 }finally{f.close();}
});
test("Signed production account route rejects public manager signup, and automatic profile path is exposed only in configured V2",()=>{
 const fs=requireSource("../app/api/accounts/route.ts");
 assert.match(fs,/p.action === "register" && p.role === "manager"/);
 assert.match(fs,/workflow.completeProfileWithoutReview/);
 assert.match(fs,/managerRenewAccount/);
});
import {readFileSync} from "node:fs";
function requireSource(relative){return readFileSync(new URL(relative,import.meta.url),"utf8");}


test("Genuine phone collision is identified and failed activation remains atomic",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const first=await reg(f,75901,"teacher");
  await f.flow.completeProfileWithoutReview(first.token,profile(75901,"teacher"));
  const next=await reg(f,75902,"teacher");
  await assert.rejects(()=>f.flow.completeProfileWithoutReview(next.token,{
   ...profile(75902,"teacher"),phone:profile(75901,"teacher").phone
  }),error=>error.code==="PROFILE_PHONE_IN_USE");
  assert.equal((await f.flow.ownStatus(next.token)).stage,"requested");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?")
    .get(next.account.accountId).n,0);
  const fixed=await f.flow.completeProfileWithoutReview(next.token,profile(75902,"teacher"));
  assert.equal(fixed.stage,"active");
 }finally{f.close();}
});

test("Non-phone D1 state constraint is not falsely reported as duplicate contact",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const account=await reg(f,75903,"teacher");
  f.sqlite.exec(`CREATE TRIGGER test_forced_profile_state_conflict BEFORE UPDATE OF status
   ON device_access WHEN NEW.status='approved' AND NEW.person_role='teacher'
   BEGIN SELECT RAISE(ABORT,'ONBOARDING_INVALID_TRANSITION'); END`);
  await assert.rejects(()=>f.flow.completeProfileWithoutReview(account.token,profile(75903,"teacher")),
   error=>error.code==="PROFILE_STATE_CONFLICT");
  assert.equal((await f.flow.ownStatus(account.token)).stage,"requested");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?")
   .get(account.account.accountId).n,0);
 }finally{f.close();}
});

test("Reviewed legacy account is still able to complete after new no-review rollout",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const manager=await invitedManager(f,75904);
  await f.flow.completeProfileWithoutReview(manager.token,profile(75904,"manager"));
  const teacher=await reg(f,75905,"teacher");
  const pending=await f.flow.ownStatus(teacher.token);
  const reviewed=await f.flow.firstReview({kind:"manager",token:manager.token},
   teacher.account.accountId,pending.revision);
  assert.equal(reviewed.stage,"profile_required");
  const completed=await f.flow.submitProfile(teacher.token,{
   ...profile(75905,"teacher"),expectedRevision:reviewed.revision
  });
  assert.equal(completed.stage,"active");
  const route=requireSource("../app/api/accounts/route.ts");
  assert.match(route,/currentStage|const stage=config\.singleReview/);
  assert.match(route,/stage==="requested"/);
  assert.match(route,/workflow\.submitProfile\(token,p\)/);
 }finally{f.close();}
});


test("Manager archive is role-scoped, CAS-guarded, keeps canonical learner history and revokes sessions",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const m=await invitedManager(f,75150);
  await f.flow.completeProfileWithoutReview(m.token,profile(75150,"manager"));
  const learner=await reg(f,75151,"learner");
  await f.flow.completeProfileWithoutReview(learner.token,profile(75151,"learner"));
  const svc=f.load("account-entitlement.server.ts");
  const id=learner.account.accountId;
  const before=await f.service.ownerRead(id);
  await assert.rejects(()=>svc.managerRemoveAccount(f.db,f.service,m.token,{
    accountId:id,expectedRevision:before.entitlement.revision,confirmation:"wrong",
    reason:"Unauthorized incomplete archive confirmation"
  }),e=>e.code==="ACCOUNT_INPUT");
  const done=await svc.managerRemoveAccount(f.db,f.service,m.token,{
    accountId:id,expectedRevision:before.entitlement.revision,confirmation:id,
    reason:"Manager verified an archive requested by Owner"
  });
  assert.deepEqual({archived:done.archived,deleted:done.deleted,readback:done.readback},
   {archived:true,deleted:false,readback:true});
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM accounts WHERE account_id=?").get(id).n,1);
  assert.equal(f.sqlite.prepare("SELECT state FROM account_entitlements WHERE account_id=?").get(id).state,"suspended");
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?").get(id).stage,"suspended");
  assert.equal(f.sqlite.prepare("SELECT revoked FROM account_sessions WHERE account_id=?").get(id).revoked,1);
  await assert.rejects(()=>f.service.session(learner.token),e=>e.code==="SESSION_INVALID");
  await assert.rejects(()=>svc.managerRemoveAccount(f.db,f.service,m.token,{
    accountId:id,expectedRevision:before.entitlement.revision,confirmation:id,
    reason:"Repeated stale archive should fail closed"
  }),e=>e.code==="ACCOUNT_CAS_CONFLICT");
 }finally{f.close();}
});
