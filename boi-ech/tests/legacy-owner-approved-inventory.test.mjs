import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {fileURLToPath} from "node:url";
import {accountStack} from "./helpers/account-stack.mjs";

const sql=fs.readFileSync(fileURLToPath(new URL("../scripts/legacy-owner-approved-inventory.sql",import.meta.url)),"utf8");
function legacy(f,id,role="teacher",ownerApproved=true,createdDaysAgo=6){
 const d=id.repeat(64);
 f.sqlite.prepare(`INSERT INTO device_access
  (device_id,display_code,public_key_jwk,status,person_role,
   registration_submitted_at,approved_at,created_at)
  VALUES(?,?,?,'approved',?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,datetime('now',?))`)
 .run(d,"BE-"+id.toUpperCase(),"{}",role,"-"+createdDaysAgo+" days");
 if(ownerApproved)f.sqlite.prepare(`INSERT INTO course_audit_log
  (actor,action,target,detail_json) VALUES('owner@fixture.invalid','learning_device_free_approved',?,'{}')`).run(d);
 return d;
}
test("strict inventory excludes modern logins, non-Owner approvals, and manager accounts",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const oldLearner=legacy(f,"a","learner");
  const legacyTeacher=legacy(f,"b","teacher");
  const notOwner=legacy(f,"c","learner",false);
  const manager=legacy(f,"d","manager");
  // Historical account-first mapping preserves legacy_hold without a login.
  f.sqlite.prepare("INSERT INTO accounts(account_id,storage_device_id) VALUES(?,?)")
   .run("acc_"+oldLearner,oldLearner);
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?")
   .get("acc_"+oldLearner).stage,"legacy_hold");
  const newAccount=await f.register(95201,"learner");
  f.sqlite.prepare("UPDATE device_access SET status='approved',approved_at=CURRENT_TIMESTAMP WHERE device_id=?")
   .run(newAccount.account.storageDeviceId);
  f.sqlite.prepare(`INSERT INTO course_audit_log (actor,action,target,detail_json)
    VALUES('owner@fixture.invalid','learning_device_free_approved',?,'{}')`)
   .run(newAccount.account.storageDeviceId);
  const rows=f.sqlite.prepare(sql).all();
  assert.deepEqual(rows.map(x=>({role:x.role,count:x.owner_approved_legacy})),
    [{role:"learner",count:1},{role:"teacher",count:1}]);
  assert.equal(rows.reduce((s,r)=>s+r.owner_approved_legacy,0),2);
  assert.ok(notOwner && manager && legacyTeacher);
 }finally{f.close();}
});

test("inventory flags learner progress but never deletes any D1 rows",()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const device=legacy(f,"e","learner");
  f.sqlite.prepare(`INSERT INTO course_activity_events
    (device_id,event_type,detail_json) VALUES(?,'completed','{}')`).run(device);
  const before=f.sqlite.prepare("SELECT COUNT(*) n FROM device_access").get().n;
  const rows=f.sqlite.prepare(sql).all();
  assert.equal(rows[0].with_progress,1);
  assert.equal(rows[0].owner_approved_legacy,1);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM device_access").get().n,before);
  assert.doesNotMatch(sql,/\bDELETE\s+FROM\b|\bDROP\s+TABLE\b|\bUPDATE\s+device_access\b/i);
 }finally{f.close();}
});

test("five full days is strict and only original device creation age counts",()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  legacy(f,"1","learner",true,5);
  legacy(f,"2","teacher",true,4);
  legacy(f,"3","learner",true,6);
  // A later account-first backfill must never reset old device age.
  const device="3".repeat(64);
  f.sqlite.prepare("INSERT INTO accounts(account_id,storage_device_id) VALUES(?,?)")
   .run("acc_"+device,device);
  // A fresh manager assignment or login must exclude otherwise old devices.
  const rows=f.sqlite.prepare(sql).all();
  assert.deepEqual(rows.map(x=>[x.role,x.owner_approved_legacy]),[["learner",1]]);
  assert.match(sql,/datetime\(d\.created_at\)\s*<\s*datetime\('now','-5 days'\)/);
 }finally{f.close();}
});
