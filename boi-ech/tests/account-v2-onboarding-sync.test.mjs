import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const realRequire=createRequire(import.meta.url),ts=realRequire('typescript');
function load(path,imports={}) {
 const src=fs.readFileSync(new URL(path,import.meta.url),'utf8');
 const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};
 new Function('require','module','exports',compiled)(key=>key==='./account-entitlement.server'?load('../app/account-entitlement.server.ts'):imports[key]??realRequire(key),m,m.exports);
 return m.exports;
}
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE device_access(
  device_id TEXT PRIMARY KEY,display_code TEXT UNIQUE,public_key_jwk TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',person_role TEXT,person_code TEXT,
  phone TEXT UNIQUE,learner_name TEXT,learner_family_name TEXT,learner_given_name TEXT,
  class_name TEXT,registration_submitted_at TEXT,management_enabled INTEGER DEFAULT 0,
  access_expires_at TEXT,access_group TEXT DEFAULT 'unassigned',
  payment_status TEXT DEFAULT 'unassigned',approved_at TEXT,blocked_at TEXT,updated_at TEXT
 );
 CREATE UNIQUE INDEX IF NOT EXISTS device_access_identity ON device_access(person_role,person_code);
 CREATE TABLE device_profiles(device_id TEXT PRIMARY KEY,completed_json TEXT DEFAULT '[]',scores_json TEXT DEFAULT '{}',
  attempts_json TEXT DEFAULT '{}',total_active_seconds INTEGER DEFAULT 0,last_activity_at TEXT);
 CREATE TABLE manager_device_assignments(target_device_id TEXT PRIMARY KEY,manager_device_id TEXT,person_role TEXT);
 CREATE TABLE manager_approval_limits(scope TEXT PRIMARY KEY,learner_limit INTEGER,teacher_limit INTEGER);
 INSERT INTO manager_approval_limits VALUES('manager-tier',200,10);
 CREATE TABLE access_automation_settings(id TEXT PRIMARY KEY,default_access_days INTEGER);
 INSERT INTO access_automation_settings VALUES('global',90);`);
 for(const file of ['0018_account_first.sql','0019_account_capacity.sql','0020_account_onboarding_v2.sql','0021_account_verified_sync.sql','0023_account_entitlement.sql','0026_account_contact.sql','0027_manager_professional_profile.sql']){
  sqlite.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 }
 function prepare(sql){let args=[];return {bind(...a){args=a;return this},
  async first(){return sqlite.prepare(sql).get(...args)??null},
  async all(){return {results:sqlite.prepare(sql).all(...args)}},
  async run(){const out=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(out.changes)}}},
  _run(){const st=sqlite.prepare(sql);if(/^\s*(?:SELECT|PRAGMA|EXPLAIN)\b/i.test(sql))return {results:st.all(...args),meta:{changes:0}};
   return {meta:{changes:Number(st.run(...args).changes)}};}};
 }
 const db={prepare,async batch(stmts){sqlite.exec('BEGIN IMMEDIATE');try{
  const result=stmts.map(s=>s._run());sqlite.exec('COMMIT');return result;
 }catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 const core=load('../app/account-core.server.ts');
 const {AccountV2Workflow}=load('../app/account-v2-workflow.server.ts',{'./account-core.server':core});
 const {AccountVerifiedSync}=load('../app/account-v2-sync.server.ts',{'./account-core.server':core});
 const service=new core.AccountService(db,Date.now,true);
 const flow=new AccountV2Workflow(db,service),sync=new AccountVerifiedSync(db,service);
 return {sqlite,db,service,flow,sync,core};
}
async function key(){const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 return crypto.subtle.exportKey('jwk',keys.publicKey);}
function payload(n,role='learner') {return {login:'person'+n,password:'A careful long passphrase! '+n,
 role,privacyAccepted:true};}
async function register(f,n,role='learner'){return f.service.register({...payload(n,role),publicKey:await key()},'peer'+n);}
const profile=(n)=>({familyName:'Nguyễn',givenName:'Nam',personCode:'PERSON'+n,
 className:'Lớp A',phone:'090'+String(n).padStart(7,'0')});
async function activateManager(f,n=100){
 const m=await register(f,n,'manager');
 assert.equal((await f.flow.ownStatus(m.token)).stage,'requested');
 await assert.rejects(()=>f.service.ownerCommand({actor:'owner@test.invalid',role:'owner'},
  {accountId:m.account.accountId,operation:'approve-manager',expectedRevision:0}),/ONBOARDING/);
 await f.flow.firstReview({kind:'owner',actor:'owner@test.invalid'},m.account.accountId,1);
 await f.flow.submitProfile(m.token,{...profile(n),expectedRevision:2});
 const approved=await f.service.ownerCommand({actor:'owner@test.invalid',role:'owner'},
  {accountId:m.account.accountId,operation:'approve-manager',expectedRevision:0});
 assert.equal(approved.status,'approved');
 assert.equal((await f.flow.ownStatus(m.token)).stage,'active');
 const readback=await f.service.ownerRead(m.account.accountId);
 assert.ok(readback.entitlement?.active, 'second review must grant account entitlement');
 const days=(Date.parse(readback.entitlement.expiresAt)-Date.now())/86400000;
 assert.ok(days>29.99 && days<=30, 'account entitlement must be 30 days even if legacy device default is 90');
 return m;
}
async function activateLearner(f,manager,n=1){
 const learner=await register(f,n);
 await assert.rejects(()=>f.service.review(manager.token,learner.account.accountId,'approve'),/ONBOARDING/);
 await f.flow.firstReview({kind:'manager',token:manager.token},learner.account.accountId,1);
 await f.flow.submitProfile(learner.token,{...profile(n),expectedRevision:2});
 await f.service.review(manager.token,learner.account.accountId,'approve');
 const readback=await f.service.ownerRead(learner.account.accountId);
 assert.ok(readback.entitlement?.active, 'learner needs independent active account entitlement');
 assert.ok((Date.parse(readback.entitlement.expiresAt)-Date.now())/86400000 > 29.99);
 return learner;
}
test('V2 two-stage manager+learner approval: no premature access, owner/manager limits, audited transitions',async()=>{
 const f=fixture();try{
  const manager=await activateManager(f);
  const user=await register(f,1);
  assert.equal(user.account.status,'pending');
  assert.equal((await f.flow.ownStatus(user.token)).stage,'requested');
  await assert.rejects(()=>f.service.authorize(user.token),/ACCOUNT_ONBOARDING_REQUIRED/);
  await assert.rejects(()=>f.flow.firstReview({kind:'manager',token:user.token},manager.account.accountId,1),/ACCOUNT_ONBOARDING|TARGET_ROLE/);
  await f.flow.firstReview({kind:'manager',token:manager.token},user.account.accountId,1);
  await assert.rejects(()=>f.service.authorize(user.token),/ACCOUNT_ONBOARDING_REQUIRED/);
  assert.equal((await f.flow.submitProfile(user.token,{...profile(1),expectedRevision:2})).stage,'profile_review');
  assert.equal((await f.service.review(manager.token,user.account.accountId,'approve')).status,'approved');
  assert.equal((await f.flow.ownStatus(user.token)).stage,'active');
  assert.equal((await f.service.authorize(user.token)).status,'approved');
  const events=f.sqlite.prepare("SELECT action FROM account_audit WHERE target=? ORDER BY id").all(user.account.accountId).map(x=>x.action);
  assert.ok(events.includes('account.review.first'));assert.ok(events.includes('account.profile.submitted'));
  assert.ok(events.includes('registration.approve'));
 }finally{f.sqlite.close()}
});
test('V2 device link: 3 slots, untrusted pending device blocked, trusted confirmation and server revoke',async()=>{
 const f=fixture();try{
  const manager=await activateManager(f);
  const learner=await activateLearner(f,manager);
  const b=await f.service.login({...payload(1),publicKey:await key()},'browser-b');
  assert.equal((await f.service.session(b.token)).deviceApproved,false);
  await assert.rejects(()=>f.service.authorize(b.token),/DEVICE_APPROVAL_REQUIRED/);
  await assert.rejects(()=>f.service.approveDevice(b.token,b.deviceId,payload(1).password,'b'),/DEVICE_APPROVAL_REQUIRED/);
  await f.service.approveDevice(learner.token,b.deviceId,payload(1).password,'a');
  assert.equal((await f.service.authorize(b.token)).status,'approved');
  const c=await f.service.login({...payload(1),publicKey:await key()},'browser-c');
  await assert.rejects(async()=>f.service.login({...payload(1),publicKey:await key()},'browser-d'),e=>e.code==='DEVICE_LIMIT_REACHED');
  await f.service.revokeDevice(learner.token,b.deviceId);
  await assert.rejects(()=>f.service.session(b.token),/SESSION_INVALID/);
  assert.equal((await f.service.session(c.token)).deviceApproved,false);
 }finally{f.sqlite.close()}
});
test('V2 sync: explicit per-device consent, ACK and idempotent retry, conflict and revocation',async()=>{
 const f=fixture();try{
  const manager=await activateManager(f);
  const learner=await activateLearner(f,manager);
  const scope='learning-progress',data={lessonId:'bai-1',completedParts:['p1']};
  await assert.rejects(()=>f.sync.write(learner.token,{scope,eventId:'event-000000000001',recordKey:'bai-1',expectedRevision:0,data}),/SYNC_CONSENT_REQUIRED/);
  await f.sync.consent(learner.token,scope,true,payload(1).password);
  const input={scope,eventId:'event-000000000001',recordKey:'bai-1',expectedRevision:0,data};
  const ack=await f.sync.write(learner.token,input);
  assert.equal(ack.serverRevision,1);assert.equal(ack.acknowledged,true);
  assert.equal((await f.sync.write(learner.token,input)).replayed,true);
  await assert.rejects(()=>f.sync.write(learner.token,{...input,eventId:'event-000000000002'}),e=>e.code==='SYNC_CONFLICT');
  await assert.rejects(()=>f.sync.write(learner.token,{...input,data:{lessonId:'bai-1',password:'leak'},eventId:'event-000000000003'}),/SYNC_DATA_INVALID/);
  const res=await f.sync.read(learner.token,scope);
  assert.equal(res.records[0].revision,1);assert.equal(res.records[0].data.lessonId,'bai-1');
  const b=await f.service.login({...payload(1),publicKey:await key()},'browser-b');
  await assert.rejects(()=>f.sync.read(b.token,scope),/DEVICE_APPROVAL_REQUIRED/);
  await f.service.approveDevice(learner.token,b.deviceId,payload(1).password,'a');
  await assert.rejects(()=>f.sync.read(b.token,scope),/SYNC_CONSENT_REQUIRED/);
  await f.sync.consent(b.token,scope,true,payload(1).password);
  assert.equal((await f.sync.read(b.token,scope)).records.length,1);
  await f.service.revokeDevice(learner.token,b.deviceId);
  await assert.rejects(()=>f.sync.read(b.token,scope),/SESSION_INVALID/);
 }finally{f.sqlite.close()}
});
test('V2 canonical course read: only consented active devices see same server-owned progress, never synthetic sync claims',async()=>{
 const f=fixture();try{
  const manager=await activateManager(f),learner=await activateLearner(f,manager);
  const storageId=learner.account.storageDeviceId;
  f.sqlite.prepare(`UPDATE device_profiles SET completed_json=?,scores_json=?,attempts_json=?,
    total_active_seconds=?,last_activity_at=? WHERE device_id=?`)
   .run(JSON.stringify(['hoc-tap-01','kiem-tra-01','bai-01']),JSON.stringify({'01':9}),
     JSON.stringify({'01':2}),135,'2026-11-08T10:00:00.000Z',storageId);
  await assert.rejects(()=>f.sync.canonicalCourseProgress(learner.token),e=>e.code==='SYNC_CONSENT_REQUIRED');
  await f.sync.consent(learner.token,'learning-progress',true,payload(1).password);
  const original=await f.sync.canonicalCourseProgress(learner.token);
  assert.equal(original.source,'server-verified-device-profile');
  assert.equal(original.readOnly,true);assert.equal(original.accountId,learner.account.accountId);
  assert.deepEqual(original.completed,['hoc-tap-01','kiem-tra-01','bai-01']);
  assert.deepEqual(original.scores,{'01':9});assert.deepEqual(original.attempts,{'01':2});
  assert.equal(original.totalActiveSeconds,135);
  const second=await f.service.login({...payload(1),publicKey:await key()},'browser-b');
  await assert.rejects(()=>f.sync.canonicalCourseProgress(second.token),e=>e.code==='DEVICE_APPROVAL_REQUIRED');
  await f.service.approveDevice(learner.token,second.deviceId,payload(1).password,'browser-a');
  assert.equal((await f.service.authorize(second.token)).storageDeviceId,storageId);
  await assert.rejects(()=>f.sync.canonicalCourseProgress(second.token),e=>e.code==='SYNC_CONSENT_REQUIRED');
  await f.sync.consent(second.token,'learning-progress',true,payload(1).password);
  assert.deepEqual(await f.sync.canonicalCourseProgress(second.token),original,
   'distinct trusted browser keys must read one canonical course profile');
  await f.sync.write(second.token,{scope:'learning-progress',eventId:'event-canonical-0001',recordKey:'bai-01',
   expectedRevision:0,data:{lessonId:'bai-01',completedParts:['unverified-client-part']}});
  assert.deepEqual((await f.sync.canonicalCourseProgress(learner.token)).completed,original.completed,
   'client queued sync must never award completion in canonical course');
  const third=await f.service.login({...payload(1),publicKey:await key()},'browser-c');
  assert.equal((await f.service.session(third.token)).deviceApproved,false);
  await f.service.revokeDevice(learner.token,second.deviceId);
  await assert.rejects(()=>f.sync.canonicalCourseProgress(second.token),e=>e.code==='SESSION_INVALID');
  assert.deepEqual((await f.sync.canonicalCourseProgress(learner.token)).scores,{'01':9},
   'revocation never deletes the canonical course record');
 }finally{f.sqlite.close()}
});
test('V2 migration retains historical accounts in legacy_hold until explicit reconciliation',()=>{
 const f=fixture();try {
  f.sqlite.prepare("INSERT INTO device_access(device_id,display_code,public_key_jwk,person_role) VALUES('legacy','BE-LEGACY','{}','learner')").run();
  f.sqlite.prepare("INSERT INTO accounts(account_id,storage_device_id,login) VALUES('legacy','legacy',NULL)").run();
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id='legacy'").get().stage,'legacy_hold');
  assert.throws(()=>f.sqlite.prepare("UPDATE account_onboarding SET stage='active' WHERE account_id='legacy'").run(),/ONBOARDING_INVALID_TRANSITION/);
 }finally{f.sqlite.close()}
});
