import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const account='f88a42260814230aa4a151abbfe5659d';
const id='7816425d-ce8a-4b3c-b303-7697fd4a529c';
export function productionPackage(settings,revision){
 if(settings?.success!==true||!Array.isArray(settings.result?.bindings)||!/^[a-f0-9]{40}$/.test(revision??''))throw new Error('Production metadata unavailable');
 const bindings=settings.result.bindings,dbs=bindings.filter(b=>b.type==='d1');
 if(dbs.length!==1||dbs[0].name!=='DB'||dbs[0].id!==id)throw new Error('Existing boi-ech-db binding mismatch');
 if(!bindings.some(b=>b.type==='secret_text'&&b.name==='CONTROL_SERVICE_SECRET'))throw new Error('Existing production bridge is missing');
 const vars=Object.fromEntries(bindings.filter(b=>b.type==='plain_text').map(b=>[b.name,b.text]));
 if(vars.BOI_ECH_ACCESS_MODE!=='managed'||vars.LOCAL_CONTROL_PLANE==='true'||vars.BOI_ECH_ACCOUNT_FIRST==='true'||vars.BOI_ECH_ACCOUNT_V2==='true')throw new Error('Production access mode must be preserved; V2 activation is a separate acceptance gate');
 return {name:'boi-ech',main:'./worker/index.ts',compatibility_date:'2026-09-11',compatibility_flags:['nodejs_compat'],workers_dev:true,
  assets:{binding:'ASSETS',run_worker_first:true},images:{binding:'IMAGES'},
  d1_databases:[{binding:'DB',database_name:'boi-ech-db',database_id:id,migrations_dir:'drizzle'}],
  vars:{...vars,BOI_ECH_BUILD_REVISION:revision,BOI_ECH_DEPLOYMENT_CHANNEL:'cloudflare-production',BOI_ECH_BUILD_SOURCE:'BlueDragon33/BOIECH_AI/boi-ech',APPLICATION_MANAGEMENT_ORIGIN:'https://application-management.boiech-ai.workers.dev'}};
}
export function verifyProductionArtifact(c,revision){
 if(c.name!=='boi-ech'||c.d1_databases?.length!==1||c.d1_databases[0].binding!=='DB'||c.d1_databases[0].database_name!=='boi-ech-db'||c.d1_databases[0].database_id!==id)throw new Error('Production Worker/database mismatch');
 if(c.assets?.binding!=='ASSETS'||c.images?.binding!=='IMAGES'||(c.r2_buckets!==undefined&&(!Array.isArray(c.r2_buckets)||c.r2_buckets.length)))throw new Error('Production FREE asset/storage mismatch');
 if(c.vars?.BOI_ECH_ACCESS_MODE!=='managed'||c.vars.BOI_ECH_BUILD_REVISION!==revision||c.vars.BOI_ECH_DEPLOYMENT_CHANNEL!=='cloudflare-production'||c.vars.BOI_ECH_ACCOUNT_FIRST==='true'||c.vars.BOI_ECH_ACCOUNT_V2==='true'||c.vars.LOCAL_CONTROL_PLANE==='true')throw new Error('Production revision/access policy mismatch');
}
export function rollbackPoint(bookmark,deployments){
 const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
 if(!/^[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{32}$/i.test(bookmark?.bookmark??'')||!Array.isArray(deployments)||!deployments.length||deployments.some(d=>!Number.isFinite(Date.parse(d.created_on))))throw new Error('Production rollback metadata missing');
 const latest=[...deployments].sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0];
 if(!uuid.test(latest.id??'')||!Array.isArray(latest.versions)||!latest.versions.length||latest.versions.some(v=>!uuid.test(v.version_id??'')||!Number.isFinite(v.percentage)||v.percentage<=0||v.percentage>100)||Math.abs(latest.versions.reduce((n,v)=>n+v.percentage,0)-100)>0.00001)throw new Error('Production rollback version missing');
 return {databaseBookmark:bookmark.bookmark,previousDeployment:latest.id,previousVersions:latest.versions};
}
async function settings(){
 if(String(process.env.CLOUDFLARE_ACCOUNT_ID??'').trim()!==account||!process.env.CLOUDFLARE_API_TOKEN)throw new Error('Existing production credentials unavailable');
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/boi-ech/settings`,{headers:{authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`},redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error(`Production metadata HTTP ${r.status}`);
 return r.json();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const mode=process.argv[2],revision=process.env.GITHUB_SHA;
 if(mode==='prepare'){
  const live=await settings();fs.mkdirSync('.sites-runtime/production-release',{recursive:true,mode:0o700});
  fs.writeFileSync('.sites-runtime/production-release/before.json',JSON.stringify({revision:live.result.bindings.find(b=>b.name==='BOI_ECH_BUILD_REVISION')?.text}),{mode:0o600});
  fs.writeFileSync('wrangler.cloudflare.production.jsonc',JSON.stringify(productionPackage(live,revision),null,2),{mode:0o600});
  console.log('Prepared existing boi-ech / boi-ech-db; retained access mode and encrypted secrets. Account-first V2 remains OFF pending acceptance.');
 }else if(mode==='artifact'){
  const redirect=JSON.parse(fs.readFileSync('.wrangler/deploy/config.json','utf8'));
  const file=path.resolve('.wrangler/deploy',redirect.configPath),root=path.resolve('dist')+path.sep;
  if(!file.startsWith(root))throw new Error('Generated config must be under dist');
  verifyProductionArtifact(JSON.parse(fs.readFileSync(file,'utf8')),revision);console.log('Exact production Worker / D1 / revision / access artifact PASS.');
 }else if(mode==='readback'){
  const live=await settings(),vars=Object.fromEntries(live.result.bindings.filter(b=>b.type==='plain_text').map(b=>[b.name,b.text]));
  productionPackage(live,revision);
  if(vars.BOI_ECH_BUILD_REVISION!==revision||vars.BOI_ECH_DEPLOYMENT_CHANNEL!=='cloudflare-production')throw new Error('Live production revision mismatch');
  console.log(JSON.stringify({worker:'boi-ech',database:'boi-ech-db',revision:vars.BOI_ECH_BUILD_REVISION,channel:vars.BOI_ECH_DEPLOYMENT_CHANNEL,accountFirstV2:false}));
 }else throw new Error('Unknown production package mode');
}
