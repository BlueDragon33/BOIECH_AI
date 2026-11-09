import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('..',import.meta.url));
const script=join(root,'scripts/account-migration.mjs');
const digest=path=>createHash('sha256').update(readFileSync(path)).digest('hex');

function snapshot(extraSql='',accountDdl=false){
 const directory=mkdtempSync(join(tmpdir(),'boiech-migration-cli-test-'));
 const path=join(directory,'source.sqlite');
 const db=new DatabaseSync(path);
 for(const name of readdirSync(join(root,'drizzle')).filter(name=>name.endsWith('.sql')&&name<'0018_account_first.sql').sort()){
  db.exec(readFileSync(join(root,'drizzle',name),'utf8'));
 }
 for(const [n,status,role] of [[1,'approved','learner'],[2,'pending','teacher'],[3,'blocked','manager']]){
  db.prepare(`INSERT INTO device_access(device_id,display_code,public_key_jwk,status,person_role,person_code,phone,learner_name,class_name,registration_submitted_at,management_enabled)
   VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?)`).run('synthetic-'+n,'SYNTHETIC-'+n,'{}',status,role,'PERSON'+n,'090000000'+n,'Synthetic person '+n,'Offline QA',role==='manager'?1:0);
  db.prepare(`INSERT INTO device_profiles(device_id,completed_json,scores_json,attempts_json) VALUES(?,'["bai-01"]','{"01":90}','{}')`).run('synthetic-'+n);
 }
 if(accountDdl)db.exec(readFileSync(join(root,'drizzle/0018_account_first.sql'),'utf8'));
 db.exec(extraSql);db.close();
 return {path,close:()=>rmSync(directory,{recursive:true,force:true})};
}

function rehearse(fixture){
 const before=digest(fixture.path);
 const result=spawnSync(process.execPath,[script,'--database',fixture.path],{cwd:root,encoding:'utf8',timeout:30000});
 assert.equal(result.error,undefined);
 assert.equal(digest(fixture.path),before,'the original offline snapshot must remain byte-for-byte unchanged');
 return result;
}

// Break caught: assuming every legacy table exposes SQLite's implicit rowid.
test('offline rehearsal accepts D1-style WITHOUT ROWID tables and preserves the source',()=>{
 const fixture=snapshot(`CREATE TABLE _cf_KV(key TEXT PRIMARY KEY,value BLOB) WITHOUT ROWID;
  INSERT INTO _cf_KV VALUES('synthetic-key',X'00FF10');`);
 try{
  const result=rehearse(fixture);
  assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(result.stdout);
  assert.equal(report.mappedAccounts,3);
  assert.equal(report.legacyRowsUnchanged,true);
  assert.equal(report.idempotent,true);
  assert.equal(report.reopenReadback,true);
 }finally{fixture.close();}
});

// Break caught: silently narrowing SQLite int64 values during preservation checks.
test('offline rehearsal fingerprints full-width SQLite integers and binary legacy values',()=>{
 const fixture=snapshot(`CREATE TABLE legacy_binary(id INTEGER PRIMARY KEY,value BLOB);
  INSERT INTO legacy_binary VALUES(9223372036854775807,X'00FF10'),(-9223372036854775808,X'');`);
 try{
  const result=rehearse(fixture);
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).legacyRowsUnchanged,true);
 }finally{fixture.close();}
});

// Break caught: collapsing an INTEGER and a TEXT value to the same fingerprint.
test('offline rehearsal detects a legacy value type change during backfill',()=>{
 const fixture=snapshot(`CREATE TABLE legacy_value(id TEXT PRIMARY KEY,value);
  INSERT INTO legacy_value VALUES('synthetic',1);
  CREATE TRIGGER synthetic_legacy_mutation AFTER INSERT ON accounts BEGIN
   UPDATE legacy_value SET value=CAST(value AS TEXT);
  END;`,true);
 try{
  const result=rehearse(fixture);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/LEGACY_DATA_CHANGED/);
  assert.equal(result.stdout,'');
 }finally{fixture.close();}
});

// Break caught: JSON turns both positive and negative infinity into null.
test('offline rehearsal detects a change between distinct nonfinite SQLite REAL values',()=>{
 const fixture=snapshot(`CREATE TABLE legacy_real(id TEXT PRIMARY KEY,value REAL);
  INSERT INTO legacy_real VALUES('synthetic',1e999);
  CREATE TRIGGER synthetic_real_mutation AFTER INSERT ON accounts BEGIN
   UPDATE legacy_real SET value=-1e999;
  END;`,true);
 try{
  const result=rehearse(fixture);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/LEGACY_DATA_CHANGED/);
  assert.equal(result.stdout,'');
 }finally{fixture.close();}
});

// Break caught: different stored TEXT bytes can both decode to a replacement character.
test('offline rehearsal detects changes to undecodable SQLite TEXT bytes',()=>{
 const fixture=snapshot(`CREATE TABLE legacy_text(id TEXT PRIMARY KEY,value TEXT);
  INSERT INTO legacy_text VALUES('synthetic',CAST(X'80' AS TEXT));
  CREATE TRIGGER synthetic_text_mutation AFTER INSERT ON accounts BEGIN
   UPDATE legacy_text SET value=CAST(X'81' AS TEXT);
  END;`,true);
 try{
  const result=rehearse(fixture);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/LEGACY_DATA_CHANGED/);
 }finally{fixture.close();}
});

// Break caught: JSON alone cannot distinguish stored REAL negative and positive zero.
test('offline rehearsal detects a stored REAL signed zero change',()=>{
 const fixture=snapshot(`CREATE TABLE legacy_zero(id TEXT PRIMARY KEY,value);
  INSERT INTO legacy_zero VALUES('synthetic',-0.0);
  CREATE TRIGGER synthetic_zero_mutation AFTER INSERT ON accounts BEGIN
   UPDATE legacy_zero SET value=0.0;
  END;`,true);
 try{
  const input=new DatabaseSync(fixture.path,{readOnly:true});
  try{assert.equal(Object.is(input.prepare('SELECT value FROM legacy_zero').get().value,-0),true);}finally{input.close();}
  const result=rehearse(fixture);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/LEGACY_DATA_CHANGED/);
 }finally{fixture.close();}
});

// Break caught: a set-based fingerprint could hide deletion of one identical row.
test('offline rehearsal detects removal of one duplicate legacy row',()=>{
 const fixture=snapshot(`CREATE TABLE legacy_duplicates(value TEXT);
  INSERT INTO legacy_duplicates VALUES('synthetic'),('synthetic');
  CREATE TRIGGER synthetic_duplicate_mutation AFTER INSERT ON accounts
  WHEN NEW.account_id='acc_synthetic-1' BEGIN
   DELETE FROM legacy_duplicates WHERE rowid=(SELECT MIN(rowid) FROM legacy_duplicates);
  END;`,true);
 try{
  const result=rehearse(fixture);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/LEGACY_DATA_CHANGED/);
 }finally{fixture.close();}
});

// Break caught: attesting a rehearsal on a snapshot that already contains broken references.
test('offline rehearsal refuses an existing foreign-key violation',()=>{
 const fixture=snapshot(`CREATE TABLE legacy_orphan(id TEXT PRIMARY KEY,parent TEXT REFERENCES device_access(device_id));
  PRAGMA foreign_keys=OFF;
  INSERT INTO legacy_orphan VALUES('synthetic-orphan','missing-synthetic-device');`);
 try{
  const result=rehearse(fixture);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/FOREIGN_KEY_CHECK_FAILED/);
  assert.equal(result.stdout,'');
 }finally{fixture.close();}
});
