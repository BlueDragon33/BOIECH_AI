import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const migration = readFileSync(new URL('../drizzle/0019_account_capacity.sql', import.meta.url), 'utf8');
function fixture() {
 const db = new DatabaseSync(':memory:');
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE device_access(device_id TEXT PRIMARY KEY, person_role TEXT);
 CREATE TABLE accounts(account_id TEXT PRIMARY KEY, storage_device_id TEXT NOT NULL UNIQUE REFERENCES device_access(device_id), login TEXT);
 CREATE TABLE account_devices(account_id TEXT,device_id TEXT,public_key_jwk TEXT,revoked INTEGER DEFAULT 0,PRIMARY KEY(account_id,device_id));`);
 db.exec(migration);
 return db;
}
function addAccount(db,role,n) {
 const id = `${role}-${n}`;
 db.prepare('INSERT INTO device_access(device_id,person_role) VALUES (?,?)').run(id,role);
 db.prepare('INSERT INTO accounts(account_id,storage_device_id,login) VALUES (?,?,?)').run(id,id,id);
 return id;
}
test('global admission quota counts each role including pending identities and refuses overflow', () => {
 const db=fixture();
 try {
  for(const [role,cap] of [['manager',5],['teacher',10],['learner',200]]){
   for(let n=0;n<cap;n++)addAccount(db,role,n);
   assert.equal(db.prepare('SELECT COUNT(*) AS used FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id WHERE d.person_role=?').get(role).used,cap);
   assert.throws(()=>addAccount(db,role,cap),/ACCOUNT_CAPACITY_REACHED/);
  }
 } finally {db.close();}
});
test('a device key can re-login at 3/3, fourth denied and revoked device cannot reactivate over cap', () => {
 const db=fixture();
 try {
  const account=addAccount(db,'learner',1);
  for(let n=0;n<3;n++)db.prepare('INSERT INTO account_devices(account_id,device_id,public_key_jwk) VALUES (?,?,?)').run(account,`key-${n}`,'{}');
  db.prepare('INSERT INTO account_devices(account_id,device_id,public_key_jwk) VALUES (?,?,?) ON CONFLICT(account_id,device_id) DO NOTHING').run(account,'key-0','{}');
  assert.throws(()=>db.prepare('INSERT INTO account_devices(account_id,device_id,public_key_jwk) VALUES (?,?,?)').run(account,'key-3','{}'),/ACCOUNT_DEVICE_LIMIT_REACHED/);
  db.prepare('UPDATE account_devices SET revoked=1 WHERE account_id=? AND device_id=?').run(account,'key-1');
  db.prepare('INSERT INTO account_devices(account_id,device_id,public_key_jwk) VALUES (?,?,?)').run(account,'key-3','{}');
  assert.throws(()=>db.prepare('UPDATE account_devices SET revoked=0 WHERE account_id=? AND device_id=?').run(account,'key-1'),/ACCOUNT_DEVICE_LIMIT_REACHED/);
 } finally {db.close();}
});
test('role reassignment cannot evade the per-role admission capacity', () => {
 const db=fixture();
 try {
  addAccount(db,'learner',0);
  for(let n=0;n<10;n++)addAccount(db,'teacher',n);
  assert.throws(()=>db.prepare("UPDATE device_access SET person_role='teacher' WHERE device_id='learner-0'").run(),/ACCOUNT_CAPACITY_REACHED/);
  assert.equal(db.prepare("SELECT person_role FROM device_access WHERE device_id='learner-0'").get().person_role,'learner');
 } finally {db.close();}
});
test('configured limit may decrease below existing count but blocks new admission without mutating identities',()=>{
 const db=fixture();try{
  for(let n=0;n<4;n++)addAccount(db,'manager',n);
  db.prepare("UPDATE account_admission_limits SET account_limit=2,revision=revision+1 WHERE person_role='manager'").run();
  assert.throws(()=>addAccount(db,'manager',4),/ACCOUNT_CAPACITY_REACHED/);
  assert.equal(db.prepare("SELECT COUNT(*) AS used FROM accounts").get().used,4);
 }finally{db.close();}
});
