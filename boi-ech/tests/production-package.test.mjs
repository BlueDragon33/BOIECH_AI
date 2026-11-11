import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import yaml from 'js-yaml';
import { productionPackage, verifyProductionArtifact, verifyPublicAssets } from '../scripts/production-package.mjs';
const revision='a'.repeat(40);
function settings(){return {success:true,result:{bindings:[{type:'d1',name:'DB',id:'7816425d-ce8a-4b3c-b303-7697fd4a529c'},{type:'secret_text',name:'CONTROL_SERVICE_SECRET'},{type:'plain_text',name:'BOI_ECH_ACCESS_MODE',text:'managed'},{type:'plain_text',name:'EXISTING_POLICY',text:'retained'}]}};}
test('Production package uses existing boi-ech-db, retains runtime policy and never copies secret values',()=>{
 const config=productionPackage(settings(),revision);
 assert.equal(config.name,'boi-ech');assert.equal(config.d1_databases[0].database_name,'boi-ech-db');
 assert.equal(config.vars.EXISTING_POLICY,'retained');assert.equal(config.vars.BOI_ECH_BUILD_REVISION,revision);
 assert.equal('CONTROL_SERVICE_SECRET' in config.vars,false);assert.notEqual(config.vars.BOI_ECH_ACCOUNT_V2,'true');
 assert.deepEqual(config.r2_buckets??[],[]);
 assert.equal(config.assets.run_worker_first,false,'Public client JS/CSS must be served by the asset handler before the app router');
});
test('Production preparation refuses an unexpected database, extra D1 or absent existing bridge',()=>{
 for(const change of [s=>s.result.bindings[0].id='4094a621-3b81-4533-9694-4a2103e03363',s=>s.result.bindings.push({type:'d1',name:'OTHER',id:'7816425d-ce8a-4b3c-b303-7697fd4a529c'}),s=>s.result.bindings=s.result.bindings.filter(b=>b.type!=='secret_text')]){
  const s=settings();change(s);assert.throws(()=>productionPackage(s,revision));
 }
});
test('generated Production package blocks wrong Worker, preview D1, R2 and unintended account-mode activation',()=>{
 const base=productionPackage(settings(),revision);assert.doesNotThrow(()=>verifyProductionArtifact(base,revision));
 for(const change of [c=>c.name='boi-ech-preview',c=>c.d1_databases[0].database_id='4094a621-3b81-4533-9694-4a2103e03363',c=>c.r2_buckets=[{binding:'OTHER',bucket_name:'unexpected'}],c=>c.vars.BOI_ECH_ACCOUNT_V2='true']){
  const c=structuredClone(base);change(c);assert.throws(()=>verifyProductionArtifact(c,revision));
 }
});
test('actual rollback workflow records newest deployment when Wrangler returns oldest first',()=>{
 const workflow=yaml.load(fs.readFileSync(new URL('../../.github/workflows/deploy-cloudflare.yml',import.meta.url),'utf8'));
 const step=workflow.jobs.deploy.steps.find(s=>s.name==='Capture D1 and Worker rollback points before any migration');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'boi-prod-rollback-'));
 try{
  fs.mkdirSync(path.join(dir,'.sites-runtime/production-release'),{recursive:true});
  fs.symlinkSync(fileURLToPath(new URL('../scripts',import.meta.url)),path.join(dir,'scripts'),'dir');
  fs.writeFileSync(path.join(dir,'npx'),'#!/bin/sh\ncase "$2" in d1) printf "%s" "$TEST_BOOKMARK";; deployments) printf "%s" "$TEST_DEPLOYMENTS";; *) exit 9;; esac\n',{mode:0o755});
  const old={id:'11111111-1111-4111-8111-111111111111',created_on:'2026-11-01T00:00:00Z',versions:[{version_id:'33333333-3333-4333-8333-333333333333',percentage:100}]};
  const latest={id:'22222222-2222-4222-8222-222222222222',created_on:'2026-11-08T00:00:00Z',versions:[{version_id:'44444444-4444-4444-8444-444444444444',percentage:100}]};
  const r=spawnSync('bash',['-e','-c',step.run],{cwd:dir,encoding:'utf8',env:{...process.env,PATH:dir+':'+process.env.PATH,TEST_BOOKMARK:JSON.stringify({bookmark:'00000001-00000000-00000001-'+ 'a'.repeat(32)}),TEST_DEPLOYMENTS:JSON.stringify([old,latest])}});
  assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout.trim());
  assert.equal(result.previousDeployment,latest.id);assert.deepEqual(result.previousVersions,latest.versions);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('live public asset checks reject missing or HTML JavaScript responses',async()=>{
 const files=['assets/index-abc.js','assets/index-abc.css'];
 await assert.doesNotReject(verifyPublicAssets(files,async url=>new Response('',{headers:{'content-type':url.endsWith('.js')?'text/javascript':'text/css'}})));
 for(const r of [new Response('Not Found',{status:404}),new Response('<html>',{headers:{'content-type':'text/html'}})])await assert.rejects(verifyPublicAssets(files,async()=>r),/Production public asset failed/);
});
test('explicit Account-first activation sets both flags and the canonical CSRF origin without changing existing policy',()=>{
 const c=productionPackage(settings(),revision,true);
 assert.equal(c.vars.BOI_ECH_ACCOUNT_FIRST,'true');assert.equal(c.vars.BOI_ECH_ACCOUNT_V2,'true');
 assert.equal(c.vars.BOI_ECH_ACCOUNT_ORIGIN,'https://boi-ech.boiech-ai.workers.dev');
 assert.equal(c.vars.EXISTING_POLICY,'retained');assert.equal(c.vars.BOI_ECH_ACCESS_MODE,'managed');
 assert.doesNotThrow(()=>verifyProductionArtifact(c,revision,true));
});
test('later releases retain an activated account mode and reject inconsistent or foreign-origin modes',()=>{
 const s=settings();s.result.bindings.push(...Object.entries({BOI_ECH_ACCOUNT_FIRST:'true',BOI_ECH_ACCOUNT_V2:'true',BOI_ECH_ACCOUNT_ORIGIN:'https://boi-ech.boiech-ai.workers.dev'}).map(([name,text])=>({type:'plain_text',name,text})));
 assert.equal(productionPackage(s,revision).vars.BOI_ECH_ACCOUNT_V2,'true');
 for(const change of [s=>s.result.bindings.find(b=>b.name==='BOI_ECH_ACCOUNT_FIRST').text='false',s=>s.result.bindings.find(b=>b.name==='BOI_ECH_ACCOUNT_ORIGIN').text='https://other.invalid']){const bad=structuredClone(s);change(bad);assert.throws(()=>productionPackage(bad,revision));}
});
test('an explicit single-review activation can release without rerunning legacy mapping',()=>{
 const s=settings();
 const active=productionPackage(s,revision,true);
 s.result.bindings.push(...Object.entries(active.vars)
   .filter(([name])=>name.startsWith('BOI_ECH_ACCOUNT_'))
   .map(([name,text])=>({type:'plain_text',name,text})));
 assert.equal(productionPackage(s,revision,false,true).vars.BOI_ECH_SINGLE_REVIEW,'true');
 assert.throws(()=>productionPackage(settings(),revision,false,true),/requires Account-first V2/);
 assert.throws(()=>verifyProductionArtifact(active,revision,false,true),/single-review/);
});
