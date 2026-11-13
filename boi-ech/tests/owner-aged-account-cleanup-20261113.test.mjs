import test from "node:test";
import assert from "node:assert/strict";
import {accountStack} from "./helpers/account-stack.mjs";
import {readFileSync} from "node:fs";
const owner={role:"owner",actor:"owner@fixture.invalid"};
const day=86400000,iso=ms=>new Date(ms).toISOString().slice(0,19).replace("T"," ");
function aged(f,account,days,now=Date.now()){
 const created=iso(now-days*day),login=now-days*day+1000;
 f.sqlite.prepare("UPDATE accounts SET created_at=? WHERE account_id=?")
  .run(created,account.account.accountId);
 f.sqlite.prepare("UPDATE device_access SET last_seen_at=? WHERE device_id=(SELECT storage_device_id FROM accounts WHERE account_id=?)")
  .run(created,account.account.accountId);
 f.sqlite.prepare("UPDATE account_sessions SET issued_at_ms=?,expires_at=?,idle_expires_at=? WHERE account_id=?")
  .run(login,login+8*3600000,login+30*60000,account.account.accountId);
}
async function fixture(id){const f=accountStack({v2:true,singleReview:true});const a=await f.register(id);aged(f,a,10);return {f,a};}
const preview=(f,mode="pending",days=7)=>f.load("owner-account-cleanup.server.ts").inspectCleanup(f.db,owner,{mode,days});
const purge=(f,a,record,extra={})=>f.load("owner-account-cleanup.server.ts").purgeCleanupAccount(f.db,owner,{
 action:"purge",mode:"pending",days:7,accountId:a.account.accountId,
 confirmation:"XOA TAI KHOAN",reason:"Owner confirms obsolete unapproved enrollment",
 snapshot:record.snapshot,...extra});
test("Owner previews aged unapproved, unused account and hard deletes canonical account+storage but retains immutable audit",async()=>{
 const {f,a}=await fixture(70101);try{
  const out=await preview(f);
  assert.equal(out.verified,true);
  assert.equal(out.contract,"boi-owner-account-cleanup.v1");
  const record=out.records.find(x=>x.accountId===a.account.accountId);
  assert.ok(record);assert.equal(record.eligible,true);
  const result=await purge(f,a,record);
  assert.equal(result.deleted,true);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM accounts WHERE account_id=?").get(a.account.accountId).n,0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM device_access WHERE device_id=?").get(a.account.storageDeviceId).n,0);
  assert.equal(f.sqlite.prepare("PRAGMA foreign_key_check").all().length,0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM account_audit WHERE action='owner.account.cleanup-purge' AND target=?").get(result.accountHash).n,1);
  await assert.rejects(()=>purge(f,a,record),e=>e.code==="CLEANUP_NOT_FOUND");
 }finally{f.close();}
});
test("Recent accounts, active sessions and stored progress cannot be bulk-purged",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const recent=await f.register(70102);
  const old=await f.register(70103);aged(f,old,12);
  // Re-issue an active session, while preserving old registration metadata.
  f.sqlite.prepare("UPDATE account_sessions SET issued_at_ms=?,expires_at=?,idle_expires_at=? WHERE account_id=?")
   .run(Date.now(),Date.now()+8*3600000,Date.now()+30*60000,old.account.accountId);
  let out=await preview(f);
  assert.equal(out.records.some(x=>x.accountId===recent.account.accountId),false);
  assert.equal(out.records.some(x=>x.accountId===old.account.accountId),false,
   "recent login cannot be misread as inactivity");
  const third=await f.register(70104);aged(f,third,11);
  f.sqlite.prepare("UPDATE device_profiles SET total_active_seconds=120 WHERE device_id=?")
   .run(third.account.storageDeviceId);
  out=await preview(f);
  const item=out.records.find(x=>x.accountId===third.account.accountId);
  assert.ok(item);assert.equal(item.eligible,false);
  await assert.rejects(()=>purge(f,third,item),e=>e.code==="CLEANUP_ELIGIBILITY_CHANGED");
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM accounts WHERE account_id=?").get(third.account.accountId).n,1);
 }finally{f.close();}
});
test("Owner threshold switches 3,5,7 and strictly >7 days, with no background deletion",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const a=await f.register(70105);aged(f,a,6);
  assert.equal((await preview(f,"pending",3)).eligible,1);
  assert.equal((await preview(f,"pending",5)).eligible,1);
  assert.equal((await preview(f,"pending",7)).eligible,0);
  assert.equal((await preview(f,"pending",8)).eligible,0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM accounts").get().n,1);
  await assert.rejects(()=>f.load("owner-account-cleanup.server.ts").inspectCleanup(f.db,owner,{mode:"pending",days:9}),e=>e.code==="CLEANUP_INPUT");
 }finally{f.close();}
});
test("Inactive previously-approved account can be selected after 5 days; active user and approved teacher assignments are protected",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const a=await f.register(70107);aged(f,a,9);
  for(const stage of ["profile_required","profile_review","active"]){
   f.sqlite.prepare("UPDATE account_onboarding SET stage=? WHERE account_id=?").run(stage,a.account.accountId);
  }
  f.sqlite.prepare("UPDATE device_access SET status='approved' WHERE device_id=?")
   .run(a.account.storageDeviceId);
  const scan=await preview(f,"inactive",5);
  const chosen=scan.records.find(x=>x.accountId===a.account.accountId);
  assert.ok(chosen,"active-stage approved account older than five days must be selectable");
  assert.equal(chosen.category,"inactive");
  assert.equal(chosen.eligible,true);
  const svc=f.load("owner-account-cleanup.server.ts");
  const deleted=await svc.purgeCleanupAccount(f.db,owner,{
   action:"purge",mode:"inactive",days:5,accountId:a.account.accountId,
   confirmation:"XOA TAI KHOAN",reason:"Owner confirms inactive account contains no learning records",snapshot:chosen.snapshot
  });
  assert.equal(deleted.deleted,true);
 }finally{f.close();}
});
test("Stale preview, wrong confirmation and non-Owner proof never delete anything",async()=>{
 const {f,a}=await fixture(70106);try{
  const item=(await preview(f)).records[0];
  const svc=f.load("owner-account-cleanup.server.ts");
  await assert.rejects(()=>svc.purgeCleanupAccount(f.db,owner,{
   action:"purge",mode:"pending",days:7,accountId:a.account.accountId,
   confirmation:"WRONG",reason:"old unused account",snapshot:item.snapshot
  }),e=>e.code==="CLEANUP_CONFIRMATION_REQUIRED");
  await assert.rejects(()=>svc.purgeCleanupAccount(f.db,{role:"manager",actor:"manager@fixture.invalid"},{
   action:"purge",mode:"pending",days:7,accountId:a.account.accountId,
   confirmation:"XOA TAI KHOAN",reason:"old unused account",snapshot:item.snapshot
  }),e=>e.code==="OWNER_REQUIRED");
  f.sqlite.prepare("UPDATE accounts SET revision=revision+1 WHERE account_id=?").run(a.account.accountId);
  await assert.rejects(()=>purge(f,a,item),e=>e.code==="CLEANUP_ELIGIBILITY_CHANGED");
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM accounts").get().n,1);
 }finally{f.close();}
});
test("Account bulk API is signed Owner-only, uses no broad delete without per-record CAS",()=>{
 const route=readFileSync(new URL("../app/api/control/v2/account-cleanup/route.ts",import.meta.url),"utf8");
 const core=readFileSync(new URL("../app/owner-account-cleanup.server.ts",import.meta.url),"utf8");
 assert.match(route,/requireControlService\(request,"account-owner"\)/);
 assert.match(core,/CLEANUP_CONFIRMATION_REQUIRED/);
 assert.match(core,/owner\.account\.cleanup-purge/);
 assert.match(core,/account_audit/);
 assert.match(core,/DELETE FROM accounts WHERE account_id=\? AND revision=\?/);
 assert.doesNotMatch(core,/DELETE FROM account_audit/);
});
