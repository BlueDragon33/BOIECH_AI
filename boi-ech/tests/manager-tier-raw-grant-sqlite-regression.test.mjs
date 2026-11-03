import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Exercise the actual SQL strings extracted from the owning route, never a
// separately reimplemented UPDATE. This is isolated SQLite behavioral QA,
// NOT Cloudflare D1/Worker integration or authorized end-to-end QA.
const route=readFileSync(new URL("../app/api/control/management-access/route.ts",import.meta.url),"utf8");
function extract(pattern,label){
  const match=route.match(pattern);
  assert.ok(match && match[1], "Missing owning route SQL: "+label);
  return match[1];
}
const updateSql=extract(
  /const \[update,audit\]=await db\.batch\(\[\s*db\.prepare\(\x60([\s\S]*?)\x60\)\s*\.bind\(payload\.enabled\?1:0,/,
  "grant CAS update");
const auditSql=extract(
  /db\.prepare\(\x60(INSERT INTO course_audit_log\(actor,action,target,detail_json\)\s+SELECT \?,'training_manager_permission',\?,\? WHERE changes\(\)=1)\x60\)/,
  "grant audit");
const readSql=extract(
  /const persisted=await db\.prepare\(\x60([\s\S]*?)\x60\)\s*\.bind\(payload\.deviceId,payload\.expectedPersonCode\)/,
  "independent persisted grant readback");

const deviceId="a".repeat(64),personCode="MGR-100";
const scenarios=[
  {name:"blocked manager revoke persists",status:"blocked",expires:null,raw:1,expected:true,enabled:false,changed:1,after:0,conflict:false},
  {name:"expired manager revoke persists",status:"approved",expires:"2026-01-01T00:00:00Z",raw:1,expected:true,enabled:false,changed:1,after:0,conflict:false},
  {name:"active manager revoke persists",status:"approved",expires:null,raw:1,expected:true,enabled:false,changed:1,after:0,conflict:false},
  {name:"active manager grant persists",status:"approved",expires:null,raw:0,expected:false,enabled:true,changed:1,after:1,conflict:false},
  {name:"stale expected permission conflicts",status:"approved",expires:null,raw:1,expected:false,enabled:false,changed:0,after:1,conflict:true},
  {name:"blocked account cannot gain authority",status:"blocked",expires:null,raw:0,expected:false,enabled:true,changed:0,after:0,conflict:false},
];
for(const fixture of scenarios){
  test("isolated source SQL: "+fixture.name,()=>{
    const dir=mkdtempSync(join(tmpdir(),"boi-manager-p0-"));
    const dbPath=join(dir,"d1-fixture.sqlite");
    let db;
    try{
      db=new DatabaseSync(dbPath);
      db.exec("CREATE TABLE device_access (device_id TEXT PRIMARY KEY, person_role TEXT, person_code TEXT, registration_submitted_at TEXT, management_enabled INTEGER, status TEXT, access_expires_at TEXT, updated_at TEXT); CREATE TABLE course_audit_log (actor TEXT, action TEXT, target TEXT, detail_json TEXT);");
      db.prepare("INSERT INTO device_access(device_id,person_role,person_code,registration_submitted_at,management_enabled,status,access_expires_at) VALUES(?,?,?,?,?,?,?)")
        .run(deviceId,"manager",personCode,"2026-10-01T00:00:00Z",fixture.raw,fixture.status,fixture.expires);
      const before=db.prepare("SELECT management_enabled FROM device_access WHERE device_id=? AND person_role='manager' AND person_code=?")
        .get(deviceId,personCode);
      const conflict=(before.management_enabled===1)!==fixture.expected;
      assert.equal(conflict,fixture.conflict);
      let changed=0,audited=0;
      if(!conflict){
        db.exec("BEGIN IMMEDIATE");
        try{
          changed=Number(db.prepare(updateSql).run(fixture.enabled?1:0,deviceId,personCode,fixture.expected?1:0,fixture.enabled?1:0).changes);
          audited=Number(db.prepare(auditSql).run("owner@fixture.invalid",deviceId,"{}").changes);
          db.exec("COMMIT");
        }catch(error){db.exec("ROLLBACK");throw error;}
      }
      assert.equal(changed,fixture.changed);
      assert.equal(audited,fixture.changed);
      assert.equal(db.prepare(readSql).get(deviceId,personCode).management_enabled,fixture.after);
      db.close();db=null;
      const reopened=new DatabaseSync(dbPath);
      try{
        assert.equal(reopened.prepare("SELECT management_enabled FROM device_access WHERE device_id=?").get(deviceId).management_enabled,fixture.after);
        assert.equal(reopened.prepare("SELECT count(*) AS count FROM course_audit_log").get().count,fixture.changed);
      }finally{reopened.close();}
    }finally{
      if(db)db.close();
      rmSync(dir,{recursive:true,force:true});
    }
  });
}
