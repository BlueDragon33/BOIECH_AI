import test from "node:test";
import assert from "node:assert/strict";
import {accountStack} from "./helpers/account-stack.mjs";
const owner={actor:"owner@fixture.invalid",role:"owner"};
const confirmation="XOA TAT CA TRU THIEN SON VA DONG NGHI";
const backup="00000001-00000000-00000001-"+'a'.repeat(32);
const runArgs=p=>({cutoff:p.cutoff,snapshot:p.snapshot,
 protectSon:p.protectedPeople[0].deviceId,protectNghi:p.protectedPeople[1].deviceId,
 confirmation,backupBookmark:backup,reason:"Owner one-time clean slate except exact two people"});
function insert(f,id,name,role="learner",paid=false){
 const device=id.repeat(64);
 f.sqlite.prepare(`INSERT INTO device_access(device_id,display_code,public_key_jwk,status,
  person_role,learner_name,created_at,registration_submitted_at,payment_status)
  VALUES(?,?,'{}','approved',?,?,datetime('now','-8 days'),CURRENT_TIMESTAMP,?)`)
 .run(device,"BE-TEST-"+id,role,name,paid?"paid_verified":"unassigned");
 return device;
}
function service(f){return f.load("owner-once-roster-reset.server.ts");}

test("one-time Owner reset erases learners/teachers but preserves exact Thiên Sơn and Đông Nghi",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const son=insert(f,"a","Nguyễn Thiên Sơn");
  const nghi=insert(f,"b","Trần Đông Nghi","teacher");
  const old=insert(f,"c","Old Teacher","teacher");
  const newAccount=await f.register(58110,"learner");
  const newId=newAccount.account.storageDeviceId;
  const m=service(f);
  const preview=await m.previewOwnerOnceRosterReset(f.db,owner);
  assert.equal(preview.state,"not_started");
  assert.equal(preview.totalLearnersTeachers,4);
  assert.equal(preview.candidates,2);
  assert.equal(preview.eligible,2);
  assert.deepEqual(preview.protectedPeople.map(x=>x.deviceId),[son,nghi]);
  const done=await m.executeOwnerOnceRosterReset(f.db,owner,runArgs(preview));
  assert.equal(done.deleted,2);
  assert.equal(done.state,"completed");
  assert.equal(done.protectedCount,2);
  assert.equal(done.remaining,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM device_access WHERE device_id IN (?,?)").get(old,newId).n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM device_access WHERE device_id IN (?,?)").get(son,nghi).n,2);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM accounts WHERE account_id=?").get(newAccount.account.accountId).n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM account_audit WHERE action='owner.once.roster-reset'").get().n,2);
  await assert.rejects(()=>m.executeOwnerOnceRosterReset(f.db,owner,runArgs(preview)),e=>e.code==="ROSTER_RESET_ALREADY_FINALIZED");
 }finally{f.close();}
});

test("a missing or ambiguous protected person prevents any deletion",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  insert(f,"d","Nguyễn Thiên Sơn");
  insert(f,"e","Old Learner");
  const m=service(f);
  await assert.rejects(()=>m.previewOwnerOnceRosterReset(f.db,owner),e=>e.code==="ROSTER_RESET_PROTECTED_AMBIGUOUS");
  insert(f,"f","Trần Đông Nghi");
  insert(f,"1","Vũ Thiên Sơn");
  await assert.rejects(()=>m.previewOwnerOnceRosterReset(f.db,owner),e=>e.code==="ROSTER_RESET_PROTECTED_AMBIGUOUS");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM account_one_time_roster_resets").get().n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM device_access").get().n,4);
 }finally{f.close();}
});

test("protected payment evidence and certificates are not deleted by ordinary roster reset",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  insert(f,"g","Phạm Thiên Sơn");insert(f,"h","Nguyễn Đông Nghi");
  const retention=insert(f,"i","Paid Teacher","teacher",true);
  const candidate=insert(f,"j","Empty Learner");
  const m=service(f);
  const preview=await m.previewOwnerOnceRosterReset(f.db,owner);
  assert.equal(preview.eligible,1);assert.equal(preview.retainedForReview,1);
  assert.equal(preview.blockers.payment,1);
  const done=await m.executeOwnerOnceRosterReset(f.db,owner,runArgs(preview));
  assert.equal(done.deleted,1);assert.equal(done.state,"retention_review");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM device_access WHERE device_id=?").get(retention).n,1);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM device_access WHERE device_id=?").get(candidate).n,0);
 }finally{f.close();}
});

test("invalid backup confirmation or wrong protected ID is rejected before writing",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  insert(f,"k","Thiên Sơn");insert(f,"l","Đông Nghi");insert(f,"m","Candidate");
  const m=service(f);
  const p=await m.previewOwnerOnceRosterReset(f.db,owner);
  await assert.rejects(()=>m.previewOwnerOnceRosterReset(f.db,{role:"manager",actor:"manager@fixture.invalid"}),
   e=>e.code==="OWNER_REQUIRED");
  await assert.rejects(()=>m.executeOwnerOnceRosterReset(f.db,owner,{...runArgs(p),backupBookmark:"none"}),
   e=>e.code==="ROSTER_RESET_CONFIRMATION_REQUIRED");
  await assert.rejects(()=>m.executeOwnerOnceRosterReset(f.db,owner,{...runArgs(p),protectSon:"wrong"}),
   e=>e.code==="ROSTER_RESET_PROTECTION_CHANGED");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM device_access").get().n,3);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM account_one_time_roster_resets").get().n,0);
 }finally{f.close();}
});
