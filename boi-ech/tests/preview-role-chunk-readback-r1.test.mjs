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
    await assert.rejects(verifyPreviewRoleAssetsLive(async()=>response,tmp.root,{retryDelays:[0,0],pause:async()=>{}}),/Preview role smoke:/);
  }finally{tmp.cleanup();}
 }
});
test("transient post-deploy 404 converges only after verified JavaScript 200",async()=>{
 const tmp=tempBundle();
 const attempts=new Map();
 const seen=[];
 try{
  const proof=await verifyPreviewRoleAssetsLive(async (url)=>{
    const count=(attempts.get(url)||0)+1;
    attempts.set(url,count);seen.push({url,count});
    return count===1
      ?new Response("Not Found",{status:404,headers:{"content-type":"text/html"}})
      :new Response("export const role='ready'",{status:200,headers:{"content-type":"application/javascript"}});
  },tmp.root,{retryDelays:[0,0],pause:async()=>{}});
  assert.equal(proof.checked,2);
  assert.equal(seen.length,4);
  assert.ok([...attempts.values()].every(count=>count===2));
 }finally{tmp.cleanup();}
});
test("HTTP 403 and HTML 200 must fail immediately with no bridge writes",async()=>{
 for(const response of [
  new Response("Forbidden",{status:403,headers:{"content-type":"text/javascript"}}),
  new Response("<html>SPA</html>",{status:200,headers:{"content-type":"text/html"}})
 ]){
  const tmp=tempBundle();
  let calls=0;
  try{
   await assert.rejects(verifyPreviewRoleAssetsLive(async()=>{calls++;return response;},
     tmp.root,{retryDelays:[0,0,0],pause:async()=>{}}),/Preview role smoke:/);
   assert.equal(calls,1,"non-404 failures must never be retried or acknowledged");
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
