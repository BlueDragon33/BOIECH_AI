import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const script=fileURLToPath(new URL("../scripts/assert-preview-d1-inventory.mjs",import.meta.url));
const preview="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",production="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const example=[{uuid:production,name:"boi-ech-db"},{uuid:preview,name:"boi-ech-preview-db"}];
function check(inventory,env={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"boi-d1-inventory-")),file=path.join(dir,"list.json");
 try {
  fs.writeFileSync(file,JSON.stringify(inventory));
  const p=spawnSync(process.execPath,[script,file],{encoding:"utf8",timeout:8_000,
   env:{PATH:process.env.PATH??"",BOI_ECH_PREVIEW_D1_DATABASE_ID:preview,
    BOI_ECH_PRODUCTION_D1_DATABASE_ID:production,...env}});
  assert.equal(p.error,undefined);
  return p;
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test("remote inventory gate accepts only one exact Preview D1 name+ID distinct from Production",()=>{
 const p=check(example);assert.equal(p.status,0,p.stderr);assert.match(p.stdout,/Remote read-only D1 inventory PASS/);
});
test("remote inventory gate blocks absent Preview, full FREE account, collisions, wrong UUID and wrong account",()=>{
 const cases=[
  [{uuid:production,name:"boi-ech-db"}],
  Array.from({length:10},(_,i)=>({uuid:i===0?production:String(i+1).padStart(8,"0")+"-1111-4111-8111-111111111111",name:"another-db-"+i})),
  [{uuid:production,name:"boi-ech-db"},{uuid:preview,name:"wrong-name"}],
  [{uuid:production,name:"boi-ech-db"},{uuid:preview,name:"boi-ech-preview-db"},{uuid:preview,name:"boi-ech-preview-db"}],
  [{uuid:production,name:"boi-ech-preview-db"}],
  [{uuid:preview,name:"boi-ech-preview-db"}],
 ];
 for(const inventory of cases)assert.notEqual(check(inventory).status,0,JSON.stringify(inventory));
 assert.notEqual(check(example,{BOI_ECH_PREVIEW_D1_DATABASE_ID:production}).status,0);
});
test("remote inventory gate accepts only the explicitly approved retired Preview name and UUID",()=>{
 const borrowed='4094a621-3b81-4533-9694-4a2103e03363';
 const inventory=[{uuid:production,name:'boi-ech-db'},{uuid:borrowed,name:'bauman-control-preview-db'}];
 const env={BOI_ECH_PREVIEW_D1_DATABASE_NAME:'bauman-control-preview-db',BOI_ECH_PREVIEW_D1_DATABASE_ID:borrowed};
 assert.equal(check(inventory,env).status,0);
 assert.notEqual(check(inventory,{...env,BOI_ECH_PREVIEW_D1_DATABASE_ID:preview}).status,0);
 assert.notEqual(check(inventory,{...env,BOI_ECH_PREVIEW_D1_DATABASE_NAME:'boi-ech-preview-db'}).status,0);
});
