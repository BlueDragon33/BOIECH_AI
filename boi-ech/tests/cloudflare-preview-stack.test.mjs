import test from "node:test";
import assert from "node:assert/strict";
import { checkPreviewStack, installPreviewBridge } from "../scripts/preview-stack-remote.mjs";

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
});
test('wrong account or post-deploy revision rejects before installing bridge credentials',async()=>{
 for(const badEnv of [{...env,CLOUDFLARE_ACCOUNT_ID:'wrong'},{...env,GITHUB_SHA:'c'.repeat(40)}]){
  const f=fixture();await assert.rejects(installPreviewBridge({...badEnv,PREVIEW_BRIDGE_CONFIRMATION:'INSTALL_PREVIEW_BRIDGE'},f.fetcher));
  assert.ok(f.calls.every(c=>c.method!=='PUT'));
 }
});
