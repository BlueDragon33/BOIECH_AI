import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
import {webcrypto} from "node:crypto";

const read=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const clientSource=read("../app/teacher-learner-conversation-client.ts");
const viewSource=read("../app/teacher-learner-conversations.tsx");

async function fixture(fetchHandler){
 const pair=await webcrypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},false,["sign","verify"]);
 const stored={version:2,privateKey:pair.privateKey,publicKey:{}};
 const indexedDB={open(){
  const request={};
  queueMicrotask(()=>{request.result={
   transaction:()=>({objectStore:()=>({get(){
    const read={};
    queueMicrotask(()=>{read.result=stored;read.onsuccess?.();});
    return read;
   }})}),
   close(){}
  };request.onsuccess?.();});
  return request;
 }};
 const code=ts.transpileModule(clientSource,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText;
 const exports={};
 new Function("exports","indexedDB","document","crypto","fetch","btoa",code)(
  exports,indexedDB,{documentElement:{dataset:{} }},webcrypto,fetchHandler,globalThis.btoa
 );
 return exports;
}

test("simultaneous teacher chat/inbox/socket refreshes serialize device nonce writes and recover a transient 503",async()=>{
 const device="a".repeat(64);
 let attempts=0,active=0,maximum=0,rest=0;
 const f=await fixture(async(url)=>{
  if(url==="/api/device"){
   attempts++;active++;maximum=Math.max(maximum,active);
   await new Promise(resolve=>setTimeout(resolve,8));
   active--;
   return attempts===1?Response.json({error:"Dịch vụ tạm gián đoạn",code:"DEVICE_SERVICE_ERROR"},{status:503})
    :Response.json({challenge:"b".repeat(43)});
  }
  if(url==="/api/course/conversations"){rest++;return Response.json({messages:[],recent:[],unread:{chat:0,request:0}});}
  throw new Error("Unknown request "+url);
 });
 const results=await Promise.all([
  f.conversationRequest(device,{action:"list"}),
  f.conversationRequest(device,{action:"inbox"}),
  f.conversationRequest(device,{action:"connect"})
 ]);
 assert.equal(results.length,3);
 assert.equal(rest,3);
 assert.equal(attempts,4);
 assert.equal(maximum,1,"Challenge admission must not overlap between the mounted chat surfaces");
});

test("an invalid or blocked device response is never retried as a transient failure",async()=>{
 const device="c".repeat(64);
 let attempts=0,rest=0;
 const f=await fixture(async(url)=>{
  if(url==="/api/device"){attempts++;return Response.json({error:"Thiết bị đã bị khóa.",code:"DEVICE_BLOCKED"},{status:403});}
  if(url==="/api/course/conversations"){rest++;return Response.json({ok:true});}
  throw new Error("Unexpected "+url);
 });
 await assert.rejects(f.conversationRequest(device,{action:"send",message:"test"}),/Thiết bị đã bị khóa/);
 assert.equal(attempts,1);
 assert.equal(rest,0);
});

test("teacher sends retain idempotency and never turn an acknowledged D1 write into a send failure on refresh",()=>{
 assert.match(viewSource,/pendingId\.current\?\?=newClientEventId\(\)/);
 assert.match(viewSource,/clientEventId:pendingId\.current/);
 assert.match(viewSource,/pendingId\.current=null;setText\(" "\)/.source.replace('" "','""')); // payload ACK resets draft only once
 assert.match(viewSource,/setNotice\("Đã gửi và lưu thành công\."\)/);
 assert.match(viewSource,/try\{\s*await refresh\(\);\s*\}catch\(err\)\{/);
 assert.match(viewSource,/Hiển thị đang đồng bộ lại, không cần gửi lần nữa/);
 assert.match(viewSource,/setHistorySyncError/);
 assert.match(viewSource,/setInboxSyncError/);
});
