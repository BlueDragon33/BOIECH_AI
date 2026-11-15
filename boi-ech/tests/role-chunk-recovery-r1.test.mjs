import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import {roleAssetProbes,verifyPublicAssets} from "../scripts/production-package.mjs";

const read = path => fs.readFileSync(new URL(path,import.meta.url),"utf8");
const helper = read("../app/role-asset-recovery.ts");
const gate = read("../app/account-gate.tsx");
const bootstrap = read("../app/account-workspace-bootstrap.tsx");
const sw = read("../public/sw.js");
const prod = read("../scripts/production-package.mjs");

function browser(online=true){
  let current="https://boi-ech.boiech-ai.workers.dev/";
  let replaced=[];
  const entries=new Map();
  let workerUpdates=0;
  const sessionStorage={
    getItem:key=>entries.get(key)??null,
    setItem:(key,value)=>entries.set(key,value),
    removeItem:key=>entries.delete(key)
  };
  const window={get location(){return {
    href:current,
    replace:url=>{current=new URL(url,current).href;replaced.push(current);}
  };},sessionStorage};
  const navigator={onLine:online,serviceWorker:{
    getRegistration:async()=>({update:async()=>{workerUpdates++;}})
  }};
  const exports={};
  const js=ts.transpileModule(helper,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function("exports","window","navigator","URL",js)(exports,window,navigator,URL);
  return {actions:exports,sessionStorage,replaced,entries,navigator,get workerUpdates(){return workerUpdates;}};
}

test("screenshot chunk failure is recognized as stale client code, not credentials",()=>{
  const b=browser();
  const err=new TypeError("Failed to fetch dynamically imported module: https://boi-ech.boiech-ai.workers.dev/assets/learner-enhancements-CQ3vCQLx.js");
  assert.equal(b.actions.isRoleChunkLoadFailure(err),true);
  assert.equal(b.actions.isRoleChunkLoadFailure(new Error("Tài khoản hết hạn")),false);
  assert.match(b.actions.roleChunkFailureMessage(err),/phiên bản giao diện/);
});
test("stale client recovery reloads once with a cache-busting navigation, preserving login and learner data",()=>{
  const b=browser();
  const err=new TypeError("Failed to fetch dynamically imported module");
  assert.equal(b.actions.recoverRoleChunkOnce(err),true);
  assert.equal(b.replaced.length,1);
  assert.match(b.replaced[0],/boi_asset_refresh=\d+/);
  assert.equal(b.actions.recoverRoleChunkOnce(err),false,"repeat in same tab must not loop");
  assert.equal(b.replaced.length,1);
  b.actions.roleChunkReady();
  assert.equal(b.actions.recoverRoleChunkOnce(err),true,"successful bundle load resets only the reload guard");
  assert.equal(b.replaced.length,2);
  assert.equal(b.entries.size,1);
  assert.doesNotMatch(helper,/localStorage\.(?:clear|removeItem)|indexedDB\.deleteDatabase|serviceWorker\.unregister/);
});
test("offline and unrelated account failures do not reload",()=>{
  const offline=browser(false),online=browser(true);
  assert.equal(offline.actions.recoverRoleChunkOnce(new TypeError("Failed to fetch dynamically imported module")),false);
  assert.equal(online.actions.recoverRoleChunkOnce(new Error("Phiên tài khoản hết hạn")),false);
  assert.equal(offline.replaced.length+online.replaced.length,0);
});
test("auth readback keeps device proof unchanged and offers a labeled safe retry",()=>{
  assert.match(bootstrap,/await import\("\.\/learner-enhancements"\)/);
  assert.match(bootstrap,/await import\("\.\/teacher-enhancements"\)/);
  assert.match(bootstrap,/roleChunkReady\(\)/);
  assert.match(gate,/recoverRoleChunkOnce\(cause\)/);
  assert.match(gate,/retryLabel=\{roleAssetFailure\?/);
  assert.match(gate,/refreshRoleAssetsManually\(\)/);
  assert.match(gate,/setRoleBootstrapError\(timedOut/);
  const errorPage=read("../app/error.tsx");
  assert.match(errorPage,/recoverRoleChunkOnce\(error\)/);
  assert.match(errorPage,/Tải bản ứng dụng mới/);
});
function fetchEvent(code){
  let respond;
  const waits=[];
  const event={
    request:{method:"GET",url:"https://boi-ech.boiech-ai.workers.dev/assets/learner-enhancements-old.js"},
    respondWith:p=>{respond=p;},
    waitUntil:p=>waits.push(p)
  };
  code(event);
  return {response:()=>respond,waits};
}
function worker(fakeFetch){
  const handlers={};
  const old=new Response("OLD",{status:200,headers:{"content-type":"text/javascript"}});
  const cached=new Map([["https://boi-ech.boiech-ai.workers.dev/assets/learner-enhancements-old.js",old]]);
  const writes=[];
  const caches={
    open:async()=>({put:async(request,response)=>{
      writes.push([request.url,response.status]);
      cached.set(request.url,response);
    }}),
    match:async request=>cached.get(request.url)??undefined
  };
  const self={location:{origin:"https://boi-ech.boiech-ai.workers.dev"},addEventListener:(name,fn)=>{handlers[name]=fn}};
  vm.runInNewContext(sw,{self,caches,fetch:fakeFetch,Response,URL,Promise});
  return {handlers,writes,cached};
}
test("PWA fetches versioned role JS over network rather than stale cached copy",async()=>{
  const code=worker(async()=>new Response("CURRENT",{status:200,headers:{"content-type":"application/javascript"}}));
  const event=fetchEvent(code.handlers.fetch);
  assert.equal(await (await event.response()).text(),"CURRENT");
  await Promise.all(event.waits);
  assert.equal(code.writes.length,1);
  assert.match(sw,/boi-ech-webapp-v5/);
  assert.match(sw,/LEGACY_APP_SHELL_CACHE/);
});
test("PWA never masks a live 404 or HTML chunk response with stale cache",async()=>{
  for(const response of [new Response("Missing",{status:404}),new Response("<html>",{headers:{"content-type":"text/html"}})]){
    const code=worker(async()=>response);
    const event=fetchEvent(code.handlers.fetch);
    const expected=await response.clone().text();
    const actual=await event.response();
    assert.equal(actual.status,response.status);
    assert.equal(await actual.text(),expected);
    await Promise.all(event.waits);
    assert.equal(code.writes.length,0);
  }
});
test("PWA returns a cached role chunk only when network is unavailable",async()=>{
  const code=worker(async()=>{throw new Error("offline");});
  const event=fetchEvent(code.handlers.fetch);
  assert.equal(await (await event.response()).text(),"OLD");
});
test("production release checks both lazy role chunks in artifact and on actual Worker URL",async()=>{
  assert.deepEqual(roleAssetProbes(["learner-enhancements-aBC12.js","teacher-enhancements-b42.js","index-xyz.js"]),
    ["assets/learner-enhancements-aBC12.js","assets/teacher-enhancements-b42.js"]);
  assert.throws(()=>roleAssetProbes(["learner-enhancements-abc.js","index-abc.js"]),/teacher-enhancements/);
  assert.throws(()=>roleAssetProbes(["learner-enhancements-a.js","learner-enhancements-b.js","teacher-enhancements-c.js"]),/ambiguous/);
  assert.match(prod,/const roleFiles=roleAssetProbes\(fs\.readdirSync\(directory\)\)/);
  assert.match(prod,/\.\.\.roleAssetProbes\(files\)/);
  const edge=read("../worker/index.ts");
  assert.match(edge,/no-store, max-age=0, must-revalidate/);
  assert.match(edge,/response.headers.get\("content-type"\)\?\.includes\("text\/html"\)/);
  const filenames=["assets/index-hash.js","assets/index-hash.css",...roleAssetProbes(["learner-enhancements-aBC12.js","teacher-enhancements-b42.js"])];
  await assert.doesNotReject(verifyPublicAssets(filenames,async url=>new Response("ok",{headers:{"content-type":url.endsWith(".css")?"text/css":"text/javascript"}})));
  await assert.rejects(verifyPublicAssets(filenames,async url=>url.includes("learner-enhancements")
    ?new Response("<html>",{headers:{"content-type":"text/html"}})
    :new Response("",{headers:{"content-type":url.endsWith(".css")?"text/css":"text/javascript"}})),/asset failed/);
});
