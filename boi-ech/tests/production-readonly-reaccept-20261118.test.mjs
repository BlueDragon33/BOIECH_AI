import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {reacceptDeployedProduction,EXPECTED_DEPLOYED_REVISION,INCIDENT_ASSET_PROBES}
 from '../scripts/production-readonly-reaccept-20261118.mjs';

const account='f88a42260814230aa4a151abbfe5659d';
const env={CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:'synthetic-test-only-not-real',
 PRODUCTION_READONLY_CONFIRM:'VERIFY_EXISTING_PRODUCTION'};
function fixture({revision=EXPECTED_DEPLOYED_REVISION,db='7816425d-ce8a-4b3c-b303-7697fd4a529c',missingCss=0,badContract=false}={}){
 const calls=[];const seen=new Map();
 const settings={success:true,result:{bindings:[
  {type:'d1',name:'DB',id:db},{type:'secret_text',name:'CONTROL_SERVICE_SECRET'},
  ...Object.entries({
   BOI_ECH_ACCESS_MODE:'managed',BOI_ECH_BUILD_REVISION:revision,
   BOI_ECH_DEPLOYMENT_CHANNEL:'cloudflare-production',
   BOI_ECH_ACCOUNT_FIRST:'true',BOI_ECH_ACCOUNT_V2:'true',
   BOI_ECH_ACCOUNT_ORIGIN:'https://boi-ech.boiech-ai.workers.dev',
   BOI_ECH_SINGLE_REVIEW:'true'
  }).map(([name,text])=>({type:'plain_text',name,text}))
 ]}};
 const fetcher=async(url,options={})=>{
  calls.push({url,options});
  if(url.startsWith('https://api.cloudflare.com/'))return Response.json(settings);
  if(url.endsWith('/api/application-management/contract'))return Response.json({
   schema:'application-management.contract/v1',application:{id:'boi-ech',category:'Học tập'},
   capabilities:{payments:!badContract,webLaunch:true,deviceApproval:false},
   policy:{genericDeviceMutationAllowed:false}
  });
  if(url.includes('/assets/')){
   const file=url.split('/assets/')[1],n=(seen.get(file)||0)+1;seen.set(file,n);
   if(file==='manager-workspace-BNv1YLk2.css'&&n<=missingCss)
    return new Response('Not Found',{status:404});
   return new Response('',{status:200,headers:{'content-type':file.endsWith('.css')?'text/css':'application/javascript'}});
  }
  throw new Error('Unexpected live read path '+url);
 };
 return {calls,seen,fetcher};
}
test('Read-only incident acceptance verifies exact deployed SHA, contract, original manager CSS and role assets',async()=>{
 const f=fixture();
 const out=await reacceptDeployedProduction({env,fetcher:f.fetcher,pause:async()=>{},
  retryDelays:[0,0,0]});
 assert.equal(out.verified,true);
 assert.equal(out.revision,EXPECTED_DEPLOYED_REVISION);
 assert.equal(out.accountFirstV2,true);
 assert.equal(out.singleReview,true);
 assert.equal(out.checkedAssets,INCIDENT_ASSET_PROBES.length);
 assert.equal(out.noRemoteWrites,true);
 assert.equal(out.privateRoleAcceptance,'NOT_TESTED');
 assert.equal(f.calls.length,INCIDENT_ASSET_PROBES.length+2);
 assert.ok(f.calls.every(x=>x.options.method===undefined||x.options.method==='GET'));
 assert.ok(f.calls.every(x=>x.options.redirect==='error'&&x.options.cache==='no-store'));
 assert.ok(f.calls.some(x=>x.url.endsWith('/assets/manager-workspace-BNv1YLk2.css')));
});
test('Read-only acceptance retries transient asset 404 but never calls mutation endpoints',async()=>{
 const f=fixture({missingCss:2});const waits=[];
 const out=await reacceptDeployedProduction({env,fetcher:f.fetcher,pause:async ms=>waits.push(ms),
  retryDelays:[0,1000,2000,4000]});
 assert.equal(out.verified,true);
 assert.deepEqual(waits,[1000,2000]);
 assert.equal(f.seen.get('manager-workspace-BNv1YLk2.css'),3);
 assert.ok(f.calls.every(x=>x.options.method!== 'PUT'&&x.options.method!== 'POST'&&x.options.method!== 'DELETE'));
});
test('Read-only acceptance fails on persistent CSS 404, wrong revision, wrong D1, or contract drift',async()=>{
 for(const options of [{missingCss:8},{revision:'d'.repeat(40)},{db:'4094a621-3b81-4533-9694-4a2103e03363'},{badContract:true}]){
  const f=fixture(options);
  await assert.rejects(reacceptDeployedProduction({env,fetcher:f.fetcher,pause:async()=>{},
   retryDelays:[0,0,0]}));
  assert.ok(f.calls.every(x=>!x.options.method||x.options.method==='GET'));
 }
});
test('Read-only acceptance requires exact environment intent before even reading Cloudflare',async()=>{
 const f=fixture();
 await assert.rejects(reacceptDeployedProduction({env:{...env,PRODUCTION_READONLY_CONFIRM:'INVALID'},
  fetcher:f.fetcher}),/confirmation/);
 assert.equal(f.calls.length,0);
});
test('Incident reacceptance is a protected GET-only workflow, not a disguised redeploy',()=>{
 const file=fs.readFileSync(new URL('../../.github/workflows/verify-boi-ech-production-readonly.yml',import.meta.url),'utf8');
 assert.match(file,/environment: boi-ech-production/);
 assert.match(file,/VERIFY_EXISTING_PRODUCTION/);
 assert.match(file,/production-readonly-reaccept-20261118\.mjs/);
 assert.doesNotMatch(file,/wrangler d1|wrangler deploy|migrations apply|deploy-cloudflare|DEPLOY_PRODUCTION|install-bridge/i);
 const script=fs.readFileSync(new URL('../scripts/production-readonly-reaccept-20261118.mjs',import.meta.url),'utf8');
 assert.match(script,/EXPECTED_DEPLOYED_REVISION='bba6f04adec15eccf9993b0c164cd8e278b18f07'/);
 assert.doesNotMatch(script,/method:\s*['"](?:PUT|POST|DELETE)['"]|\.prepare\(|\.batch\(|wrangler deploy/);
});
