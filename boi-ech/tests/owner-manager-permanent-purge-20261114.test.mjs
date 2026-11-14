import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {accountStack} from "./helpers/account-stack.mjs";

const owner={role:"owner",actor:"owner@manager-purge.fixture.invalid"};
async function registerManager(f,suffix){
 const policy=f.sqlite.prepare("SELECT revision FROM account_admission_limits WHERE person_role='manager'").get();
 const invite=await f.service.issueManagerInvite(owner,policy.revision);
 const key=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const publicKey=await crypto.subtle.exportKey("jwk",key.publicKey);
 return f.service.registerManagerWithInvite({
  login:"test-manager-"+suffix,password:"Long manager fixture password "+suffix,
  role:"manager",privacyAccepted:true,contactType:"email",
  contactValue:"manager-"+suffix+"@fixture.invalid",
  publicKey,managerInviteToken:invite.inviteToken
 },"manager-purge-fixture");
}
const cleanupModule=(f)=>f.load("owner-account-cleanup.server.ts");
const preview=(f)=>cleanupModule(f).inspectCleanup(f.db,owner,{mode:"manager",days:0});
const purge=(f,r,override={})=>cleanupModule(f).purgeCleanupAccount(f.db,owner,{
 mode:"manager",days:0,accountId:r.accountId,snapshot:r.snapshot,
 confirmation:"XOA TAI KHOAN",reason:"Owner xác nhận xóa tài khoản cán bộ cũ không có dữ liệu",...override
});
const noSession=(f,id)=>f.sqlite.prepare("UPDATE account_sessions SET revoked=1 WHERE account_id=?").run(id);

test("Owner can permanently delete TWO specifically selected unactivated managers in fresh D1 without age rule",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const first=await registerManager(f,"old1"),second=await registerManager(f,"old2");
  for(const r of [first,second])noSession(f,r.account.accountId);
  const scan=await preview(f);
  assert.equal(scan.contract,"boi-owner-manager-purge.v1");
  assert.equal(scan.days,0);assert.equal(scan.mode,"manager");
  assert.equal(scan.eligible,2);
  for(const r of [first,second]){
   const selected=scan.records.find(p=>p.accountId===r.account.accountId);
   assert.equal(selected.eligible,true);
   const done=await purge(f,selected);
   assert.equal(done.contract,"boi-owner-manager-purge.v1");
   assert.equal(done.deleted,true);
   assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM accounts WHERE account_id=?").get(r.account.accountId).n,0);
   assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM device_access WHERE device_id=?").get(r.account.storageDeviceId).n,0);
   assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM account_contacts WHERE account_id=?").get(r.account.accountId).n,0);
   assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM account_devices WHERE account_id=?").get(r.account.accountId).n,0);
  }
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM accounts").get().n,0);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM account_audit WHERE action='owner.account.cleanup-purge'").get().n,2);
 }finally{f.close();}
});
test("Owner manager cleanup never permits deletion of activated active manager or nonmanager, even with identical display names",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const old=await registerManager(f,"duplicate-name");
  noSession(f,old.account.accountId);
  const active=await registerManager(f,"active");
  await f.flow.completeProfileWithoutReview(active.token,{
   familyName:"Nguyen Dinh",givenName:"Nam",facultyUnit:"School",
   jobTitle:"Manager",jobPosition:"Director",expectedRevision:1
  });
  const student=await f.register(8902,"learner");
  const scan=await preview(f);
  assert.equal(scan.records.some(p=>p.accountId===student.account.accountId),false);
  assert.equal(scan.records.find(p=>p.accountId===old.account.accountId).eligible,true);
  const current=scan.records.find(p=>p.accountId===active.account.accountId);
  assert.equal(current.eligible,false);
  assert.equal(current.role,"manager");
  await assert.rejects(()=>purge(f,current),e=>e.code==="CLEANUP_ELIGIBILITY_CHANGED");
  assert.equal((await f.service.ownerRead(active.account.accountId)).role,"manager");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM accounts").get().n,3);
 }finally{f.close();}
});
test("Owner may remove archived/blocked manager only after sessions revoked and no substantive records exist",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const archived=await registerManager(f,"archived");
  const id=archived.account.accountId;
  const before=f.sqlite.prepare("SELECT revision FROM accounts WHERE account_id=?").get(id).revision;
  await f.service.archiveManager(owner,{accountId:id,expectedRevision:before,reason:"Owner gỡ quyền cán bộ cũ để thử nghiệm xóa sạch",confirmation:id});
  const r=(await preview(f)).records.find(x=>x.accountId===id);
  assert.equal(r?.eligible,true);
  const result=await purge(f,r);
  assert.equal(result.deleted,true);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM accounts WHERE account_id=?").get(id).n,0);
 }finally{f.close();}
});
test("Owner manager cleanup refuses unrevoked active session, stale revision, learning progress and payment proof",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const login=await registerManager(f,"session");
  const pending=(await preview(f)).records.find(x=>x.accountId===login.account.accountId);
  assert.equal(pending.eligible,false);
  assert.ok(pending.blockers.some(b=>b.includes("Phiên đăng nhập")));
  noSession(f,login.account.accountId);
  const eligible=(await preview(f)).records.find(x=>x.accountId===login.account.accountId);
  assert.equal(eligible.eligible,true);
  f.sqlite.prepare("UPDATE accounts SET revision=revision+1 WHERE account_id=?").run(login.account.accountId);
  await assert.rejects(()=>purge(f,eligible),e=>e.code==="CLEANUP_ELIGIBILITY_CHANGED");
  const current=(await preview(f)).records.find(x=>x.accountId===login.account.accountId);
  f.sqlite.prepare("UPDATE device_profiles SET total_active_seconds=100 WHERE device_id=?").run(login.account.storageDeviceId);
  await assert.rejects(()=>purge(f,current),e=>e.code==="CLEANUP_ELIGIBILITY_CHANGED");
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM accounts WHERE account_id=?").get(login.account.accountId).n,1);
  const payment=await registerManager(f,"payment");
  noSession(f,payment.account.accountId);
  f.sqlite.prepare("UPDATE device_access SET payment_status='paid_verified' WHERE device_id=?").run(payment.account.storageDeviceId);
  const protectedRow=(await preview(f)).records.find(x=>x.accountId===payment.account.accountId);
  assert.equal(protectedRow.eligible,false);
  assert.ok(protectedRow.blockers.some(x=>x.includes("thanh toán")));
 }finally{f.close();}
});
test("Manager purge uses Owner HMAC and per-record snapshot; no blanket DELETE in endpoint",()=>{
 const route=readFileSync(new URL("../app/api/control/v2/manager-purge/route.ts",import.meta.url),"utf8");
 const source=readFileSync(new URL("../app/owner-account-cleanup.server.ts",import.meta.url),"utf8");
 assert.match(route,/requireControlService\(request,"account-owner"\)/);
 assert.match(route,/mode:"manager",days:0/);
 assert.match(source,/OWNER_REQUIRED/);
 assert.match(source,/account_audit/);
 assert.match(source,/CLEANUP_CONFIRMATION_REQUIRED/);
 assert.match(source,/DELETE FROM accounts WHERE account_id=\? AND revision=\?/);
 assert.doesNotMatch(source,/DELETE FROM account_audit/);
});
