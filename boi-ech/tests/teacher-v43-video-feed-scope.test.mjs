import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {DatabaseSync} from "node:sqlite";
import ts from "typescript";

const source=readFileSync(resolve("app/teacher-video-feed.server.ts"),"utf8");
const overview=readFileSync(resolve("app/api/teacher/overview/route.ts"),"utf8");
const output=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const record={exports:{}};
new Function("module","exports",output)(record,record.exports);
const {loadTeacherScopedVideoEvents}=record.exports;

function fixture(t){
 const sqlite=new DatabaseSync(":memory:");
 t.after(()=>sqlite.close());
 sqlite.exec(`
 CREATE TABLE device_access(
  device_id TEXT PRIMARY KEY,person_role TEXT,status TEXT,
  registration_submitted_at TEXT,class_name TEXT
 );
 CREATE TABLE course_activity_events(
  id INTEGER PRIMARY KEY,device_id TEXT,event_type TEXT,
  lesson_number TEXT,part TEXT,detail_json TEXT,created_at TEXT
 );
 INSERT INTO device_access VALUES
 ('L1','learner','approved','2030-01-01T00:00:00Z','Lớp A'),
 ('L2','learner','approved','2030-01-01T00:00:00Z','Lớp B'),
 ('U1','learner','revoked','2030-01-01T00:00:00Z','Lớp A'),
 ('N1','learner','approved',NULL,'Lớp A');
 INSERT INTO course_activity_events VALUES
 (1,'L1','video_ai_analysis','01',NULL,'{"score":75}','2030-01-01T00:00:00Z'),
 (2,'L2','video_ai_analysis','01',NULL,'{"score":91}','2030-01-01T00:00:00Z'),
 (3,'U1','video_ai_analysis','01',NULL,'{"score":92}','2030-01-01T00:00:00Z'),
 (4,'N1','video_ai_analysis','01',NULL,'{"score":93}','2030-01-01T00:00:00Z');
 `);
 let lastParameterCount=0;
 const db={prepare(sql){return {bind(...args){
  lastParameterCount=args.length;
  return {async all(){return {results:sqlite.prepare(sql).all(...args)}}};
 };}};
 const load=(classes=["Lớp A"],ids=["L1","L2","U1","N1"],limit=80)=>
  loadTeacherScopedVideoEvents(db,classes,ids,limit);
 return {sqlite,db,load,lastParameterCount:()=>lastParameterCount};
}

test("video feed is not starved by 12,001 later heartbeat events from same learner",async t=>{
 const {sqlite,load}=fixture(t);
 const stmt=sqlite.prepare("INSERT INTO course_activity_events(device_id,event_type,lesson_number,part,detail_json,created_at) VALUES ('L1','heartbeat',NULL,NULL,'{}','2030-01-02T00:00:00Z')");
 sqlite.exec("BEGIN");
 for(let i=0;i<12001;i++)stmt.run();
 sqlite.exec("COMMIT");
 // Old global mixed-event feed would miss event #1 at limit 12000.
 const mixed=sqlite.prepare("SELECT event_type FROM course_activity_events ORDER BY id DESC LIMIT 12000").all();
 assert.ok(mixed.every(row=>row.event_type==="heartbeat"));
 const result=await load(["Lớp A"],["L1"]);
 assert.equal(result.possiblyTruncated,false);
 assert.deepEqual(result.events.map(row=>row.id),[1]);
 assert.match(overview,/loadTeacherScopedVideoEvents\(/);
 assert.match(overview,/const videoInbox = videoFeed\.events/);
});

test("feed never leaks cross-class, revoked, unregistered or outside-visible-roster video",async t=>{
 const {load}=fixture(t);
 assert.deepEqual((await load(["Lớp A"],["L1","L2","U1","N1"])).events.map(x=>x.id),[1]);
 assert.deepEqual((await load(["Lớp B"],["L1","L2","U1","N1"])).events.map(x=>x.id),[2]);
 assert.deepEqual((await load(["Lớp A"],["L2"])).events,[]);
 assert.deepEqual((await load(["Lớp A"],[])).events,[]);
});

test("feed maintains descending event order and explicitly flags truncation",async t=>{
 const {sqlite,load}=fixture(t);
 const insert=sqlite.prepare("INSERT INTO course_activity_events(device_id,event_type,lesson_number,part,detail_json,created_at) VALUES ('L1','video_ai_analysis','02',NULL,'{}','2030-01-02T00:00:00Z')");
 sqlite.exec("BEGIN");for(let i=0;i<85;i++)insert.run();sqlite.exec("COMMIT");
 const r=await load(["Lớp A"],["L1"],80);
 assert.equal(r.possiblyTruncated,true);
 assert.equal(r.events.length,80);
 assert.ok(r.events.every((row,i,arr)=>i===0||arr[i-1].id>row.id));
 assert.match(overview,/videoEventLimitReached: videoFeed\.possiblyTruncated/);
 assert.match(overview,/\|\| videoFeed\.possiblyTruncated/);
});

test("video source query requires bounded, real class and learner input",async t=>{
 const {load}=fixture(t);
 await assert.rejects(()=>load([],["L1"]),/VIDEO_FEED_SCOPE_REQUIRED/);
 await assert.rejects(()=>load(Array.from({length:13},(_,i)=>"C"+i),["L1"]),/VIDEO_FEED_SCOPE_REQUIRED/);
 await assert.rejects(()=>load(["Lớp A"],Array.from({length:201},(_,i)=>"L"+i)),/VIDEO_FEED_SCOPE_REQUIRED/);
 assert.match(source,/e\.event_type='video_ai_analysis'/);
 assert.match(source,/learner\.device_id IN \(SELECT value FROM json_each\(\?\)\)/);
 assert.match(source,/\.bind\(JSON\.stringify\(classes\),JSON\.stringify\(learnerIds\),cap\+1\)/);
 assert.doesNotMatch(source,/\bfetch\(|\bPOST\(|\bDELETE\s+FROM/);
});

test("200 visible learners with 12 classes still use only three D1 bound parameters",async t=>{
 const f=fixture(t);
 const visible=["L1",...Array.from({length:199},(_,i)=>"candidate_"+i)];
 const classes=["Lớp A",...Array.from({length:11},(_,i)=>"C"+i)];
 const result=await f.load(classes,visible);
 assert.deepEqual(result.events.map(x=>x.id),[1]);
 assert.equal(f.lastParameterCount(),3,"D1's maximum is 100, even if SQLite local permits more");
});
