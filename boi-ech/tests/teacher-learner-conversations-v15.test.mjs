import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import fs from "node:fs";
import {DatabaseSync} from "node:sqlite";

const path=new URL("../app/api/course/conversations/route.ts",import.meta.url);
function harness(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec(`CREATE TABLE device_access(device_id TEXT PRIMARY KEY,person_role TEXT,status TEXT,learner_name TEXT,person_code TEXT,class_name TEXT);
 CREATE TABLE course_activity_events(id INTEGER PRIMARY KEY AUTOINCREMENT,device_id TEXT,event_type TEXT,lesson_number TEXT,part TEXT,detail_json TEXT,client_event_id TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(device_id,client_event_id));
 CREATE TABLE course_audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,target TEXT,detail_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 INSERT INTO device_access VALUES ('learner-1','learner','approved','Học viên A','HV01','Lớp A');
 INSERT INTO device_access VALUES ('learner-2','learner','approved','Học viên B','HV02','Lớp B');`);
 const database={prepare(sql){let values=[];const q={
  bind(...args){values=args;return q;},
  async first(){return sqlite.prepare(sql).get(...values)??null;},
  async all(){return {results:sqlite.prepare(sql).all(...values)};},
  async run(){const r=sqlite.prepare(sql).run(...values);return {meta:{last_row_id:Number(r.lastInsertRowid)}};}
 };return q;}};
 const actors={
  learnerA:{deviceId:"learner-1",personRole:"learner",personCode:"HV01",deviceCode:"DL1",learnerName:"Học viên A",className:"Lớp A",registrationComplete:true,accessExpired:false},
  learnerB:{deviceId:"learner-2",personRole:"learner",personCode:"HV02",deviceCode:"DL2",learnerName:"Học viên B",className:"Lớp B",registrationComplete:true,accessExpired:false},
  teacherA:{deviceId:"teacher-1",personRole:"teacher",personCode:"GV01",deviceCode:"DT1",learnerName:"Giảng viên A",className:"Lớp A",registrationComplete:true,accessExpired:false},
  teacherB:{deviceId:"teacher-2",personRole:"teacher",personCode:"GV02",deviceCode:"DT2",learnerName:"Giảng viên B",className:"Lớp B",registrationComplete:true,accessExpired:false},
  manager:{deviceId:"manager-1",personRole:"manager",personCode:"MGR",deviceCode:"D3",className:"Lớp A",registrationComplete:true,accessExpired:false}
 };
 const source=fs.readFileSync(path,"utf8").replace(/import \{DeviceAccessError,getCourseDatabase,verifyDeviceRequest\} from "[^"]+";/,"");
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 class DeviceAccessError extends Error{status=403;code="NO_ACCESS";device=null;}
 new Function("exports","DeviceAccessError","getCourseDatabase","verifyDeviceRequest",js)(exports,DeviceAccessError,async()=>database,async body=>actors[body.actor]||actors.manager);
 let seq=0;
 const post=async(body)=>{
  const event={...body};
  if(event.action==="send"&&!event.clientEventId)event.clientEventId=`conversation:test:${++seq}:1234567890`;
  const res=await exports.POST(new Request("https://terminal.local/api/course/conversations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(event)}));
  return {status:res.status,...await res.json()};
 };
 return {post,sqlite,dispose:()=>sqlite.close()};
}
test("learner sends chat without prior teacher assignment; scoped teacher can read and reply",async()=>{
 const f=harness();try{
  const a=await f.post({actor:"learnerA",action:"send",channel:"chat",message:"Cho em hỏi nhịp thở?"});
  assert.equal(a.status,201,a.error);
  const b=await f.post({actor:"teacherA",action:"list",learnerPersonCode:"HV01"});
  assert.equal(b.status,200);assert.equal(b.messages.length,1);assert.equal(b.messages[0].role,"learner");
  const c=await f.post({actor:"teacherA",action:"send",channel:"chat",learnerPersonCode:"HV01",message:"Em thở sau pha kéo tay."});
  assert.equal(c.status,201);
  const d=await f.post({actor:"learnerA",action:"list"});
  assert.equal(d.messages.length,2);assert.equal(d.messages[1].role,"teacher");
 }finally{f.dispose();}
});
test("support request has title; teacher reply anchored to a valid request belonging to the student",async()=>{
 const f=harness();try{
  const absent=await f.post({actor:"learnerA",action:"send",channel:"request",message:"Cần giúp"});
  assert.equal(absent.status,400);
  const request=await f.post({actor:"learnerA",action:"send",channel:"request",subject:"Tập chân",message:"Em không khép được chân."});
  assert.equal(request.status,201,request.error);
  const bad=await f.post({actor:"teacherA",action:"send",channel:"request",learnerPersonCode:"HV01",requestId:123456,message:"Cần thử lại"});
  assert.equal(bad.status,404);
  const good=await f.post({actor:"teacherA",action:"send",channel:"request",learnerPersonCode:"HV01",requestId:request.id,message:"Hãy luyện chậm từng nhịp."});
  assert.equal(good.status,201);
  const messages=await f.post({actor:"learnerA",action:"list"});
  assert.equal(messages.messages[1].requestId,request.id);
  assert.equal(messages.messages[1].channel,"request");
 }finally{f.dispose();}
});
test("teacher outside assigned class cannot view, send or enumerate learner conversations",async()=>{
 const f=harness();try{
  await f.post({actor:"learnerA",action:"send",channel:"chat",message:"Chỉ lớp A"});
  assert.equal((await f.post({actor:"teacherB",action:"list",learnerPersonCode:"HV01"})).status,404);
  assert.equal((await f.post({actor:"teacherB",action:"send",channel:"chat",learnerPersonCode:"HV01",message:"Cố đọc"})).status,404);
  const inbox=await f.post({actor:"teacherB",action:"inbox"});
  assert.equal(inbox.status,200);
  assert.equal(inbox.recent.length,0);
  assert.equal((await f.post({actor:"manager",action:"inbox"})).status,403);
 }finally{f.dispose();}
});
test("idempotent replay uses stable event ID and does not create duplicated mail",async()=>{
 const f=harness();try{
  const payload={actor:"learnerA",action:"send",channel:"request",subject:"Khó khăn",message:"Em cần hỗ trợ",clientEventId:"conversation:fixed:replay-01"};
  const a=await f.post(payload);const b=await f.post(payload);
  assert.equal(a.status,201);assert.equal(b.status,200);assert.equal(b.duplicate,true);
  assert.equal(a.id,b.id);
  assert.equal((await f.post({actor:"learnerA",action:"list"})).messages.length,1);
 }finally{f.dispose();}
});
test("teacher inbox auto channel only sees inbound messages for authorized class",async()=>{
 const f=harness();try{
  await f.post({actor:"learnerA",action:"send",channel:"request",subject:"Vấn đề A",message:"Cần hỗ trợ"});
  await f.post({actor:"learnerB",action:"send",channel:"request",subject:"Vấn đề B",message:"Cần hỗ trợ"});
  const a=await f.post({actor:"teacherA",action:"inbox"});
  assert.equal(a.recent.length,1);
  assert.equal(a.recent[0].learnerPersonCode,"HV01");
  const b=await f.post({actor:"teacherB",action:"inbox"});
  assert.equal(b.recent.length,1);assert.equal(b.recent[0].learnerPersonCode,"HV02");
 }finally{f.dispose();}
});
