import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/api/control/v2/device-registry/route.ts", import.meta.url), "utf8");

test("Owner browser registry maps binding to exactly one account, never emits raw P-256 key", async t => {
  const db = new DatabaseSync(":memory:");t.after(()=>db.close());
  db.exec(`CREATE TABLE device_access (device_id TEXT PRIMARY KEY,learner_name TEXT,person_role TEXT);
    CREATE TABLE accounts (account_id TEXT PRIMARY KEY,storage_device_id TEXT);
    CREATE TABLE account_devices (account_id TEXT,device_id TEXT,approved INTEGER,revoked INTEGER,
      device_label TEXT,client_class TEXT,public_key_jwk TEXT);
    INSERT INTO device_access VALUES ('stored','Sample Learner','learner');
    INSERT INTO accounts VALUES ('acc_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','stored');
    INSERT INTO account_devices VALUES ('acc_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'secret-key-id',1,0,'Điện thoại · Safari','phone','PRIVATE-P256-MATERIAL');`);
  let reads=0;
  class Err extends Error { constructor(message,status,code){super(message);this.status=status;this.code=code;} }
  const modules={
    "../../../../account-runtime.server": {
      accountConfiguration:async()=>({v2:true}),
      accountErrorResponse:e=>Response.json({code:e.code||"ERR"},{status:e.status||500}),
    },
    "../../../../device-auth.server": {
      DeviceAccessError:Err,
      getCourseDatabase:async()=>({prepare:sql=>({all:async()=>{reads++;return {success:true,results:db.prepare(sql).all()};}})})
    },
    "../../../../control-auth.server": {
      requireControlService:async req=>{
        if(req.headers.get("authorization")!=="Bearer v1.owner")return {role:"publisher"};
        return {role:"owner"};
      },
      controlPreflight:()=>new Response(null,{status:204}),
      controlResponse:(v,status)=>Response.json(v,{status}),
      withControlCors:(_,res)=>res,
    }
  };
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  new Function("require","module","exports",compiled)(name=>modules[name],mod,mod.exports);
  const get=async(url,token="v1.owner")=>{
    const response=await mod.exports.GET(new Request(url,{headers:{authorization:"Bearer "+token}}));
    return {status:response.status,data:await response.json()};
  };
  const owner=await get("https://boi.example.test/api/control/v2/device-registry?view=owner");
  assert.equal(owner.status,200);
  assert.equal(owner.data.contract,"boi-device-registry-owner.v1");
  assert.equal(owner.data.devices.length,1);
  assert.equal(owner.data.devices[0].account.name,"Sample Learner");
  assert.equal(owner.data.devices[0].account.role,"learner");
  assert.equal(owner.data.devices[0].clientClass,"phone");
  assert.equal(owner.data.devices[0].browserLabel,"Điện thoại · Safari");
  assert.match(owner.data.devices[0].deviceId,/^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(owner.data),/secret-key-id|PRIVATE-P256-MATERIAL|public_key_jwk/);
  const v2=await get("https://boi.example.test/api/control/v2/device-registry");
  assert.equal(v2.data.contract,"boi-device-registry.v2");
  assert.equal(v2.data.devices[0].account,undefined);
  const before=reads;
  const forbidden=await get("https://boi.example.test/api/control/v2/device-registry?view=owner","v1.publisher");
  assert.equal(forbidden.status,403);
  assert.equal(reads,before);
});
