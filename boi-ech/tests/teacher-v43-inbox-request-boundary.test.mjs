import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import ts from "typescript";

const source=readFileSync(resolve("app/api/teacher/video-inbox/route.ts"),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
function route(){
 let authCount=0,dbCount=0;
 class DeviceAccessError extends Error {
  constructor(message,status,code){super(message);this.status=status;this.code=code;}
 }
 const mocks={
  "../../../device-auth.server":{
   DeviceAccessError,verifyDeviceRequest:async()=>{authCount++;
    return {deviceId:"t1",personRole:"teacher",className:"A"};
   },getCourseDatabase:async()=>{dbCount++;return {};}
  },
  "../../../teacher-video-inbox.server":{
   syncTeacherVideoInbox:()=>({run:async()=>({meta:{changes:0}})}),
   readTeacherVideoInbox:async()=>({items:[],possiblyTruncated:false}),
   markTeacherVideoSeen:async()=>({ok:false,code:"CONFLICT_OR_OUT_OF_SCOPE",revision:null})
  }
 };
 const record={exports:{}};
 new Function("require","module","exports",compiled)(
  name=>{if(name in mocks)return mocks[name];throw Error("unexpected import "+name);},
  record,record.exports
 );
 return {post:record.exports.POST,calls:()=>({authCount,dbCount})};
}
test("teacher inbox rejects >8KB body without trusting Content-Length or invoking auth/DB",async()=>{
 const r=route();
 const req=new Request("https://example.org/api/teacher/video-inbox",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({action:"list",padding:"x".repeat(10000)})
 });
 req.headers.delete("content-length");
 const result=await r.post(req);
 assert.equal(result.status,413);
 assert.deepEqual(r.calls(),{authCount:0,dbCount:0});
 assert.match(source,/const raw=await request\.text\(\)/);
 assert.doesNotMatch(source,/const size=Number\(request\.headers\.get\("content-length"\)/);
});
test("invalid JSON is rejected rather than bypassing signed role guard",async()=>{
 const r=route();
 const out=await r.post(new Request("https://example.org/api/teacher/video-inbox",{
  method:"POST",body:"{"
 }));
 assert.equal(out.status,400);
 assert.deepEqual(r.calls(),{authCount:0,dbCount:0});
});
test("valid bounded request still uses signed teacher identity and returns bounded inbox",async()=>{
 const r=route();
 const out=await r.post(new Request("https://example.org/api/teacher/video-inbox",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({action:"list",deviceId:"t1"})
 }));
 assert.equal(out.status,200);
 assert.deepEqual(r.calls(),{authCount:1,dbCount:1});
 const json=await out.json();
 assert.deepEqual(json.items,[]);
 assert.equal(json.unreadCount,0);
});
