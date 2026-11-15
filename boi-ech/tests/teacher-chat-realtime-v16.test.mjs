import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";

const read=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const brokerSource=read("../worker/chat-realtime.ts");
const routeSource=read("../app/api/course/conversations/route.ts");
const clientSource=read("../app/teacher-learner-conversations.tsx");

function broker(){
 const js=ts.transpileModule(brokerSource,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText;
 const exports={};
 class MockDurableObject{constructor(ctx,env){this.ctx=ctx;this.env=env;}}
 new Function("exports","require",js)(exports,()=>({DurableObject:MockDurableObject}));
 return exports.ChatRealtimeHub;
}
function socket(session){
 return {session,sent:[],closed:false,deserializeAttachment(){return this.session;},
  send(value){this.sent.push(JSON.parse(value));},close(){this.closed=true;}};
}
function fixture(){
 const devA="a".repeat(64),devGV="b".repeat(64),devBad="c".repeat(64),devOther="d".repeat(64);
 const rows=new Map([
  [devA,{person_role:"learner",status:"approved",class_name:"Lớp A",access_expires_at:null}],
  [devGV,{person_role:"teacher",status:"approved",class_name:"Lớp A",access_expires_at:null}],
  [devBad,{person_role:"teacher",status:"blocked",class_name:"Lớp A",access_expires_at:null}],
  [devOther,{person_role:"teacher",status:"approved",class_name:"Lớp B",access_expires_at:null}]
 ]);
 const sessions=[
  socket({role:"learner",deviceId:devA,classes:["lớp a"],expiresAt:Date.now()+60000}),
  socket({role:"teacher",deviceId:devGV,classes:["lớp a"],expiresAt:Date.now()+60000}),
  socket({role:"teacher",deviceId:devBad,classes:["lớp a"],expiresAt:Date.now()+60000}),
  socket({role:"teacher",deviceId:devOther,classes:["lớp b"],expiresAt:Date.now()+60000})
 ];
 const storage=new Map();
 const ctx={getWebSockets:()=>sessions,storage:{
  put:async(k,v)=>storage.set(k,v),get:async k=>storage.get(k),
  delete:async k=>storage.delete(k),list:async()=>new Map(storage),
  setAlarm:async()=>undefined
 },blockConcurrencyWhile:async fn=>fn()};
 const env={BOI_ECH_ACCOUNT_V2:"true",DB:{prepare(sql){return{
  bind(deviceId){return{async first(){return rows.get(deviceId)??null;}}}
 };}}};
 const Hub=broker();
 return {hub:new Hub(ctx,env),sessions,devA,devGV,devBad,devOther};
}
test("WebSocket fanout is event-only, D1-scoped, and excludes blocked or foreign-class sessions",async()=>{
 const f=fixture();
 const response=await f.hub.fetch(new Request("https://hub.internal/publish",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({type:"conversation_changed",id:42,
   learnerDeviceId:f.devA,learnerPersonCode:"HV01",learnerClass:"Lớp A"})
 }));
 assert.equal(response.status,200);
 assert.equal((await response.json()).delivered,2);
 assert.equal(f.sessions[0].sent.length,1);
 assert.equal(f.sessions[1].sent.length,1);
 assert.equal(f.sessions[2].sent.length,0);
 assert.equal(f.sessions[3].sent.length,0);
 assert.equal(f.sessions[2].closed,true);
 assert.deepEqual(Object.keys(f.sessions[0].sent[0]).sort(),
  ["id","learnerPersonCode","type"].sort());
});
test("Realtime hub rejects a malformed publish and does not fanout",async()=>{
 const f=fixture();
 const r=await f.hub.fetch(new Request("https://hub.internal/publish",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({type:"conversation_changed",id:0,
   learnerDeviceId:f.devA,learnerPersonCode:"HV01",learnerClass:"Lớp A"})
 }));
 assert.equal(r.status,400);
 assert.ok(f.sessions.every(s=>s.sent.length===0));
});
test("V16 retains D1-before-push and authenticates websocket tickets with device proof",()=>{
 assert.match(routeSource,/verifyDeviceRequest\(payload/);
 assert.match(routeSource,/if\(operation==="connect"\)/);
 assert.ok(routeSource.indexOf("const savedId=Number(write.meta")<
  routeSource.indexOf('type:"conversation_changed",id:savedId'));
 assert.match(routeSource,/if\(savedId\)/);
 const worker=read("../worker/index.ts");
 assert.match(worker,/url.pathname === "\/api\/course\/conversations\/socket"/);
 assert.match(worker,/request.headers.get\("origin"\) !== url.origin/);
 assert.match(worker,/ChatRealtimeHub/);
 const config=JSON.parse(read("../wrangler.cloudflare.preview.example.jsonc"));
 assert.deepEqual(config.durable_objects.bindings,
  [{name:"CHAT_HUB",class_name:"ChatRealtimeHub"}]);
 assert.equal(config.migrations[0].new_sqlite_classes[0],"ChatRealtimeHub");
});
test("WebSocket events replace polling in healthy connected chat without removing fallback",()=>{
 assert.match(clientSource,/new WebSocket\(/);
 assert.match(clientSource,/boi-ech\.v16/);
 assert.match(clientSource,/window\.addEventListener\("boi:conversation:new",handle\)/);
 assert.match(clientSource,/const timer=realtime\?undefined:window\.setInterval\(poll,5200\)/);
 assert.match(clientSource,/const timer=realtime\?undefined:window\.setInterval\(poll,6800\)/);
 assert.doesNotMatch(clientSource,/Tự đồng bộ 5–7 giây/);
});
