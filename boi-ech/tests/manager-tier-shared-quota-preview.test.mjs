import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sql=read("drizzle/0017_manager_approval_quota.sql");
const source=read("app/manager-device-review.server.ts");
const route=read("app/api/manager/device-approvals/route.ts");
const preview=read("app/xem-thu-can-bo-quan-ly/page.tsx");
const panel=read("app/manager-approval-panel.tsx");

function setup(){
  const db=new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(`CREATE TABLE device_access(
    device_id TEXT PRIMARY KEY,person_role TEXT,
    management_enabled INTEGER DEFAULT 0,status TEXT,
    registration_submitted_at TEXT, access_expires_at TEXT,
    payment_status TEXT,learner_name TEXT,person_code TEXT,
    phone TEXT,class_name TEXT
  );`);
  db.exec(`CREATE TABLE access_automation_settings(
    id TEXT PRIMARY KEY,auto_confirm_new_devices INTEGER,
    updated_by TEXT,updated_at TEXT
  );`);
  db.exec("INSERT INTO access_automation_settings VALUES('global',1,'test',CURRENT_TIMESTAMP)");
  for(const statement of sql.split("--> statement-breakpoint")){
    const trimmed=statement.trim();
    if(trimmed)db.exec(trimmed);
  }
  function seed(id,role,options={}){
    db.prepare(`INSERT INTO device_access(device_id,person_role,management_enabled,status,
      registration_submitted_at,payment_status,learner_name,person_code,phone,class_name)
      VALUES(?,?,?,?,CURRENT_TIMESTAMP,'unassigned','Mẫu','TEST','000','Lớp')`)
      .run(id,role,options.manager?1:0,options.manager?"approved":"pending");
  }
  function approve(id,manager,role){
    db.exec("BEGIN IMMEDIATE");
    try{
      db.prepare("INSERT INTO manager_device_assignments(target_device_id,manager_device_id,person_role) VALUES(?,?,?)")
        .run(id,manager,role);
      const updated=db.prepare("UPDATE device_access SET status='approved' WHERE device_id=? AND status='pending'").run(id);
      assert.equal(Number(updated.changes),1);
      db.exec("COMMIT");
    }catch(e){db.exec("ROLLBACK");throw e}
  }
  return {db,seed,approve};
}
test("Manager quota is shared for all managers: 50 learners and 5 teachers",()=>{
  const {db,seed,approve}=setup();
  try{
    seed("managerA","manager",{manager:true});
    seed("managerB","manager",{manager:true});
    for(let i=0;i<50;i++){
      const id="student"+i;
      seed(id,"learner");approve(id,i%2?"managerA":"managerB","learner");
    }
    seed("studentOver","learner");
    assert.throws(()=>approve("studentOver","managerB","learner"),/MANAGER_APPROVAL_QUOTA_REACHED/);
    for(let i=0;i<5;i++){
      const id="teacher"+i;
      seed(id,"teacher");approve(id,i%2?"managerA":"managerB","teacher");
    }
    seed("teacherOver","teacher");
    assert.throws(()=>approve("teacherOver","managerB","teacher"),/MANAGER_APPROVAL_QUOTA_REACHED/);
    // A blocked seat is available, but reactivation cannot silently exceed quota.
    db.prepare("UPDATE device_access SET status='blocked' WHERE device_id=?").run("student0");
    approve("studentOver","managerB","learner");
    assert.throws(()=>db.prepare("UPDATE device_access SET status='approved' WHERE device_id=?").run("student0"),/MANAGER_APPROVAL_QUOTA_REACHED/);
    // Revoked manager cannot approve even if there is spare global capacity.
    db.prepare("UPDATE device_access SET management_enabled=0 WHERE device_id=?").run("managerA");
    db.prepare("UPDATE device_access SET status='blocked' WHERE device_id=?").run("student1");
    seed("studentRevoke","learner");
    assert.throws(()=>approve("studentRevoke","managerA","learner"),/MANAGER_APPROVAL_FORBIDDEN/);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM manager_approval_limits").get().n,1);
    assert.equal(db.prepare("SELECT learner_limit FROM manager_approval_limits WHERE scope='manager-tier'").get().learner_limit,50);
  }finally{db.close()}
});
test("Unregistered, blocked or manager-role target cannot be approved",()=>{
  const {db,seed,approve}=setup();
  try{
    seed("managerA","manager",{manager:true});
    seed("managerB","manager",{manager:true});
    assert.throws(()=>approve("managerB","managerA","manager"),/MANAGER_TARGET_NOT_ELIGIBLE/);
    seed("blocked","learner");
    db.prepare("UPDATE device_access SET status='blocked' WHERE device_id='blocked'").run();
    assert.throws(()=>approve("blocked","managerA","learner"),/MANAGER_TARGET_NOT_ELIGIBLE/);
  }finally{db.close()}
});
test("Manager review uses verified device proof and isolated demo has no network or D1",()=>{
  assert.match(route,/verifyDeviceRequest\(payload,false\)/);
  assert.match(source,/requireManager\(actor\)/);
  assert.match(source,/SELECT a\.person_role, COUNT\(\*\) AS used FROM manager_device_assignments a/);
  assert.match(source,/WHERE d\.status='approved'/);
  assert.match(preview,/<ManagerApprovalPanel previewOnly\/>/);
  assert.match(preview,/onCommand=\{async\(\)=>/);
  assert.doesNotMatch(preview,/(?:fetch\(|operationsAction\(|getCourseDatabase\()/);
  assert.match(panel,/if\(previewOnly \|\| !getProof\)throw/);
  assert.match(panel,/if\(previewOnly\)return;/);
  assert.match(panel,/disabled=\{busy\|\|previewOnly/);
});
