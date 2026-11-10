import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

// A migration already applied on Production cannot be edited. Rehearse 0019 -> 0020 -> 0024.
const migrations = ['0019_account_capacity.sql','0020_account_onboarding_v2.sql','0024_account_active_capacity.sql']
  .map(f => readFileSync(new URL('../drizzle/'+f, import.meta.url),'utf8'));
function fixture() {
 const db=new DatabaseSync(':memory:');
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE device_access(device_id TEXT PRIMARY KEY,person_role TEXT,status TEXT DEFAULT 'pending');
 CREATE TABLE accounts(account_id TEXT PRIMARY KEY,storage_device_id TEXT NOT NULL UNIQUE REFERENCES device_access(device_id),login TEXT);
 CREATE TABLE account_devices(account_id TEXT,device_id TEXT,public_key_jwk TEXT,revoked INTEGER DEFAULT 0,PRIMARY KEY(account_id,device_id));`);
 for(const migration of migrations)db.exec(migration);
 return db;
}
function addAccount(db,role,n,{legacy=false}={}){
 const id=role+'-'+n;
 db.prepare('INSERT INTO device_access(device_id,person_role) VALUES(?,?)').run(id,role);
 db.prepare('INSERT INTO accounts(account_id,storage_device_id,login) VALUES (?,?,?)').run(id,id,legacy?null:id);
 return id;
}
function activate(db,id,{legacy=false}={}){
 if(legacy)db.prepare("UPDATE account_onboarding SET stage='profile_review' WHERE account_id=?").run(id);
 else for(const stage of ['profile_required','profile_review'])
   db.prepare('UPDATE account_onboarding SET stage=? WHERE account_id=?').run(stage,id);
 db.prepare("UPDATE account_onboarding SET stage='active' WHERE account_id=?").run(id);
}
test('P0 registration accepts pending beyond active quota, but activation enforces exact 5/10/200',()=>{
 const db=fixture();try{
  for(const [role,cap] of [['manager',5],['teacher',10],['learner',200]]){
   // Pending requests must not consume active seats. Queue remains subject to rate limits.
   const pending=Array.from({length:cap+1},(_,n)=>addAccount(db,role,n));
   assert.equal(db.prepare("SELECT COUNT(*) AS n FROM account_onboarding o JOIN accounts a ON a.account_id=o.account_id JOIN device_access d ON d.device_id=a.storage_device_id WHERE d.person_role=? AND o.stage IN('active','suspended')").get(role).n,0);
   for(let n=0;n<cap;n++)activate(db,pending[n]);
   assert.throws(()=>activate(db,pending[cap]),/ACCOUNT_CAPACITY_REACHED/);
   assert.equal(db.prepare("SELECT stage FROM account_onboarding WHERE account_id=?").get(pending[cap]).stage,'profile_review');
  }
 }finally{db.close()}
});
test('suspended activated identities retain reserved seat, safe resume never overcommits',()=>{
 const db=fixture();try{
  const accounts=Array.from({length:6},(_,i)=>addAccount(db,'manager',i));
  for(const id of accounts.slice(0,5))activate(db,id);
  db.prepare("UPDATE account_onboarding SET stage='suspended' WHERE account_id=?").run(accounts[0]);
  assert.throws(()=>activate(db,accounts[5]),/ACCOUNT_CAPACITY_REACHED/);
  db.prepare("UPDATE account_onboarding SET stage='active' WHERE account_id=?").run(accounts[0]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM account_onboarding WHERE stage='active'").get().n,5);
 }finally{db.close()}
});
test('role reassignment of reserved account into full role is denied atomically',()=>{
 const db=fixture();try{
  const target=addAccount(db,'learner',0);activate(db,target);
  for(let n=0;n<10;n++)activate(db,addAccount(db,'teacher',n));
  assert.throws(()=>db.prepare("UPDATE device_access SET person_role='teacher' WHERE device_id=?").run(target),/ACCOUNT_CAPACITY_REACHED/);
  assert.equal(db.prepare('SELECT person_role FROM device_access WHERE device_id=?').get(target).person_role,'learner');
 }finally{db.close()}
});
test('lowering cap below occupied seats still prevents new activation and preserves old accounts',()=>{
 const db=fixture();try{
  for(let n=0;n<4;n++)activate(db,addAccount(db,'manager',n));
  db.prepare("UPDATE account_admission_limits SET account_limit=2 WHERE person_role='manager'").run();
  const id=addAccount(db,'manager',4);
  assert.throws(()=>activate(db,id),/ACCOUNT_CAPACITY_REACHED/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM account_onboarding WHERE stage='active'").get().n,4);
 }finally{db.close()}
});
test('legacy_hold accounts remain untouched and consume seats only after explicit reconciliation',()=>{
 const db=fixture();try{
  const legacy=Array.from({length:201},(_,i)=>addAccount(db,'learner','legacy'+i,{legacy:true}));
  const fresh=addAccount(db,'learner','new');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM account_onboarding WHERE stage='legacy_hold'").get().n,201);
  activate(db,fresh);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM account_onboarding WHERE stage='active'").get().n,1);
  activate(db,legacy[0],{legacy:true});
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM account_onboarding WHERE stage='active'").get().n,2);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM account_onboarding WHERE stage='legacy_hold'").get().n,200);
 }finally{db.close()}
});
test('existing three-device trigger survives corrective quota migration',()=>{
 const db=fixture();try{
  const id=addAccount(db,'learner','device');
  for(let n=0;n<3;n++)db.prepare('INSERT INTO account_devices(account_id,device_id,public_key_jwk) VALUES (?,?,?)').run(id,'key-'+n,'{}');
  db.prepare('INSERT INTO account_devices(account_id,device_id,public_key_jwk) VALUES (?,?,?) ON CONFLICT(account_id,device_id) DO NOTHING').run(id,'key-0','{}');
  assert.throws(()=>db.prepare('INSERT INTO account_devices(account_id,device_id,public_key_jwk) VALUES (?,?,?)').run(id,'key-3','{}'),/ACCOUNT_DEVICE_LIMIT_REACHED/);
  db.prepare("UPDATE account_devices SET revoked=1 WHERE account_id=? AND device_id='key-1'").run(id);
  db.prepare("INSERT INTO account_devices(account_id,device_id,public_key_jwk) VALUES (?,?,?)").run(id,'key-3','{}');
  assert.throws(()=>db.prepare("UPDATE account_devices SET revoked=0 WHERE account_id=? AND device_id='key-1'").run(id),/ACCOUNT_DEVICE_LIMIT_REACHED/);
 }finally{db.close()}
});
test('P0 complete local SQLite migration 0019->0020->0024 creates no orphaned rows',()=>{
 const db=fixture();try{
  addAccount(db,'learner',1);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name='account_admission_insert'").get().n,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name='account_activation_capacity'").get().n,1);
 }finally{db.close()}
});
