import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {DatabaseSync} from "node:sqlite";
import ts from "typescript";

const source=readFileSync(resolve("app/teacher-video-inbox.server.ts"),"utf8");
const transformed=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const exported={exports:{}};
new Function("module","exports",transformed)(exported,exported.exports);
const {enqueueVideoForAssignedTeachers,syncTeacherVideoInbox,readTeacherVideoInbox,
 markTeacherVideoSeen}=exported.exports;

function fixture(t){
 const sqlite=new DatabaseSync(":memory:");
 t.after(()=>sqlite.close());
 sqlite.exec(`
 PRAGMA foreign_keys=ON;
 CREATE TABLE device_access(
  device_id TEXT PRIMARY KEY,person_role TEXT,status TEXT,registration_submitted_at TEXT,
  access_expires_at TEXT,class_name TEXT
 );
 CREATE TABLE accounts(account_id TEXT PRIMARY KEY,storage_device_id TEXT);
 CREATE TABLE account_onboarding(account_id TEXT PRIMARY KEY,stage TEXT);
 CREATE TABLE account_entitlements(account_id TEXT PRIMARY KEY,state TEXT,expires_at TEXT);
 CREATE TABLE course_activity_events(
  id INTEGER PRIMARY KEY,device_id TEXT,client_event_id TEXT,event_type TEXT,
  created_at TEXT
 );
 CREATE TABLE teacher_video_inbox(
  teacher_device_id TEXT NOT NULL REFERENCES device_access(device_id),
  video_event_id INTEGER NOT NULL REFERENCES course_activity_events(id),
  state TEXT DEFAULT 'unread',revision INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(teacher_device_id,video_event_id)
 );
 INSERT INTO device_access VALUES
 ('T1','teacher','approved','2030-01-01T00:00:00Z',NULL,'Lớp A;Lớp B'),
 ('L1','learner','approved','2030-01-01T00:00:00Z',NULL,'Lớp B'),
 ('T2','teacher','approved','2030-01-01T00:00:00Z',NULL,'Lớp C');
 INSERT INTO course_activity_events VALUES
 (11,'L1','video:11','video_ai_analysis','2030-01-01T00:00:00Z'),
 (12,'L1','video:12','heartbeat','2030-01-01T00:00:00Z');
 `);
 const db={prepare(sql){return {bind(...values){
  const stmt=sqlite.prepare(sql);
  return {
   async run(){return {meta:{changes:stmt.run(...values).changes}};},
   async all(){return {results:stmt.all(...values)};},
   async first(){return stmt.get(...values)??null;}
  };
 }};}};
 const receipts=()=>sqlite.prepare("SELECT teacher_device_id,video_event_id,state,revision FROM teacher_video_inbox ORDER BY video_event_id").all();
 const sync=(classes=["Lớp A","Lớp B"])=>syncTeacherVideoInbox(db,"T1",classes).run();
 const read=(classes=["Lớp A","Lớp B"])=>readTeacherVideoInbox(db,"T1",classes);
 const seen=(classes=["Lớp A","Lớp B"])=>markTeacherVideoSeen({db,
  teacherDeviceId:"T1",teacherClasses:classes,eventId:11,expectedRevision:1});
 return {sqlite,db,receipts,sync,read,seen};
}

test("live current teacher class and registration control fanout and replay-safe inbox",async t=>{
 const f=fixture(t);
 assert.equal((await enqueueVideoForAssignedTeachers(f.db,"L1","video:11").run()).meta.changes,1);
 assert.equal((await enqueueVideoForAssignedTeachers(f.db,"L1","video:11").run()).meta.changes,0);
 assert.equal((await enqueueVideoForAssignedTeachers(f.db,"L1","video:12").run()).meta.changes,0);
 assert.deepEqual(f.receipts().map(r=>r.teacher_device_id),["T1"]);
 assert.deepEqual((await f.read()).items.map(r=>r.eventId),[11]);
 const update=await f.seen();assert.equal(update.code,"OK");
 assert.equal((await f.seen()).code,"ALREADY_SEEN");
 assert.equal(f.receipts()[0].revision,2);
});

test("revoking teacher mid-session immediately blocks sync/read/mark in SQL, not only route guard",async t=>{
 const f=fixture(t);
 await f.sync();
 f.sqlite.exec("UPDATE device_access SET status='revoked' WHERE device_id='T1'");
 assert.equal((await f.sync()).meta.changes,0);
 assert.equal((await f.read()).items.length,0);
 const denied=await f.seen();
 assert.equal(denied.ok,false);
 assert.equal(denied.code,"CONFLICT_OR_OUT_OF_SCOPE");
});

test("stale signed class list cannot expose inbox when teacher loses that class",async t=>{
 const f=fixture(t);
 await f.sync();
 f.sqlite.prepare("UPDATE device_access SET class_name=? WHERE device_id='T1'").run("Lớp A");
 // Input still claims old Lớp B despite the canonical stored class being updated.
 assert.equal((await f.sync(["Lớp A","Lớp B"])).meta.changes,0);
 assert.equal((await f.read(["Lớp A","Lớp B"])).items.length,0);
 assert.equal((await f.seen(["Lớp A","Lớp B"])).ok,false);
});

test("expired teacher entitlement denies inbox even if legacy access expiry is NULL",async t=>{
 const f=fixture(t);
 await f.sync();
 f.sqlite.exec(`
 INSERT INTO accounts VALUES('ACCT_T1','T1');
 INSERT INTO account_onboarding VALUES('ACCT_T1','active');
 INSERT INTO account_entitlements VALUES('ACCT_T1','expired','2020-01-01T00:00:00Z');
 `);
 assert.equal((await f.sync()).meta.changes,0);
 assert.equal((await f.read()).items.length,0);
 assert.equal((await f.seen()).ok,false);
 // When entitlement is active, authenticated access may be used again.
 f.sqlite.exec("UPDATE account_entitlements SET state='active',expires_at='2099-01-01T00:00:00Z'");
 assert.equal((await f.read()).items.length,1);
});

test("missing registration or changed teacher role blocks canonical DB inbox access",async t=>{
 const f=fixture(t);
 await f.sync();
 f.sqlite.exec("UPDATE device_access SET registration_submitted_at=NULL WHERE device_id='T1'");
 assert.equal((await f.read()).items.length,0);
 assert.equal((await f.seen()).ok,false);
 f.sqlite.exec("UPDATE device_access SET registration_submitted_at='2030-01-01T00:00:00Z',person_role='learner' WHERE device_id='T1'");
 assert.equal((await f.read()).items.length,0);
 assert.equal((await f.sync()).meta.changes,0);
});
