import test from "node:test";
import assert from "node:assert/strict";
import {accountStack} from "./helpers/account-stack.mjs";
const owner={actor:"owner@fixture.invalid",role:"owner"};
function fixture(f,char,ageDays,{role="learner",approve=true,mapped=false,paid=false}={}){
 const id=char.repeat(64);
 f.sqlite.prepare(`INSERT INTO device_access(
  device_id,display_code,public_key_jwk,status,person_role,
  registration_submitted_at,approved_at,created_at,payment_status)
  VALUES(?,?,?,'approved',?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,datetime('now',?),?)`)
 .run(id,"BE-"+char,"{}",role,"-"+ageDays+" days",paid?"paid_verified":"free_approved");
 if(approve)f.sqlite.prepare(`INSERT INTO course_audit_log(actor,action,target,detail_json)
  VALUES('owner@fixture.invalid','learning_device_free_approved',?,'{}')`).run(id);
 if(mapped)f.sqlite.prepare("INSERT INTO accounts(account_id,storage_device_id) VALUES(?,?)")
  .run("acc_"+id,id);
 return id;
}

test("Owner can atomically purge proven legacy learners older than 5 days and free phone/device; never modern/recent",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const old=fixture(f,"a",6,{mapped:true});
  const oldTeacher=fixture(f,"b",7,{role:"teacher"});
  const recent=fixture(f,"c",4);
  const auditless=fixture(f,"d",10,{approve:false});
  const modern=await f.register(96301,"learner");
  const svc=f.load("owner-legacy-bulk-purge.server.ts");
  const preview=await svc.previewLegacyFiveDayPurge(f.db,owner);
  assert.equal(preview.totalMatched,2);
  assert.equal(preview.eligible,2);
  assert.equal(preview.batchSize,2);
  const out=await svc.executeLegacyFiveDayPurge(f.db,owner,{
   confirmation:"XOA TAI KHOAN CU TREN 5 NGAY",
   snapshot:preview.snapshot,reason:"Owner authorized old legacy cohort cleanup"});
  assert.equal(out.applied,true);
  assert.equal(out.deleted,2);assert.equal(out.remaining,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM device_access WHERE device_id IN (?,?)")
   .get(old,oldTeacher).n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM accounts WHERE account_id=?")
   .get("acc_"+old).n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM account_audit WHERE action='owner.legacy-five-day-purge'").get().n,2);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM device_access WHERE device_id IN (?,?)")
   .get(recent,auditless).n,2);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM accounts WHERE account_id=?")
   .get(modern.account.accountId).n,1);
 }finally{f.close();}
});

test("payment and other protected legacy records cannot be silently bulk-deleted",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const protectedId=fixture(f,"e",7,{paid:true});
  const svc=f.load("owner-legacy-bulk-purge.server.ts");
  const p=await svc.previewLegacyFiveDayPurge(f.db,owner);
  assert.equal(p.eligible,0);assert.equal(p.protected,1);
  assert.equal(p.protectedByReason.payment,1);
  const out=await svc.executeLegacyFiveDayPurge(f.db,owner,{
   confirmation:"XOA TAI KHOAN CU TREN 5 NGAY",
   snapshot:p.snapshot,reason:"Protected records must remain until reviewed"});
  assert.equal(out.applied,false);assert.equal(out.deleted,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM device_access WHERE device_id=?")
   .get(protectedId).n,1);
 }finally{f.close();}
});

test("missing Owner role, invalid confirmation and stale snapshot fail without deletion",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const id=fixture(f,"f",8);
  const svc=f.load("owner-legacy-bulk-purge.server.ts");
  await assert.rejects(()=>svc.previewLegacyFiveDayPurge(f.db,{actor:"manager@fixture.invalid",role:"manager"}),
   e=>e.code==="OWNER_REQUIRED");
  const p=await svc.previewLegacyFiveDayPurge(f.db,owner);
  await assert.rejects(()=>svc.executeLegacyFiveDayPurge(f.db,owner,{
   confirmation:"XOA",snapshot:p.snapshot,reason:"Owner cleanup request"}),e=>e.code==="LEGACY_CLEANUP_CONFIRMATION_REQUIRED");
  f.sqlite.prepare("UPDATE device_access SET status='blocked' WHERE device_id=?").run(id);
  await assert.rejects(()=>svc.executeLegacyFiveDayPurge(f.db,owner,{
   confirmation:"XOA TAI KHOAN CU TREN 5 NGAY",
   snapshot:p.snapshot,reason:"Owner cleanup request"}),e=>e.code==="LEGACY_CLEANUP_STATE_CHANGED");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM device_access WHERE device_id=?")
   .get(id).n,1);
 }finally{f.close();}
});

test("legacy course profile is removed only when its source is not shared",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const solo=fixture(f,"8",8);
  const sharedOne=fixture(f,"9",8);
  const sharedTwo=fixture(f,"a",8);
  f.sqlite.prepare("UPDATE device_access SET migrated_from_user_key='solo-old' WHERE device_id=?").run(solo);
  f.sqlite.prepare("UPDATE device_access SET migrated_from_user_key='shared-old' WHERE device_id IN (?,?)")
   .run(sharedOne,sharedTwo);
  f.sqlite.prepare("INSERT INTO course_profiles(user_key,device_hash) VALUES('solo-old','hash-1')").run();
  f.sqlite.prepare("INSERT INTO course_profiles(user_key,device_hash) VALUES('shared-old','hash-2')").run();
  const svc=f.load("owner-legacy-bulk-purge.server.ts");
  const pre=await svc.previewLegacyFiveDayPurge(f.db,owner);
  assert.equal(pre.totalMatched,3);
  assert.equal(pre.eligible,1);
  assert.equal(pre.protected,2);
  assert.equal(pre.protectedByReason.sharedLegacyProfiles,2);
  const out=await svc.executeLegacyFiveDayPurge(f.db,owner,{
   confirmation:"XOA TAI KHOAN CU TREN 5 NGAY",snapshot:pre.snapshot,
   reason:"Remove independent old learner profile only"});
  assert.equal(out.deleted,1);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM course_profiles WHERE user_key='solo-old'").get().n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM course_profiles WHERE user_key='shared-old'").get().n,1);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM device_access WHERE device_id IN (?,?)")
   .get(sharedOne,sharedTwo).n,2);
 }finally{f.close();}
});

test("manager-reviewed history remains protected even when assignment was later removed",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const id=fixture(f,"c",9);
  f.sqlite.prepare(`INSERT INTO course_audit_log(actor,action,target,detail_json)
    VALUES('manager@fixture.invalid','manager_device_approved',?,'{}')`).run(id);
  const service=f.load("owner-legacy-bulk-purge.server.ts");
  const p=await service.previewLegacyFiveDayPurge(f.db,owner);
  assert.equal(p.totalMatched,0);
  assert.equal(p.eligible,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM device_access WHERE device_id=?")
   .get(id).n,1);
 }finally{f.close();}
});
