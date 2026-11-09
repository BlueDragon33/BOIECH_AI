import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
const run=(cwd)=>spawnSync(process.execPath,['scripts/validate-cloudflare-preview.mjs'],{cwd,encoding:'utf8'});
test('actual repository Preview release gate accepts the explicit protected deployment workflow',()=>{
 const result=run(process.cwd());assert.equal(result.status,0,result.stderr);
});
test('Preview gate rejects removal of confirmation or generated artifact verification',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'boi-preview-gate-'));const app=path.join(root,'boi-ech');
 const files=['wrangler.cloudflare.preview.example.jsonc','scripts/prepare-cloudflare-preview.mjs','scripts/validate-cloudflare-build-artifact.mjs','scripts/validate-cloudflare-preview.mjs','app/control-auth.server.ts','app/api/control/status/route.ts','vite.config.ts','../.github/workflows/deploy-boi-ech-preview.yml','../.github/workflows/deploy-cloudflare.yml'];
 try{
  for(const file of files){const dest=path.resolve(app,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest)}
  const target=path.resolve(app,'../.github/workflows/deploy-boi-ech-preview.yml'),original=fs.readFileSync(target,'utf8');
  for(const marker of ['DEPLOY_PREVIEW','npm run cloudflare:artifact:check']){
   fs.writeFileSync(target,original.replaceAll(marker,'REMOVED_GUARD'));
   const result=run(app);assert.notEqual(result.status,0,'missing deployment guard must fail closed');assert.ok(result.stderr.includes('Preview workflow thiếu: '+marker),result.stderr);
  }
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
