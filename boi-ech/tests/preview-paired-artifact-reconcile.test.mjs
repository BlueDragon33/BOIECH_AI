import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {reconcileAppPreviewArtifact,readAndAttestAppSource}
 from "../scripts/reconcile-paired-preview-app-revision.mjs";

const parent="a".repeat(40),reviewed="b".repeat(40),other="c".repeat(40);
const database="00f8a685-452f-472c-81c5-4d0b1c4037c9";
const env={GITHUB_SHA:parent,APPLICATION_MANAGEMENT_BUILD_REVISION:reviewed,
 APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID:database};
const boi={name:"boi-ech-preview",vars:{BOI_ECH_BUILD_REVISION:parent,BOI_ECH_DEPLOYMENT_CHANNEL:"cloudflare-preview"}};
const app={name:"application-management-preview",vars:{
 APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL:"cloudflare-preview",
 APPLICATION_MANAGEMENT_BUILD_REVISION:parent},
 d1_databases:[{binding:"DB",database_id:database}]};

test("V12 fixes only known App worker being stamped with parent BOIECH_AI SHA",()=>{
 const result=reconcileAppPreviewArtifact(boi,app,env);
 assert.equal(result.changed,true);
 assert.equal(result.config.vars.APPLICATION_MANAGEMENT_BUILD_REVISION,reviewed);
 assert.equal(app.vars.APPLICATION_MANAGEMENT_BUILD_REVISION,parent,"never mutate an input config object");
 assert.deepEqual({...result.config,vars:{...result.config.vars,APPLICATION_MANAGEMENT_BUILD_REVISION:parent}},app,
  "no credentials or any other generated App fields may change");
});
test("correct generated App revision remains untouched",()=>{
 const correct={...app,vars:{...app.vars,APPLICATION_MANAGEMENT_BUILD_REVISION:reviewed}};
 const result=reconcileAppPreviewArtifact(boi,correct,env);
 assert.equal(result.changed,false);assert.strictEqual(result.config,correct);
});
test("unknown revision, wrong worker, wrong Preview D1 and unsafe release channel all stop",()=>{
 const wrong={...app,vars:{...app.vars,APPLICATION_MANAGEMENT_BUILD_REVISION:other}};
 assert.throws(()=>reconcileAppPreviewArtifact(boi,wrong,env),/Unknown App artifact revision mismatch/);
 assert.throws(()=>reconcileAppPreviewArtifact({...boi,name:"boi-ech"},app,env),/parent Bơi Ếch|Bơi Ếch generated artifact/i);
 assert.throws(()=>reconcileAppPreviewArtifact(boi,{...app,name:"application-management"},env),/approved isolated/);
 assert.throws(()=>reconcileAppPreviewArtifact(boi,{...app,d1_databases:[{binding:"DB",database_id:"production"}]},env),/approved isolated/);
 assert.throws(()=>reconcileAppPreviewArtifact(boi,{...app,vars:{...app.vars,
 APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL:"production"}},env),/approved isolated/);
 assert.throws(()=>reconcileAppPreviewArtifact(boi,app,{...env,
 APPLICATION_MANAGEMENT_BUILD_REVISION:parent}),/distinct exact/);
});
test("source checkout and prepared revision must both attest exact App HEAD, and remain unmodified",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"boi-app-pinned-"));
 const git=(...argv)=>execFileSync("git",["-C",root,...argv],{encoding:"utf8",timeout:5000}).trim();
 try{
  git("init","--quiet");git("config","user.email","ci@example.invalid");git("config","user.name","CI Fixture");
  fs.writeFileSync(path.join(root,"source.txt"),"pinned App code");
  fs.writeFileSync(path.join(root,"tsconfig.tsbuildinfo"),"pinned compiler cache");
  git("add","source.txt","tsconfig.tsbuildinfo");git("commit","--quiet","-m","fixture pinned app");
  const actual=git("rev-parse","HEAD");
  fs.writeFileSync(path.join(root,"wrangler.cloudflare.jsonc"),JSON.stringify({name:"application-management-preview",
   vars:{APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL:"cloudflare-preview",APPLICATION_MANAGEMENT_BUILD_REVISION:actual}}));
  assert.equal(readAndAttestAppSource(root,actual),true);
  fs.writeFileSync(path.join(root,"tsconfig.tsbuildinfo"),"rewritten by tsc --noEmit");
  assert.equal(readAndAttestAppSource(root,actual),true,
    "tracked incremental compiler cache does not change reviewed App source identity");
  assert.throws(()=>readAndAttestAppSource(root,parent),/source HEAD differs/);
  fs.writeFileSync(path.join(root,"source.txt"),"tampered code");
  assert.throws(()=>readAndAttestAppSource(root,actual),/tracked source changed/);
  fs.writeFileSync(path.join(root,"source.txt"),"pinned App code");
  fs.writeFileSync(path.join(root,"tsconfig.tsbuildinfo"),"pinned compiler cache");
  fs.writeFileSync(path.join(root,"source.txt"),"tampered again");
  fs.writeFileSync(path.join(root,"tsconfig.tsbuildinfo"),"rewritten by tsc");
  assert.throws(()=>readAndAttestAppSource(root,actual),/source.txt/,
    "source and cache modified together must still fail closed");
  fs.writeFileSync(path.join(root,"source.txt"),"pinned App code");
  fs.writeFileSync(path.join(root,"wrangler.cloudflare.jsonc"),JSON.stringify({vars:{
    APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL:"cloudflare-preview",APPLICATION_MANAGEMENT_BUILD_REVISION:parent}}));
  assert.throws(()=>readAndAttestAppSource(root,actual),/prepared Preview revision/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("paired Preview flow runs attestation+safe correction and strict gate before ALL remote D1 writes",()=>{
 const file=fileURLToPath(new URL("../../.github/workflows/deploy-boi-ech-preview.yml",import.meta.url));
 const text=fs.readFileSync(file,"utf8");
 const restored=text.indexOf("name: Restore only attested pinned App Preview config after build");
 const repair=text.indexOf("name: Attest pinned App checkout and reconcile ONLY the verified parent-SHA packaging defect");
 const hardGate=text.indexOf("name: Verify BOTH generated Preview Worker revision identities");
 const migration=text.indexOf("name: Apply isolated Preview migrations");
 const deploy=text.indexOf("name: Deploy preview\n");
 const appBuild=text.indexOf("name: Build App Preview before any remote D1 mutation");
 assert.ok(appBuild>0&&restored>appBuild&&repair>restored&&hardGate>repair&&migration>hardGate&&deploy>migration);
 assert.match(text,/PARENT_GITHUB_SHA: \\$\\{\\{ github\\.sha \\}\\}/);
 assert.match(text,/App checkout no longer matches pinned source/);
 assert.match(text,/Unexpected or duplicate prepared App revision/);
 assert.match(text,/node boi-ech\/scripts\/reconcile-paired-preview-app-revision\.mjs/);
 assert.match(text,/node boi-ech\/scripts\/assert-paired-preview-artifact-revisions\.mjs/);
 assert.doesNotMatch(text,/DEPLOY_PRODUCTION/);
});
