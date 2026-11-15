import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {verifyPreviewRoleAssetsLive} from "../scripts/preview-stack-remote.mjs";

const read=relative=>fs.readFileSync(new URL(relative,import.meta.url),"utf8");
function tempBundle(opts={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"boi-preview-roles-"));
  const deploy=path.join(root,".wrangler/deploy");
  const artifact=path.join(root,"dist/work");
  const assets=path.join(root,"dist/assets");
  fs.mkdirSync(deploy,{recursive:true});
  fs.mkdirSync(artifact,{recursive:true});
  fs.mkdirSync(assets,{recursive:true});
  fs.writeFileSync(path.join(deploy,"config.json"),JSON.stringify({
    configPath:"../../dist/work/wrangler.jsonc"
  }));
  fs.writeFileSync(path.join(artifact,"wrangler.jsonc"),JSON.stringify({
    name:opts.worker??"boi-ech-preview",assets:{directory:opts.directory??".."}
  }));
  for(const name of opts.missingTeacher
    ?["learner-enhancements-good1.js"]
    :["learner-enhancements-good1.js","teacher-enhancements-good2.js"])
      fs.writeFileSync(path.join(assets,name),"export const status = 'ok';");
  return {root,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test("preview deployment checks both actual role URLs and JavaScript MIME",async()=>{
 const tmp=tempBundle();
 const visited=[];
 try{
  const out=await verifyPreviewRoleAssetsLive(async (url,request)=>{
    visited.push(url);
    assert.equal(request.cache,"no-store");
    assert.equal(request.redirect,"error");
    return new Response("export const ready=true",{status:200,headers:{"content-type":"text/javascript; charset=utf-8"}});
  },tmp.root);
  assert.equal(out.checked,2);
  assert.deepEqual(visited,[
    "https://boi-ech-preview.boiech-ai.workers.dev/assets/learner-enhancements-good1.js",
    "https://boi-ech-preview.boiech-ai.workers.dev/assets/teacher-enhancements-good2.js"
  ]);
 }finally{tmp.cleanup();}
});
test("preview role smoke refuses HTTP 404 and HTML fallbacks",async()=>{
 for(const response of [
  new Response("Not Found",{status:404,headers:{"content-type":"text/javascript"}}),
  new Response("<!doctype html>",{status:200,headers:{"content-type":"text/html"}}),
 ]){
  const tmp=tempBundle();
  try{
    await assert.rejects(verifyPreviewRoleAssetsLive(async()=>response, tmp.root),/Preview role smoke:/);
  }finally{tmp.cleanup();}
 }
});
test("preview role smoke refuses missing teacher asset and foreign Worker identity",async()=>{
 for(const config of [{missingTeacher:true},{worker:"boi-ech"}]){
  const tmp=tempBundle(config);
  try{
    await assert.rejects(verifyPreviewRoleAssetsLive(async()=>new Response("export{}",{
      headers:{"content-type":"text/javascript"}
    }),tmp.root));
  }finally{tmp.cleanup();}
 }
});
test("preview generated artifact and post-deploy smoke are enforced by real scripts",()=>{
 const artifact=read("../scripts/validate-cloudflare-build-artifact.mjs");
 const remote=read("../scripts/preview-stack-remote.mjs");
 const workflow=read("../../.github/workflows/deploy-boi-ech-preview.yml");
 assert.match(artifact,/roleAssetProbes\(fs\.readdirSync\(roleFolder\)\)/);
 const after=remote.indexOf("const roleSmoke=await roleVerifier(fetcher);");
 const secret=remote.indexOf("const secret = randomBytes(48)");
 assert.ok(after>0&&secret>after&&remote.includes("roleVerifier = verifyPreviewRoleAssetsLive"),"live role asset smoke must precede bridge secret rotation");
 assert.ok(workflow.indexOf("name: Verify generated Preview artifact") <
   workflow.indexOf("name: Deploy preview"));
 assert.ok(workflow.includes("node scripts/preview-stack-remote.mjs install-bridge"));
});
