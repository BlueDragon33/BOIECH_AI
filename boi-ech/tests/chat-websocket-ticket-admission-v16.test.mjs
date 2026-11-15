import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";

const src=readFileSync(new URL("../worker/index.ts",import.meta.url),"utf8");

/**
 * Exercise the ACTUAL Cloudflare Worker request handler, not a regex copied
 * from its implementation. This detected a source-escaped subprotocol guard
 * that accepted no legitimate V16 browser ticket despite green static CI.
 */
function workerHarness(){
  const js=ts.transpileModule(src,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
  }}).outputText;
  const exports={};
  const requireMock=specifier=>{
    if(specifier==="vinext/server/image-optimization")
      return {DEFAULT_DEVICE_SIZES:[],DEFAULT_IMAGE_SIZES:[],
        handleImageOptimization:async()=>new Response("image")};
    if(specifier==="vinext/server/app-router-entry")
      return {default:{fetch:async()=>new Response("UNHANDLED")}};
    if(specifier==="./chat-realtime")return {ChatRealtimeHub:class{}};
    throw Error("Unexpected import: "+specifier);
  };
  new Function("exports","require",js)(exports,requireMock);
  const forwarded=[];
  const env={
    CHAT_HUB:{
      idFromName:name=>name,
      get:id=>({fetch:async req=>{
        forwarded.push({id,header:req.headers.get("sec-websocket-protocol")});
        return new Response("TICKET_ROUTED");
      }})
    }
  };
  return {worker:exports.default,env,forwarded};
}
const ORIGIN="https://boi-ech.boiech-ai.workers.dev";
function request({ticket="a".repeat(32),origin=ORIGIN,protocols=["boi-ech.v16","ticket."+ticket],upgrade="websocket"}={}){
  return new Request(ORIGIN+"/api/course/conversations/socket",{
    method:"GET",headers:{"upgrade":upgrade,"origin":origin,
      "sec-websocket-protocol":protocols.join(", ")}
  });
}
test("authenticated 32-hex browser websocket ticket routes into the Durable Object",async()=>{
  const h=workerHarness();
  const response=await h.worker.fetch(request(),h.env,{waitUntil(){}});
  assert.equal(response.status,200,"legitimate ticket must reach broker rather than fail 401");
  assert.equal(await response.text(),"TICKET_ROUTED");
  assert.deepEqual(h.forwarded,[{
    id:"conversations-v16",
    header:"boi-ech.v16, ticket."+"a".repeat(32)
  }]);
});
test("invalid tickets, protocols, cross-origin and non-WebSocket cannot reach broker",async()=>{
  const h=workerHarness();
  const bad=[
    [request({ticket:"not-a-valid-ticket"}),401],
    [request({ticket:"A".repeat(32)}),401],
    [request({protocols:["other-protocol","ticket."+"a".repeat(32)]}),401],
    [request({protocols:["boi-ech.v16","ticket."+"a".repeat(32),"extra"]}),401],
    [request({origin:"https://evil.example"}),403],
    [request({upgrade:"h2c"}),426],
  ];
  for(const [req,status] of bad)
    assert.equal((await h.worker.fetch(req,h.env,{waitUntil(){}})).status,status);
  assert.equal(h.forwarded.length,0);
});
test("missing hub fails closed without returning fake realtime success",async()=>{
  const h=workerHarness();
  assert.equal((await h.worker.fetch(request(),{},{waitUntil(){}})).status,503);
  assert.equal(h.forwarded.length,0);
});
