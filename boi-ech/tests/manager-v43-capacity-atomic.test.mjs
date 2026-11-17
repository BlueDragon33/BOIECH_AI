import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Rehearse the ACTUAL V42 capacity predicate extracted from the server source.
 * Two managers may both have read "1 seat"; only the first write can succeed.
 * This is a SQLite/D1-semantics fixture, NOT a remote D1 Worker E2E proof.
 */
const source=readFileSync(resolve("app/training-management.server.ts"),"utf8");
const match=source.match(/const capacityGuard=learnerNewClass\?`([\s\S]*?)`:"";/);
assert.ok(match,"production server must keep atomic learner capacity predicate");
const capacityGuard=match[1];
assert.match(capacityGuard,/seat\.capacity > \(/);
const now="2030-06-06T10:00:00Z";
function fixture(t,{capacity=2,registered=true}={}){
 const folder=mkdtempSync(join(tmpdir(),"boi-v43-seat-")),filename=join(folder,"seat.sqlite");
 const a=new DatabaseSync(filename),b=new DatabaseSync(filename);
 t.after(()=>{a.close();b.close();rmSync(folder,{recursive:true,force:true});});
 a.exec(`
 CREATE TABLE training_resources (id TEXT PRIMARY KEY,kind TEXT,status TEXT,name TEXT,capacity INTEGER);
 CREATE TABLE device_access (device_id TEXT PRIMARY KEY,person_role TEXT,status TEXT,
  registration_submitted_at TEXT,class_name TEXT,access_expires_at TEXT);
 CREATE TABLE accounts (account_id TEXT PRIMARY KEY,storage_device_id TEXT);
 CREATE TABLE account_onboarding (account_id TEXT PRIMARY KEY,first_review_by TEXT,stage TEXT);
 CREATE TABLE account_entitlements (account_id TEXT PRIMARY KEY,state TEXT,expires_at TEXT);
 `);
 a.prepare("INSERT INTO training_resources VALUES (?,?,?,?,?)").run("cl","class","active","A",capacity);
 const put=a.prepare("INSERT INTO device_access VALUES (?,?,?,?,?,?)");
 put.run("occupied","learner","approved",now,"A",null);
 put.run("candidate1","learner","approved",registered?now:null,"Chưa phân lớp",null);
 put.run("candidate2","learner","approved",now,"Chưa phân lớp",null);
 const attempt=db=>db.prepare(`UPDATE device_access SET class_name=? WHERE
 device_id=? AND person_role='learner' AND class_name='Chưa phân lớp' ${capacityGuard}`);
 const check=db=>db.prepare("SELECT COUNT(*) AS n FROM device_access WHERE class_name='A'").get().n;
 return {a,b,attempt,check};
}
test("two signed-manager snapshots can observe one free seat, but only one SQL UPDATE can fill it",t=>{
 const {a,b,attempt,check}=fixture(t);
 const beforeA=a.prepare("SELECT COUNT(*) AS n FROM device_access WHERE class_name='A'").get();
 const beforeB=b.prepare("SELECT COUNT(*) AS n FROM device_access WHERE class_name='A'").get();
 assert.equal(beforeA.n,1);assert.equal(beforeB.n,1);
 assert.equal(attempt(a).run("A","candidate1","A").changes,1);
 assert.equal(attempt(b).run("A","candidate2","A").changes,0);
 assert.equal(check(a),2);assert.equal(check(b),2);
 assert.equal(a.prepare("SELECT class_name AS c FROM device_access WHERE device_id='candidate2'").get().c,"Chưa phân lớp");
});
test("capacity guard remains fail-closed for full, inactive and nonexistent classes",t=>{
 const {a,b,attempt,check}=fixture(t,{capacity:1});
 assert.equal(attempt(a).run("A","candidate1","A").changes,0);
 a.exec("UPDATE training_resources SET capacity=5,status='archived'");
 assert.equal(attempt(b).run("A","candidate2","A").changes,0);
 a.exec("UPDATE training_resources SET status='active'");
 assert.equal(attempt(b).run("A","candidate2","Z").changes,0);
 assert.equal(check(a),1);
});
test("expired legacy records do not consume an active class seat",t=>{
 const {a,b,attempt,check}=fixture(t,{capacity:1});
 a.exec("UPDATE device_access SET access_expires_at='2020-01-01T00:00:00Z' WHERE device_id='occupied'");
 assert.equal(attempt(b).run("A","candidate1","A").changes,1);
 assert.equal(check(a),2,"physical rows include expired and active; active occupancy is only one");
});
test("active account-first records consume a seat; expired/suspended account-first records do not",t=>{
 const {a,b,attempt}=fixture(t,{capacity:1});
 a.prepare("INSERT INTO accounts VALUES (?,?)").run("acc1","occupied");
 a.prepare("INSERT INTO account_onboarding VALUES (?,?,?)").run("acc1","reviewer","active");
 a.prepare("INSERT INTO account_entitlements VALUES (?,?,?)").run("acc1","active","2099-01-01T00:00:00Z");
 assert.equal(attempt(a).run("A","candidate1","A").changes,0);
 a.exec("UPDATE account_entitlements SET state='suspended'");
 assert.equal(attempt(b).run("A","candidate1","A").changes,1);
});
test("unregistered, blocked or expired candidates must still be denied by canonical signed assignment guard",()=>{
 assert.match(source,/status='approved'/);
 assert.match(source,/registration_submitted_at IS NOT NULL/);
 assert.match(source,/\$\{authorityGuard\} \$\{capacityGuard\}/);
 assert.match(source,/TRAINING_VERSION_CONFLICT/);
});
