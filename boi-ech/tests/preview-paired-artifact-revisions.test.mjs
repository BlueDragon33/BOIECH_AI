import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {verifyPairedPreviewArtifacts,readGeneratedPreviewConfig}
  from "../scripts/assert-paired-preview-artifact-revisions.mjs";

const boiRev = "a".repeat(40), appRev = "b".repeat(40);
const env = {GITHUB_SHA:boiRev,APPLICATION_MANAGEMENT_BUILD_REVISION:appRev};
const boi = {name:"boi-ech-preview",vars:{
 BOI_ECH_BUILD_REVISION:boiRev,BOI_ECH_DEPLOYMENT_CHANNEL:"cloudflare-preview"
}};
const app = {name:"application-management-preview",vars:{
 APPLICATION_MANAGEMENT_BUILD_REVISION:appRev,
 APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL:"cloudflare-preview"
}};
const workflow = fs.readFileSync(fileURLToPath(new URL("../../.github/workflows/deploy-boi-ech-preview.yml",import.meta.url)),"utf8");

test("both paired generated Preview artifacts require their own exact immutable source SHA",()=>{
 assert.deepEqual(verifyPairedPreviewArtifacts(boi,app,env),{verified:true,paired:true});
 assert.throws(()=>verifyPairedPreviewArtifacts(boi,{
  ...app,vars:{...app.vars,APPLICATION_MANAGEMENT_BUILD_REVISION:boiRev}
 },env),/Application-Management Preview artifact revision mismatch/);
 assert.throws(()=>verifyPairedPreviewArtifacts({
  ...boi,vars:{...boi.vars,BOI_ECH_BUILD_REVISION:appRev}
 },app,env),/Bơi Ếch Preview artifact revision mismatch/);
});

test("fail closed on wrong Worker names, channels and reused source revisions",()=>{
 assert.throws(()=>verifyPairedPreviewArtifacts({...boi,name:"boi-ech"},app,env),/identity mismatch/);
 assert.throws(()=>verifyPairedPreviewArtifacts(boi,{...app,
  vars:{...app.vars,APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL:"production"}},env),/channel mismatch/);
 assert.throws(()=>verifyPairedPreviewArtifacts(boi,app,{...env,APPLICATION_MANAGEMENT_BUILD_REVISION:boiRev}),/distinct pinned/);
});

test("generated Wrangler redirect is the deploy artifact, not a source-only template",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"boi-preview-revision-"));
 try{
  fs.mkdirSync(path.join(root,".wrangler","deploy"),{recursive:true});
  fs.mkdirSync(path.join(root,"dist","server"),{recursive:true});
  fs.writeFileSync(path.join(root,".wrangler","deploy","config.json"),
    JSON.stringify({configPath:"../../dist/server/wrangler.json"}));
  fs.writeFileSync(path.join(root,"dist","server","wrangler.json"),JSON.stringify(app));
  assert.deepEqual(readGeneratedPreviewConfig(root),app);
  fs.writeFileSync(path.join(root,".wrangler","deploy","config.json"),
    JSON.stringify({configPath:"../../../outside/wrangler.json"}));
  assert.throws(()=>readGeneratedPreviewConfig(root),/inside dist/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test("Application-Management Vite build pins its own app revision instead of inherited Bơi Ếch GITHUB_SHA",()=>{
 const block = workflow.split("      - name: Build App Preview before any remote D1 mutation\n")[1]
  ?.split("      - name: Verify generated Preview artifact before any remote D1 mutation")[0]??"";
 assert.ok(block.includes("GITHUB_SHA: ${{ env.APPLICATION_MANAGEMENT_BUILD_REVISION }}"));
 assert.ok(block.includes("npm run build"));
 const artifactGate=workflow.indexOf("name: Verify BOTH generated Preview Worker revision identities before any remote D1 mutation");
 const migration=workflow.indexOf("name: Apply isolated Preview migrations");
 const deploy=workflow.indexOf("name: Deploy App Preview retaining its existing encrypted access");
 assert.ok(artifactGate>0&&artifactGate<migration&&migration<deploy,
   "generated version gate must run before any remote migrations or deployments");
 assert.match(workflow,/node boi-ech\/scripts\/assert-paired-preview-artifact-revisions\.mjs/);
 assert.doesNotMatch(workflow,/DEPLOY_PRODUCTION/);
});

test("the reviewed App checkout and job-wide revision are both pinned independently of Bơi Ếch",()=>{
 const pinned = "720521a905ddb71ebd54ac8c80c94be705438928";
 assert.ok(workflow.includes("APPLICATION_MANAGEMENT_BUILD_REVISION: "+pinned));
 assert.ok(workflow.includes("ref: "+pinned));
 assert.notEqual(pinned,boiRev);
});
