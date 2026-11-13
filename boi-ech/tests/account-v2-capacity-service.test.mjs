import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source=fs.readFileSync(new URL('../app/account-capacity.server.ts', import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
class AccountError extends Error {constructor(code,status){super(code);this.code=code;this.status=status}}
const mod={exports:{}};
new Function('require','module','exports',output)(()=>({AccountError}),mod,mod.exports);
const {readAccountCapacity,changeAccountCapacity}=mod.exports;
const owner={actor:'owner@fixture.invalid',role:'owner'};
function fixture(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(`CREATE TABLE device_access(device_id TEXT PRIMARY KEY,person_role TEXT);
 CREATE TABLE accounts(account_id TEXT PRIMARY KEY,storage_device_id TEXT,login TEXT);
 CREATE TABLE account_devices(account_id TEXT,device_id TEXT,public_key_jwk TEXT,revoked INTEGER DEFAULT 0,PRIMARY KEY(account_id,device_id));
 CREATE TABLE account_audit(actor TEXT,action TEXT,target TEXT,purpose TEXT);`);
 for(const migration of ['0019_account_capacity.sql','0020_account_onboarding_v2.sql','0024_account_active_capacity.sql','0035_registration_capacity_alerts.sql'])
  sqlite.exec(fs.readFileSync(new URL('../drizzle/'+migration,import.meta.url),'utf8'));
 function prepare(sql){let args=[];return {bind(...a){args=a;return this},async all(){return {results:sqlite.prepare(sql).all(...args)}},_run(){const q=sqlite.prepare(sql);const x=q.run(...args);return {meta:{changes:Number(x.changes)}}}}}
 const db={prepare,async batch(stmts){sqlite.exec('BEGIN IMMEDIATE');try{let r=stmts.map(s=>s._run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return {sqlite,db};
}
test('Owner reads actual 5/10/200 roster and can revise with CAS plus an audit trail',async()=>{
 const f=fixture();try{
  let x=await readAccountCapacity(f.db,owner);
  assert.deepEqual(x.limits.map(r=>[r.role,r.accountLimit,r.used]),[['manager',5,0],['teacher',10,0],['learner',200,0]]);
  await assert.rejects(()=>changeAccountCapacity(f.db,{actor:'teacher',role:'teacher'},{role:'learner',accountLimit:220,expectedRevision:1}),/OWNER_REQUIRED/);
  x=await changeAccountCapacity(f.db,owner,{role:'learner',accountLimit:220,expectedRevision:1});
  assert.equal(x.limits.find(r=>r.role==='learner').accountLimit,220);
  assert.equal(x.limits.find(r=>r.role==='learner').revision,2);
  await assert.rejects(()=>changeAccountCapacity(f.db,owner,{role:'learner',accountLimit:221,expectedRevision:1}),/ACCOUNT_CAS_CONFLICT/);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit").get().n,1);
  assert.equal(f.sqlite.prepare("SELECT account_limit FROM account_admission_limits WHERE person_role='learner'").get().account_limit,220);
 }finally{f.sqlite.close()}
});

test('Owner capacity counts pending and suspended registered identities, excludes unregistered legacy backfill',async()=>{
 const f=fixture();try{
  f.sqlite.exec("INSERT INTO device_access(device_id,person_role) VALUES('m1','manager'),('m2','manager'),('m3','manager')");
  f.sqlite.exec("INSERT INTO accounts(account_id,storage_device_id,login) VALUES('m1','m1','new1'),('m2','m2','new2'),('m3','m3',NULL)");
  const first=await readAccountCapacity(f.db,owner);
  assert.equal(first.limits.find(x=>x.role==='manager').used,2,'new pending identities reserve registration seats, historical NULL-login does not');
  f.sqlite.exec("UPDATE account_onboarding SET stage='profile_required' WHERE account_id='m1'");
  f.sqlite.exec("UPDATE account_onboarding SET stage='profile_review' WHERE account_id='m1'");
  f.sqlite.exec("UPDATE account_onboarding SET stage='active' WHERE account_id='m1'");
  f.sqlite.exec("UPDATE account_onboarding SET stage='suspended' WHERE account_id='m1'");
  const second=await readAccountCapacity(f.db,owner);
  assert.equal(second.limits.find(x=>x.role==='manager').used,2);
  assert.equal(second.limits.find(x=>x.role==='manager').remaining,3);
 }finally{f.sqlite.close()}
});
