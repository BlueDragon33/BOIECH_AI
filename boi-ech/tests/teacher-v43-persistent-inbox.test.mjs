import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {DatabaseSync} from "node:sqlite";
import ts from "typescript";

const source=readFileSync(resolve("app/teacher-video-inbox.server.ts"),"utf8");
const migration=readFileSync(resolve("drizzle/0043_teacher_video_inbox.sql"),"utf8");
const route=readFileSync(resolve("app/api/teacher/video-inbox/route.ts"),"utf8");
const video=readFileSync(resolve("app/api/video-analysis/route.ts"),"utf8");
const teacherAction=readFileSync(resolve("app/api/teacher/action/route.ts"),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function("module","exports",js)(mod,mod.exports);
const {enqueueVideoForAssignedTeachers,syncTeacherVideoInbox,readTeacherVideoInbox,markTeacherVideoSeen}=mod.exports;

function fixture(t){
 const sqlite=new DatabaseSync(":memory:");
 t.after(()=>sqlite.close());
 sqlite.exec(`
 CREATE TABLE device_access(device_id TEXT PRIMARY KEY,person_role TEXT NOT NULL,status TEXT NOT NULL,
 registration_submitted_at TEXT,class_name TEXT,access_expires_at TEXT);
 CREATE TABLE course_activity_events(id INTEGER PRIMARY KEY,device_id TEXT NOT NULL,event_type TEXT NOT NULL,
 client_event_id TEXT,detail_json TEXT,created_at TEXT);
 CREATE TABLE accounts(account_id TEXT PRIMARY KEY,storage_device_id TEXT);
 CREATE TABLE account_onboarding(account_id TEXT PRIMARY KEY,stage TEXT);
 CREATE TABLE account_entitlements(account_id TEXT PRIMARY KEY,state TEXT,expires_at TEXT);
 `);
 sqlite.exec(migration.replace(/^--.*$/gm,"").replaceAll("--> statement-breakpoint",""));
 const add=sqlite.prepare("INSERT INTO device_access VALUES (?,?,?,?,?,?)");
 add.run("T1","teacher","approved","2030-01-01T00:00:00Z","A; C",null);
 add.run("T2","teacher","approved","2030-01-01T00:00:00Z","B",null);
 add.run("L1","learner","approved","2030-01-01T00:00:00Z","A",null);
 sqlite.prepare("INSERT INTO course_activity_events VALUES (?,?,?,?,?,?)")
  .run(1,"L1","video_ai_analysis","video-ai:video1","{}", "2030-02-01T09:00:00Z");
 const db={
  prepare(sql){
   return {bind(...args){
    return {
     async run(){const result=sqlite.prepare(sql).run(...args);return {meta:{changes:result.changes,last_row_id:Number(result.lastInsertRowid)}};},
     async all(){return {results:sqlite.prepare(sql).all(...args)};},
     async first(){return sqlite.prepare(sql).get(...args)??null;},
    };
   }};
  }
 };
 return {sqlite,db};
}
test("video+teacher inbox fanout is source keyed, media-free and idempotent for multiple teachers",async t=>{
 const {sqlite,db}=fixture(t);
 await enqueueVideoForAssignedTeachers(db,"L1","video-ai:video1").run();
 await enqueueVideoForAssignedTeachers(db,"L1","video-ai:video1").run();
 const rows=sqlite.prepare("SELECT teacher_device_id,video_event_id,state FROM teacher_video_inbox").all();
 assert.deepEqual(rows.map(x=>x.teacher_device_id),["T1"]);
 assert.equal(rows[0].video_event_id,1);
 assert.equal(rows[0].state,"unread");
 assert.doesNotMatch(migration,/base64|thumbnail|score|video_blob|video_bytes|image_url/);
 assert.match(video,/await database\.batch\(\[/);
 assert.match(video,/enqueueVideoForAssignedTeachers\(database,device\.deviceId,clientEventId\)/);
});
test("catch-up after teacher reassignment preserves seen state, hides old class, does not leak across classes",async t=>{
 const {sqlite,db}=fixture(t);
 await syncTeacherVideoInbox(db,"T1",["A","C"]).run();
 let rows=await readTeacherVideoInbox(db,"T1",["A","C"]);
 assert.equal(rows.items.length,1);assert.equal(rows.items[0].state,"unread");
 assert.deepEqual(await markTeacherVideoSeen({db,teacherDeviceId:"T1",teacherClasses:["A","C"],
 eventId:1,expectedRevision:1}),{ok:true,code:"OK",revision:2});
 await syncTeacherVideoInbox(db,"T1",["A","C"]).run();
 rows=await readTeacherVideoInbox(db,"T1",["A","C"]);
 assert.equal(rows.items[0].state,"seen");
 assert.equal(rows.items[0].revision,2);
 sqlite.exec("UPDATE device_access SET class_name='B' WHERE device_id='L1'");
 assert.equal((await readTeacherVideoInbox(db,"T1",["A","C"])).items.length,0);
 assert.equal((await markTeacherVideoSeen({db,teacherDeviceId:"T1",teacherClasses:["A","C"],
 eventId:1,expectedRevision:2})).ok,false);
 await syncTeacherVideoInbox(db,"T2",["B"]).run();
 assert.equal((await readTeacherVideoInbox(db,"T2",["B"])).items[0].state,"unread");
});
test("signed teacher role, class, event ID and CAS revision must be checked on every markSeen",async t=>{
 const {db}=fixture(t);
 await syncTeacherVideoInbox(db,"T1",["A"]).run();
 assert.equal((await markTeacherVideoSeen({db,teacherDeviceId:"T1",teacherClasses:["C"],
 eventId:1,expectedRevision:1})).ok,false);
 assert.equal((await markTeacherVideoSeen({db,teacherDeviceId:"T1",teacherClasses:["A"],
 eventId:1,expectedRevision:100})).ok,false);
 assert.equal((await markTeacherVideoSeen({db,teacherDeviceId:"T1",teacherClasses:["A"],
 eventId:1,expectedRevision:1})).ok,true);
 assert.equal((await markTeacherVideoSeen({db,teacherDeviceId:"T1",teacherClasses:["A"],
 eventId:1,expectedRevision:1})).code,"ALREADY_SEEN");
 assert.match(route,/await verifyDeviceRequest\(payload,previewRequest\)/);
 assert.match(route,/teacher\.personRole!=="teacher"/);
 assert.match(route,/teacherClassNames\(teacher\.className\)/);
 assert.match(route,/markTeacherVideoSeen\(\{/);
});
test("expired account-first teacher is excluded from event notifications even if legacy device status is approved",async t=>{
 const {db,sqlite}=fixture(t);
 sqlite.exec("INSERT INTO accounts VALUES ('acc1','T1');INSERT INTO account_onboarding VALUES ('acc1','active');INSERT INTO account_entitlements VALUES ('acc1','suspended','2099-01-01T00:00:00Z');");
 await enqueueVideoForAssignedTeachers(db,"L1","video-ai:video1").run();
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM teacher_video_inbox").get().n,0);
 sqlite.exec("UPDATE account_entitlements SET state='active'");
 await enqueueVideoForAssignedTeachers(db,"L1","video-ai:video1").run();
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM teacher_video_inbox").get().n,1);
});
test("teacher action needs actual source analysis, an actor-bound payload and conflict-on-replay",()=>{
 assert.match(teacherAction,/source\.id FROM course_activity_events|SELECT id FROM course_activity_events/);
 assert.match(teacherAction,/json_extract\(detail_json,'\$\.analyzedAt'\)/);
 assert.match(teacherAction,/TEACHER_ANALYSIS_EVIDENCE_REQUIRED/);
 assert.match(teacherAction,/teacherDeviceId: teacher\.deviceId/);
 assert.match(teacherAction,/TEACHER_ACTION_REPLAY_CONFLICT/);
});
