import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkPreviewStack, installPreviewBridge, verifyV2SummaryLive } from "../scripts/preview-stack-remote.mjs";

const account="f88a42260814230aa4a151abbfe5659d";
const borrowed="4094a621-3b81-4533-9694-4a2103e03363";
const appId="00f8a685-452f-472c-81c5-4d0b1c4037c9";
const env={CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:"test-api-token",BOI_ECH_PREVIEW_D1_DATABASE_NAME:"bauman-control-preview-db",BOI_ECH_PREVIEW_D1_DATABASE_ID:borrowed,CONTROL_OWNER_EMAILS:"owner@fixture.invalid",GITHUB_SHA:"a".repeat(40),APPLICATION_MANAGEMENT_BUILD_REVISION:"b".repeat(40)};
function fixture(change=()=>{}) {
 const calls=[];
 const settings={
  "bauman-control-preview":{bindings:[]},
  "boi-ech-preview":{bindings:[{name:"DB",type:"d1",id:borrowed},{name:"BOI_ECH_BUILD_REVISION",type:"plain_text",text:env.GITHUB_SHA},{name:"BOI_ECH_DEPLOYMENT_CHANNEL",type:"plain_text",text:"cloudflare-preview"},{name:"APPLICATION_MANAGEMENT_ORIGIN",type:"plain_text",text:"https://application-management-preview.boiech-ai.workers.dev"}]},
  "application-management-preview":{bindings:[{name:"DB",type:"d1",id:appId},{name:"APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET",type:"secret_text"},{name:"MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY",type:"secret_text"},{name:"CONTROL_OWNER_EMAILS",type:"plain_text",text:env.CONTROL_OWNER_EMAILS},{name:"APPLICATION_MANAGEMENT_BUILD_REVISION",type:"plain_text",text:env.APPLICATION_MANAGEMENT_BUILD_REVISION},{name:"APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL",type:"plain_text",text:"cloudflare-preview"}]},
 };
 change(settings);
 const fetcher=async(url,init={})=>{
  calls.push({url:String(url),...init});
  const parts=new URL(url).pathname.split('/');
  if(new URL(url).hostname==='api.cloudflare.com'){
   assert.equal(parts[4],account);
   const worker=parts[7],op=parts[8];
   assert.ok(worker in settings,"only the three named Preview Workers may be addressed");
   if(op==='settings')return Response.json({success:true,result:settings[worker]});
   if(op==='subdomain')return Response.json({success:true,result:{enabled:false,previews_enabled:false}});
   if(op==='secrets'&&init.method==='PUT'){
    const body=JSON.parse(init.body);
    settings[worker].bindings.push({name:body.name,type:'secret_text'});
    return Response.json({success:true,result:{name:body.name,type:'secret_text'}});
   }
   throw new Error('unexpected provider operation');
  }
  if(String(url).endsWith('/api/control/status'))return Response.json({ok:true,application:'boi-ech',deployment:{revision:env.GITHUB_SHA,channel:'cloudflare-preview',paymentStorageReady:false}});
  if(String(url).includes('/api/control/v2/account-summary')){
    const token=init.headers?.authorization?.slice(7);
    if(!token)return Response.json({code:'CONTROL_AUTH_REQUIRED'},{status:401});
    if(token==='invalid-preview-ticket-without-valid-signature-000000000000000')return Response.json({code:'CONTROL_TICKET_FORBIDDEN'},{status:403});
    if(init.headers?.['x-control-role']==='viewer')return Response.json({code:'ACCOUNT_SUMMARY_FORBIDDEN'},{status:403});
    return Response.json({asOf:'2026-11-09T08:00:00.000Z',contract:'boi-account-summary.v2',verified:true,
      counts:{totalAccounts:3,pending:1,active:1,suspended:0,expired:0,unverified:1}});
  }
  if(String(url).includes('/api/control/overview?'))return Response.json({code:'ACCOUNT_CONTROL_REQUIRED'},{status:409});
  if(String(url).endsWith('/__deployment'))return Response.json({error:'preview_access_required'},{status:401});
  throw new Error('unexpected destination');
 };
 return {calls,fetcher};
}

test('borrowed D1 preflight refuses a retained Bauman binding before any remote write',async()=>{
 const f=fixture(s=>s['bauman-control-preview'].bindings.push({name:'DB',type:'d1',id:borrowed}));
 await assert.rejects(checkPreviewStack(env,f.fetcher),/detached/);
 assert.ok(f.calls.every(c=>!c.method||c.method==='GET'));
});
test('stack preflight refuses a Preview bound to Production or missing retained access protection',async()=>{
 for(const change of [s=>s['application-management-preview'].bindings[0].id='8a626342-21fd-46a7-bfbd-1c3c4866c999',s=>s['application-management-preview'].bindings=s['application-management-preview'].bindings.filter(b=>b.name!=='APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET')]){
  const f=fixture(change);await assert.rejects(checkPreviewStack(env,f.fetcher));
  assert.ok(f.calls.every(c=>!c.method||c.method==='GET'));
 }
});
test('missing or wrong live Preview Origin stops bridge before credential mutation',async()=>{
 for (const change of [
  settings=>settings['boi-ech-preview'].bindings=settings['boi-ech-preview'].bindings.filter(x=>x.name!=='APPLICATION_MANAGEMENT_ORIGIN'),
  settings=>settings['boi-ech-preview'].bindings.find(x=>x.name==='APPLICATION_MANAGEMENT_ORIGIN').text='https://application-management.boiech-ai.workers.dev'
 ]) {
  const f=fixture(change);
  await assert.rejects(installPreviewBridge({...env,PREVIEW_BRIDGE_CONFIRMATION:'INSTALL_PREVIEW_BRIDGE'},f.fetcher),/Origin policy mismatch/);
  assert.equal(f.calls.some(c=>c.method==='PUT'),false);
 }
});
test('bridge installation needs exact action confirmation and only writes both named Preview secrets',async()=>{
 const denied=fixture();await assert.rejects(installPreviewBridge(env,denied.fetcher),/INSTALL_PREVIEW_BRIDGE/);
 assert.equal(denied.calls.length,0);
 const f=fixture();
 const verifyRoles=async fetcher=>{
  assert.equal(fetcher,f.fetcher);
  assert.equal(f.calls.some(c=>c.method==='PUT'),false,"role asset check must precede secret rotation");
  return {checked:2,files:["assets/learner-enhancements-fixture1.js","assets/teacher-enhancements-fixture2.js"]};
 };
 const result=await installPreviewBridge({...env,PREVIEW_BRIDGE_CONFIRMATION:'INSTALL_PREVIEW_BRIDGE'},f.fetcher,verifyRoles);
 assert.equal(result.roleSmoke.checked,2);
 const writes=f.calls.filter(c=>c.method==='PUT');assert.equal(writes.length,2);
 assert.deepEqual(writes.map(c=>new URL(c.url).pathname.split('/')[7]),['boi-ech-preview','application-management-preview']);
 const secrets=writes.map(c=>JSON.parse(c.body));
 assert.equal(secrets[0].text,secrets[1].text);assert.ok(secrets[0].text.length>=64);
 assert.ok(secrets.every(s=>s.name==='CONTROL_SERVICE_SECRET'&&s.type==='secret_text'));
 assert.equal(JSON.stringify(result).includes(secrets[0].text),false);
 assert.equal(result.boiRevision,env.GITHUB_SHA);
 assert.equal(result.appAnonymousStatus,401);
 assert.equal(result.v2Summary.contract,'boi-account-summary.v2');
 assert.deepEqual(result.v2Summary.statusChecks,[200,200,403,401,403,409]);
 assert.equal(result.v2Summary.personalRowsReturned,false);
 assert.equal(f.calls.filter(c=>c.method==='PUT').length,2,"read-only V2 verification must never write");

});
test('failed live role JS readback forbids both Preview secret writes',async()=>{
 const f=fixture();
 await assert.rejects(installPreviewBridge({...env,PREVIEW_BRIDGE_CONFIRMATION:'INSTALL_PREVIEW_BRIDGE'},f.fetcher,
   async()=>{throw new Error('Preview role smoke: learner asset HTTP 404');}),/HTTP 404/);
 assert.equal(f.calls.some(c=>c.method==='PUT'),false);
});
test('wrong account or post-deploy revision rejects before installing bridge credentials',async()=>{
 for(const badEnv of [{...env,CLOUDFLARE_ACCOUNT_ID:'wrong'},{...env,GITHUB_SHA:'c'.repeat(40)}]){
  const f=fixture();await assert.rejects(installPreviewBridge({...badEnv,PREVIEW_BRIDGE_CONFIRMATION:'INSTALL_PREVIEW_BRIDGE'},f.fetcher));
  assert.ok(f.calls.every(c=>c.method!=='PUT'));
 }
});

test('live V2 summary probe rejects unexpected personal data without mutating D1',async()=>{
 const fetcher=async(url,init)=>{
   assert.equal(init.method,'GET');
   return Response.json({contract:'boi-account-summary.v2',verified:true,asOf:'2026-11-09T08:00:00.000Z',
     counts:{totalAccounts:1,pending:0,active:1,suspended:0,expired:0,unverified:0},phone:'private'});
 };
 await assert.rejects(verifyV2SummaryLive('synthetic-test-secret',fetcher),/schema or aggregate/);
});

function v2ProbeFetcher(legacyReply){
 const seen=[];
 const fetcher=async(url,init)=>{
  assert.equal(init.method,"GET","live V2 checks are read-only");
  seen.push({url,headers:init.headers});
  if(String(url).includes("/api/control/v2/account-summary")){
   const token=init.headers.authorization;
   if(!token)return Response.json({code:"CONTROL_AUTH_REQUIRED"},{status:401});
   if(token==="Bearer invalid-preview-ticket-without-valid-signature-000000000000000")return Response.json({code:"CONTROL_TICKET_FORBIDDEN"},{status:403});
   if(init.headers["x-control-role"]==="viewer")return Response.json({code:"ACCOUNT_SUMMARY_FORBIDDEN"},{status:403});
   return Response.json({asOf:"2026-11-09T08:00:00.000Z",contract:"boi-account-summary.v2",
    verified:true,counts:{totalAccounts:1,pending:0,active:1,suspended:0,expired:0,unverified:0}});
  }
  if(String(url).includes("/api/control/overview?")){
   assert.equal(init.headers["x-control-role"],"owner");
   assert.equal(init.headers.authorization,"Bearer test-only-bridge-credential");
   return legacyReply();
  }
  throw new Error("Unexpected V2 control route");
 };
 return {fetcher,seen};
}
test("Preview legacy guard retries ONLY bounded app-coded credential propagation, then requires 409",async()=>{
 const outcomes=[
  Response.json({code:"CONTROL_SERVICE_FORBIDDEN"},{status:403}),
  Response.json({code:"CONTROL_TICKET_FORBIDDEN"},{status:403}),
  Response.json({code:"ACCOUNT_CONTROL_REQUIRED"},{status:409})
 ];
 let calls=0;const delays=[];
 const {fetcher,seen}=v2ProbeFetcher(()=>{calls++;return outcomes.shift();});
 const result=await verifyV2SummaryLive("test-only-bridge-credential",fetcher,async ms=>delays.push(ms));
 assert.deepEqual(delays,[1000,2000]);
 assert.equal(calls,3);
 assert.deepEqual(result.statusChecks,[200,200,403,401,403,409]);
 assert.equal(seen.filter(x=>x.url.includes("overview?")).length,3);
});
test("Preview legacy guard refuses unexpected 403, HTML/WAF, wrong 409 code without retries",async()=>{
 const cases=[
  Response.json({code:"CONTROL_ORIGIN_FORBIDDEN"},{status:403}),
  Response.json({code:"ACCOUNT_SUMMARY_FORBIDDEN"},{status:403}),
  new Response("<html>Cloudflare security challenge</html>",{status:403,headers:{"content-type":"text/html"}}),
  Response.json({code:"SOME_OTHER_DENIAL"},{status:403}),
  Response.json({code:"UNRELATED_CONFLICT"},{status:409})
 ];
 for(const outcome of cases){
  let calls=0;const delays=[];
  const {fetcher}=v2ProbeFetcher(()=>{calls++;return outcome.clone();});
  await assert.rejects(verifyV2SummaryLive("test-only-bridge-credential",fetcher,async ms=>delays.push(ms)),
   error=>!error.message.includes("test-only-bridge-credential")&&
    !error.message.includes("Cloudflare security challenge")&&
    /readback mismatch|legacy control guard/.test(error.message));
  assert.equal(calls,1);
  assert.equal(delays.length,0);
 }
});
test("Preview legacy guard exhausting transient 403 stays failed and never bypasses protection",async()=>{
 let calls=0;const delays=[];
 const {fetcher}=v2ProbeFetcher(()=>{calls++;return Response.json({code:"CONTROL_SERVICE_FORBIDDEN"},{status:403});});
 await assert.rejects(verifyV2SummaryLive("test-only-bridge-credential",fetcher,async ms=>delays.push(ms)),
  /got 403; safe code CONTROL_SERVICE_FORBIDDEN/);
 assert.equal(calls,5);
 assert.deepEqual(delays,[1000,2000,4000,8000]);
});

test("Preview V2 new Owner/Publisher credential may converge after transient app-coded 403 only",async()=>{
 const baseline=v2ProbeFetcher(()=>Response.json({code:"ACCOUNT_CONTROL_REQUIRED"},{status:409}));
 const calls={owner:0,publisher:0};const delays=[];
 const secret="test-only-bridge-credential";
 const fetcher=async(url,init)=>{
  if(String(url).includes("/api/control/v2/account-summary")&&
     init.headers.authorization===`Bearer ${secret}`&&
     ["owner","publisher"].includes(init.headers["x-control-role"])){
   const role=init.headers["x-control-role"];
   if(calls[role]++===0)return Response.json({code:"CONTROL_TICKET_FORBIDDEN"},{status:403});
  }
  return baseline.fetcher(url,init);
 };
 const result=await verifyV2SummaryLive(secret,fetcher,async ms=>delays.push(ms));
 assert.deepEqual(delays,[1000,1000],"only valid Owner and Publisher calls may retry");
 assert.equal(calls.owner,2);assert.equal(calls.publisher,2);
 assert.deepEqual(result.statusChecks,[200,200,403,401,403,409]);
 assert.ok(baseline.seen.every(x=>x.headers?.authorization!=="Bearer undefined"));
});
test("Preview V2 refuses incorrect negative-role codes even with matching HTTP status",async()=>{
 const cases=[
  {role:"viewer",code:"CONTROL_TICKET_FORBIDDEN",status:403},
  {role:"owner",token:"invalid-preview-ticket-without-valid-signature-000000000000000",code:"ACCOUNT_SUMMARY_FORBIDDEN",status:403},
  {role:"owner",missing:true,code:"ACCOUNT_SUMMARY_FORBIDDEN",status:401}
 ];
 for(const bad of cases){
  const baseline=v2ProbeFetcher(()=>Response.json({code:"ACCOUNT_CONTROL_REQUIRED"},{status:409}));
  const waits=[];
  const fetcher=async(url,init)=>{
   if(String(url).includes("/api/control/v2/account-summary")&&
     init.headers["x-control-role"]===bad.role&&
     (bad.missing?!init.headers.authorization:
      bad.token?init.headers.authorization===`Bearer ${bad.token}`:Boolean(init.headers.authorization)))
    return Response.json({code:bad.code},{status:bad.status});
   return baseline.fetcher(url,init);
  };
  await assert.rejects(verifyV2SummaryLive("test-only-bridge-credential",fetcher,async ms=>waits.push(ms)),
    /negative-role contract mismatch/);
  assert.deepEqual(waits,[],"never retry negative-role failure");
 }
});
test("Preview V2 persistent new-credential 403 always fails closed after bounded five attempts",async()=>{
 const baseline=v2ProbeFetcher(()=>Response.json({code:"ACCOUNT_CONTROL_REQUIRED"},{status:409}));
 let attempts=0;const delays=[];const secret="test-only-bridge-credential";
 const fetcher=async(url,init)=>{
  if(String(url).includes("/api/control/v2/account-summary")&&
     init.headers["x-control-role"]==="owner"&&init.headers.authorization===`Bearer ${secret}`){
    attempts++;return Response.json({code:"CONTROL_TICKET_FORBIDDEN"},{status:403});
  }
  return baseline.fetcher(url,init);
 };
 await assert.rejects(verifyV2SummaryLive(secret,fetcher,async ms=>delays.push(ms)),
    /expected HTTP 200, got 403; safe code CONTROL_TICKET_FORBIDDEN/);
 assert.equal(attempts,5);
 assert.deepEqual(delays,[1000,2000,4000,8000]);
});

test("Preview invalid-ticket contract uses a genuinely long malformed bearer, not a short service key",()=>{
 const server=fs.readFileSync(new URL("../app/control-auth.server.ts",import.meta.url),"utf8");
 const preview=fs.readFileSync(new URL("../scripts/preview-stack-remote.mjs",import.meta.url),"utf8");
 const example="invalid-preview-ticket-without-valid-signature-000000000000000";
 assert.ok(example.length>=32);
 assert.match(server,/configured\.length < 32 \|\| supplied\.length < 32/);
 assert.match(server,/CONTROL_SERVICE_FORBIDDEN/);
 assert.match(server,/if \(!ticket \|\| ticket\.scope !== scope\)/);
 assert.match(server,/CONTROL_TICKET_FORBIDDEN/);
 assert.ok(preview.includes(`"owner", "${example}", 403`));
 assert.ok(preview.includes(`bearer==="${example}"?"CONTROL_TICKET_FORBIDDEN"`));
});
