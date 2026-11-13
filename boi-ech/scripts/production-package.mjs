import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const account='f88a42260814230aa4a151abbfe5659d';
const id='7816425d-ce8a-4b3c-b303-7697fd4a529c';
const origin='https://boi-ech.boiech-ai.workers.dev';
function accountMode(vars,activate=false,activateSingleReview=false){
 if(activate){vars.BOI_ECH_ACCOUNT_FIRST='true';vars.BOI_ECH_ACCOUNT_V2='true';vars.BOI_ECH_ACCOUNT_ORIGIN=origin;}
 const enabled=vars.BOI_ECH_ACCOUNT_FIRST==='true';
 if(enabled!==(vars.BOI_ECH_ACCOUNT_V2==='true')||(enabled&&vars.BOI_ECH_ACCOUNT_ORIGIN!==origin))throw new Error('Production account flags/origin mismatch');
 if((activateSingleReview||vars.BOI_ECH_SINGLE_REVIEW==='true')&&!enabled)throw new Error('Production single-review requires Account-first V2');
 if(vars.BOI_ECH_UI_TRIAL==='true')throw new Error('Production cannot use the local account trial');
 if(activateSingleReview)vars.BOI_ECH_SINGLE_REVIEW='true';
 return enabled;
}
export function productionPackage(settings,revision,activate=false,activateSingleReview=false){
 if(settings?.success!==true||!Array.isArray(settings.result?.bindings)||!/^[a-f0-9]{40}$/.test(revision??''))throw new Error('Production metadata unavailable');
 const bindings=settings.result.bindings,dbs=bindings.filter(b=>b.type==='d1');
 if(dbs.length!==1||dbs[0].name!=='DB'||dbs[0].id!==id)throw new Error('Existing boi-ech-db binding mismatch');
 if(!bindings.some(b=>b.type==='secret_text'&&b.name==='CONTROL_SERVICE_SECRET'))throw new Error('Existing production bridge is missing');
 const vars=Object.fromEntries(bindings.filter(b=>b.type==='plain_text').map(b=>[b.name,b.text]));
 if(vars.BOI_ECH_ACCESS_MODE!=='managed'||vars.LOCAL_CONTROL_PLANE==='true')throw new Error('Production managed access must be retained');
 accountMode(vars,activate,activateSingleReview);
 return {name:'boi-ech',main:'./worker/index.ts',compatibility_date:'2026-09-11',compatibility_flags:['nodejs_compat'],workers_dev:true,
  assets:{binding:'ASSETS',run_worker_first:false},images:{binding:'IMAGES'},
  d1_databases:[{binding:'DB',database_name:'boi-ech-db',database_id:id,migrations_dir:'drizzle'}],
  vars:{...vars,BOI_ECH_BUILD_REVISION:revision,BOI_ECH_DEPLOYMENT_CHANNEL:'cloudflare-production',BOI_ECH_BUILD_SOURCE:'BlueDragon33/BOIECH_AI/boi-ech',APPLICATION_MANAGEMENT_ORIGIN:'https://application-management.boiech-ai.workers.dev'}};
}
export function verifyProductionArtifact(c,revision,activate=false,requireSingleReview=false){
 if(c.name!=='boi-ech'||c.d1_databases?.length!==1||c.d1_databases[0].binding!=='DB'||c.d1_databases[0].database_name!=='boi-ech-db'||c.d1_databases[0].database_id!==id)throw new Error('Production Worker/database mismatch');
 if(c.assets?.binding!=='ASSETS'||c.assets.run_worker_first!==false||c.images?.binding!=='IMAGES'||(c.r2_buckets!==undefined&&(!Array.isArray(c.r2_buckets)||c.r2_buckets.length)))throw new Error('Production FREE asset/storage mismatch');
 if(c.vars?.BOI_ECH_ACCESS_MODE!=='managed'||c.vars.BOI_ECH_BUILD_REVISION!==revision||c.vars.BOI_ECH_DEPLOYMENT_CHANNEL!=='cloudflare-production'||c.vars.LOCAL_CONTROL_PLANE==='true')throw new Error('Production revision/access policy mismatch');
 if(!accountMode(c.vars)&&activate)throw new Error('Requested Account-first activation missing');
 if(requireSingleReview&&c.vars.BOI_ECH_SINGLE_REVIEW!=='true')throw new Error('Requested single-review activation missing');
}
export function rollbackPoint(bookmark,deployments){
 const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
 if(!/^[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{32}$/i.test(bookmark?.bookmark??'')||!Array.isArray(deployments)||!deployments.length||deployments.some(d=>!Number.isFinite(Date.parse(d.created_on))))throw new Error('Production rollback metadata missing');
 const latest=[...deployments].sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0];
 if(!uuid.test(latest.id??'')||!Array.isArray(latest.versions)||!latest.versions.length||latest.versions.some(v=>!uuid.test(v.version_id??'')||!Number.isFinite(v.percentage)||v.percentage<=0||v.percentage>100)||Math.abs(latest.versions.reduce((n,v)=>n+v.percentage,0)-100)>0.00001)throw new Error('Production rollback version missing');
 return {databaseBookmark:bookmark.bookmark,previousDeployment:latest.id,previousVersions:latest.versions};
}
export async function verifyPublicAssets(files,http=fetch){
 if(!files.some(f=>f.endsWith('.js'))||!files.some(f=>f.endsWith('.css')))throw new Error('Production JS/CSS probes missing');
 for(const file of files){
  if(!/^assets\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(file))throw new Error('Invalid public asset path');
  const r=await http('https://boi-ech.boiech-ai.workers.dev/'+file,{redirect:'error',signal:AbortSignal.timeout(15000)});
  const type=r.headers.get('content-type')??'';
  if(r.status!==200||!(file.endsWith('.js')?/javascript|ecmascript/i.test(type):/text\/css/i.test(type)))throw new Error(`Production public asset failed: ${file} HTTP ${r.status}`);
 }
}
/**
 * Cloudflare can report an older Worker settings revision for a short period
 * immediately after a successful Wrangler deploy. Retry only that observed
 * revision/flag propagation window; every poll independently validates the
 * existing Worker name, D1 binding, secret presence and managed policy.
 * Never turn a permanent mismatch into PASS.
 */
export async function waitForLiveProductionRevision(load,revision,{
 activate=false,singleReview=false,attempts=18,intervalMs=5000,
 sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
 onPending=()=>{}
}={}){
 if(!/^[a-f0-9]{40}$/.test(revision??'')||!Number.isSafeInteger(attempts)||attempts<1||attempts>30
   ||!Number.isSafeInteger(intervalMs)||intervalMs<0||intervalMs>10000)
  throw new Error('Production revision readback configuration invalid');
 let observed='missing';
 for(let attempt=1;attempt<=attempts;attempt++){
  const live=await load();
  // Structural/safety guards must pass on EVERY observation, even a stale one.
  productionPackage(live,revision);
  const vars=Object.fromEntries(live.result.bindings.filter(b=>b.type==='plain_text').map(b=>[b.name,b.text]));
  observed=typeof vars.BOI_ECH_BUILD_REVISION==='string'?vars.BOI_ECH_BUILD_REVISION:'missing';
  const verified=observed===revision
    &&vars.BOI_ECH_DEPLOYMENT_CHANNEL==='cloudflare-production'
    &&(!activate||accountMode(vars))
    &&(!singleReview||vars.BOI_ECH_SINGLE_REVIEW==='true');
  if(verified)return {worker:'boi-ech',database:'boi-ech-db',revision:observed,
    channel:vars.BOI_ECH_DEPLOYMENT_CHANNEL,
    accountFirstV2:accountMode(vars),singleReview:vars.BOI_ECH_SINGLE_REVIEW==='true',
    readbackAttempt:attempt};
  if(attempt===attempts)break;
  onPending({attempt,attempts,observedRevision:observed});
  await sleep(intervalMs);
 }
 throw new Error(`Live production revision mismatch after ${attempts} attempts (observed ${observed.slice(0,40)}; expected ${revision}).`);
}

async function settings(){
 if(String(process.env.CLOUDFLARE_ACCOUNT_ID??'').trim()!==account||!process.env.CLOUDFLARE_API_TOKEN)throw new Error('Existing production credentials unavailable');
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/boi-ech/settings`,{headers:{authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`},redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error(`Production metadata HTTP ${r.status}`);
 return r.json();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const mode=process.argv[2],revision=process.env.GITHUB_SHA,activate=process.env.BOI_ECH_ACTIVATE_ACCOUNT_FIRST==='true';
 const singleReview=process.env.BOI_ECH_ACTIVATE_SINGLE_REVIEW==='true';
 if(mode==='prepare'){
  const live=await settings();fs.mkdirSync('.sites-runtime/production-release',{recursive:true,mode:0o700});
  fs.writeFileSync('.sites-runtime/production-release/before.json',JSON.stringify({revision:live.result.bindings.find(b=>b.name==='BOI_ECH_BUILD_REVISION')?.text}),{mode:0o600});
  const config=productionPackage(live,revision,activate,singleReview);
  fs.writeFileSync('wrangler.cloudflare.production.jsonc',JSON.stringify(config,null,2),{mode:0o600});
  const enabled=config.vars.BOI_ECH_ACCOUNT_V2==='true';
  const alreadyEnabled=live.result.bindings.some(binding=>binding.name==='BOI_ECH_ACCOUNT_FIRST'&&binding.text==='true');
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,
    `account_v2=${enabled}\nmap_legacy=${activate&&!alreadyEnabled}\nsingle_review=${config.vars.BOI_ECH_SINGLE_REVIEW==='true'}\n`);
  console.log(`Prepared existing boi-ech / boi-ech-db; encrypted secrets retained. Account-first V2=${enabled}.`);
 }else if(mode==='artifact'){
  const redirect=JSON.parse(fs.readFileSync('.wrangler/deploy/config.json','utf8'));
  const file=path.resolve('.wrangler/deploy',redirect.configPath),root=path.resolve('dist')+path.sep;
  if(!file.startsWith(root))throw new Error('Generated config must be under dist');
  verifyProductionArtifact(JSON.parse(fs.readFileSync(file,'utf8')),revision,activate,singleReview);console.log('Exact production Worker / D1 / revision / access artifact PASS.');
 }else if(mode==='assets'){
  const redirect=JSON.parse(fs.readFileSync('.wrangler/deploy/config.json','utf8'));
  const file=path.resolve('.wrangler/deploy',redirect.configPath),c=JSON.parse(fs.readFileSync(file,'utf8'));
  const directory=path.resolve(path.dirname(file),c.assets.directory,'assets');
  const probes=fs.readdirSync(directory).filter(n=>/^index-.*\.js$/.test(n)||n.endsWith('.css')).map(n=>'assets/'+n);
  await verifyPublicAssets(probes);console.log('Live production JavaScript/CSS asset read-back PASS.');
 }else if(mode==='readback'){
  const verified=await waitForLiveProductionRevision(settings,revision,{
   activate,singleReview,
   onPending:({attempt,attempts,observedRevision})=>
    console.log(`Worker metadata propagation: observation ${attempt}/${attempts}, revision ${observedRevision.slice(0,12)}; checking again...`)
  });
  console.log(JSON.stringify(verified));
 }else throw new Error('Unknown production package mode');
}
