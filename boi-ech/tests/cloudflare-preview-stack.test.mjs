import test from "node:test";
import assert from "node:assert/strict";
import { checkPreviewStack, installPreviewBridge, verifyV2SummaryLive } from "../scripts/preview-stack-remote.mjs";

const account="f88a42260814230aa4a151abbfe5659d";
const borrowed="4094a621-3b81-4533-9694-4a2103e03363";
const appId="00f8a685-452f-472c-81c5-4d0b1c4037c9";
const env={CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:"test-api-token",BOI_ECH_PREVIEW_D1_DATABASE_NAME:"bauman-control-preview-db",BOI_ECH_PREVIEW_D1_DATABASE_ID:borrowed,CONTROL_OWNER_EMAILS:"owner@fixture.invalid",GITHUB_SHA:"a".repeat(40),APPLICATION_MANAGEMENT_BUILD_REVISION:"b".repeat(40)};
function fixture(change=()=>{}) {
 const calls=[];
 const settings={
  "bauman-control-preview":{bindings:[]},
  "boi-ech-preview":{bindings:[{name:"DB",type:"d1",id:borrowed},{name:"BOI_ECH_BUILD_REVISION",type:"plain_text",text:env.GITHUB_SHA},{name:"BOI_ECH_DEPLOYMENT_CHANNEL",type:"plain_text",text:"cloudflare-preview"}]},
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
    if(token==='invalid-preview-ticket')return Response.json({code:'CONTROL_TICKET_FORBIDDEN'},{status:403});
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
test('bridge installation needs exact action confirmation and only writes both named Preview secrets',async()=>{
 const denied=fixture();await assert.rejects(installPreviewBridge(env,denied.fetcher),/INSTALL_PREVIEW_BRIDGE/);
 assert.equal(denied.calls.length,0);
 const f=fixture();const result=await installPreviewBridge({...env,PREVIEW_BRIDGE_CONFIRMATION:'INSTALL_PREVIEW_BRIDGE'},f.fetcher);
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
