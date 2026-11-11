import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {createRequire} from "node:module";

const require=createRequire(import.meta.url);
const ts=require("typescript");
const source=fs.readFileSync(new URL("../app/account-entitlement.server.ts",import.meta.url),"utf8");
const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function("require","module","exports",transpiled)(()=>({}),mod,mod.exports);
const {AccountEntitlementService}=mod.exports;
const id="acc_"+"a".repeat(64),other="acc_"+"b".repeat(64);
const owner={role:"owner",actor:"owner@fixture.invalid"};
const hour=3600000,day=24*hour;
const initial=Date.UTC(2026,10,8,9,0,0);
function fixture(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec("PRAGMA foreign_keys=ON");
 sqlite.exec(`CREATE TABLE accounts(account_id TEXT PRIMARY KEY,storage_device_id TEXT NOT NULL);
  CREATE TABLE account_onboarding(account_id TEXT PRIMARY KEY,stage TEXT NOT NULL);
  CREATE TABLE device_access(device_id TEXT PRIMARY KEY,learner_name TEXT,person_role TEXT,status TEXT);
  CREATE TABLE account_audit(actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,purpose TEXT NOT NULL);`);
 sqlite.exec(fs.readFileSync(new URL("../drizzle/0023_account_entitlement.sql",import.meta.url),"utf8"));
 sqlite.prepare("INSERT INTO accounts VALUES(?,?)").run(id,"device-fixture");
 sqlite.prepare("INSERT INTO device_access VALUES(?,?,?,?)").run("device-fixture","Manager fixture","manager","approved");
 sqlite.prepare("INSERT INTO account_onboarding VALUES(?,'requested')").run(id);
 const prepare=sql=>{let args=[];return{bind(...a){args=a;return this},
  async first(){return sqlite.prepare(sql).get(...args)??null},
  async all(){return{results:sqlite.prepare(sql).all(...args)}},
  _run(){const s=sqlite.prepare(sql);const values=/^\s*(?:SELECT|PRAGMA|EXPLAIN)\b/i.test(sql)?s.all(...args):s.run(...args);return{meta:{changes:Number(values.changes??0)},results:Array.isArray(values)?values:[]}}}};
 const db={prepare,async batch(stmts){sqlite.exec("BEGIN IMMEDIATE");try{let out=stmts.map(s=>s._run());sqlite.exec("COMMIT");return out}
  catch(e){sqlite.exec("ROLLBACK");throw e}}};
 let now=initial;
 return{sqlite,db,service:new AccountEntitlementService(db,()=>now),setNow:v=>{now=v},close:()=>sqlite.close()};
}
test("Account expiry remains absent before second review; activation grants exactly 30 days",async()=>{
 const f=fixture();try{
  await f.db.batch([await f.service.grantOnApproval(id,"learner")]);
  assert.equal(await f.service.read(id),null);
  f.sqlite.prepare("UPDATE account_onboarding SET stage='active' WHERE account_id=?").run(id);
  await f.db.batch([await f.service.grantOnApproval(id,"learner")]);
  const e=await f.service.read(id);
  assert.equal(Date.parse(e.expiresAt)-Date.parse(e.activatedAt),30*day);
  await f.service.assertActive(id);
  await f.db.batch([await f.service.grantOnApproval(id,"learner")]);
  assert.equal((await f.service.read(id)).revision,1,"duplicate approval must not renew");
  f.setNow(initial+30*day);
  await assert.rejects(()=>f.service.assertActive(id),e=>e.code==="ACCOUNT_EXPIRED");
 }finally{f.close()}
});
test("Owner policy 30->45 affects future approvals only, with CAS and immutable audit intent",async()=>{
 const f=fixture();try{
  await assert.rejects(()=>f.service.setPolicy({role:"viewer",actor:"viewer"},{
    role:"learner",defaultDays:90,expectedRevision:1,reason:"Unauthorized write"}),e=>e.code==="OWNER_REQUIRED");
  const changed=await f.service.setPolicy(owner,{role:"learner",defaultDays:45,expectedRevision:1,reason:"Trial duration changed by Owner"});
  assert.equal(changed.revision,2);
  await assert.rejects(()=>f.service.setPolicy(owner,{role:"learner",defaultDays:46,expectedRevision:1,reason:"Stale Owner tab"}),e=>e.code==="ACCOUNT_CAS_CONFLICT");
  f.sqlite.prepare("UPDATE account_onboarding SET stage='active' WHERE account_id=?").run(id);
  await f.db.batch([await f.service.grantOnApproval(id,"learner")]);
  assert.equal(Date.parse((await f.service.read(id)).expiresAt)-initial,45*day);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit").get().n,1);
 }finally{f.close()}
});
test("Suspend, reinstate and extend use manager account scope/CAS and do not write device access rows",async()=>{
 const f=fixture();try{
  f.sqlite.prepare("UPDATE account_onboarding SET stage='active' WHERE account_id=?").run(id);
  await f.db.batch([await f.service.grantOnApproval(id,"learner")]);
  const e=await f.service.read(id);
  const stopped=await f.service.change(owner,{accountId:id,operation:"suspend",expectedRevision:e.revision,reason:"Temporary hold by Owner"});
  assert.equal(stopped.state,"suspended");
  await assert.rejects(()=>f.service.assertActive(id),e=>e.code==="ACCOUNT_SUSPENDED");
  await assert.rejects(()=>f.service.change(owner,{accountId:id,operation:"resume",expectedRevision:e.revision,reason:"Stale UI attempt"}),e=>e.code==="ACCOUNT_CAS_CONFLICT");
  const resumed=await f.service.change(owner,{accountId:id,operation:"resume",expectedRevision:stopped.revision,reason:"Verified resumption"});
  assert.equal(resumed.state,"active");
  const after=await f.service.change(owner,{accountId:id,operation:"set-expiry",expectedRevision:resumed.revision,
    expiresAt:new Date(initial+90*day).toISOString(),reason:"Approved extension"});
  assert.equal(Date.parse(after.expiresAt)-initial,90*day);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit").get().n,3);
  assert.equal(await f.service.read(other),null);
 }finally{f.close()}
});

test("individual duration cannot change a teacher entitlement",async()=>{
 const f=fixture();try{
  f.sqlite.exec("UPDATE device_access SET person_role='teacher'; UPDATE account_onboarding SET stage='active'");
  await f.db.batch([await f.service.grantOnApproval(id,"teacher")]);
  const before=await f.service.read(id);
  await assert.rejects(()=>f.service.change(owner,{accountId:id,operation:"suspend",expectedRevision:before.revision,reason:"Scope check"}),
    error=>error.status===403&&error.code==="BOI_MANAGER_ACCOUNT_REQUIRED");
  assert.deepEqual(await f.service.read(id),before);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit").get().n,0);
 }finally{f.close()}
});
