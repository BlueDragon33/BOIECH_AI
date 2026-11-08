import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const script=path.join(root,'scripts/prepare-cloudflare-preview.mjs');
const template=fs.readFileSync(path.join(root,'wrangler.cloudflare.preview.example.jsonc'),'utf8');
const previewD1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const productionD1='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const defaults={
 BOI_ECH_PREVIEW_D1_DATABASE_ID:previewD1,
 BOI_ECH_PRODUCTION_D1_DATABASE_ID:productionD1,
 BOI_ECH_PREVIEW_ORIGIN:'https://boi-ech-preview.example.invalid',
 APPLICATION_MANAGEMENT_PREVIEW_ORIGIN:'https://application-management-preview.example.invalid',
 GITHUB_SHA:'a'.repeat(40)
};
function prepare(override={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'boi-preview-preflight-'));
 try{
  fs.writeFileSync(path.join(dir,'wrangler.cloudflare.preview.example.jsonc'),template);
  const result=spawnSync(process.execPath,[script],{cwd:dir,
   env:{...process.env,...defaults,...override},encoding:'utf8',timeout:10_000});
  assert.equal(result.error,undefined);
  const output=path.join(dir,'wrangler.cloudflare.preview.jsonc');
  const exists=fs.existsSync(output);
  const rendered=exists?fs.readFileSync(output,'utf8'):'';
  return {result,rendered,exists};
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
test('isolated Preview materializer generates V2 account origin, flags and distinct D1 only with valid nonproduction configuration',()=>{
 const {result,rendered,exists}=prepare();
 assert.equal(result.status,0,result.stderr);
 assert.equal(exists,true);
 const config=JSON.parse(rendered);
 assert.equal(config.name,'boi-ech-preview');
 assert.equal(config.d1_databases[0].database_id,previewD1);
 assert.equal(config.vars.BOI_ECH_ACCOUNT_FIRST,'true');
 assert.equal(config.vars.BOI_ECH_ACCOUNT_V2,'true');
 assert.equal(config.vars.BOI_ECH_ACCOUNT_ORIGIN,defaults.BOI_ECH_PREVIEW_ORIGIN);
 assert.equal(config.vars.APPLICATION_MANAGEMENT_ORIGIN,defaults.APPLICATION_MANAGEMENT_PREVIEW_ORIGIN);
 assert.equal('CONTROL_SERVICE_SECRET' in config.vars,false,'shared service secret must be a protected Worker secret');
 assert.equal(JSON.stringify(config).includes(productionD1),false);
});
test('Preview materializer fails closed for equal production D1, absent/colliding origins and HTTP fallback',()=>{
 const cases=[
  {BOI_ECH_PREVIEW_D1_DATABASE_ID:productionD1},
  {BOI_ECH_PREVIEW_ORIGIN:''},
  {APPLICATION_MANAGEMENT_PREVIEW_ORIGIN:''},
  {APPLICATION_MANAGEMENT_PREVIEW_ORIGIN:defaults.BOI_ECH_PREVIEW_ORIGIN},
  {BOI_ECH_PREVIEW_ORIGIN:'http://localhost:3000'},
  {BOI_ECH_PREVIEW_D1_DATABASE_ID:'00000000-0000-0000-0000-000000000004'}
 ];
 for(const x of cases){
  const {result,exists}=prepare(x);
  assert.notEqual(result.status,0,'invalid preview config must be rejected: '+JSON.stringify(x));
  assert.equal(exists,false,'do not materialize a Preview config from a failed safety gate');
 }
});
