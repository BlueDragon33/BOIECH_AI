import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {accountStack} from './helpers/account-stack.mjs';
test('activation maps eligible legacy identities once without changing profile, payment, role, approval or granting V2 access',()=>{
 const f=accountStack({v2:true});try{
  const id='a'.repeat(64);
  f.sqlite.prepare(`INSERT INTO device_access(device_id,display_code,public_key_jwk,status,person_role,person_code,phone,registration_submitted_at,management_enabled,payment_status,access_group) VALUES(?,?,?,'approved','manager','LEGACY1','0901234567',CURRENT_TIMESTAMP,1,'free_approved','free')`).run(id,'BE-LEGACY','{}');
  f.sqlite.prepare('INSERT INTO device_profiles(device_id) VALUES(?)').run(id);
  const before=JSON.stringify(f.sqlite.prepare('SELECT * FROM device_access').all());
  const sql=fs.readFileSync(new URL('../scripts/account-first-legacy.sql',import.meta.url),'utf8');
  f.sqlite.exec(sql);f.sqlite.exec(sql);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM accounts').get().n,1);
  assert.equal(f.sqlite.prepare('SELECT stage FROM account_onboarding').get().stage,'legacy_hold');
  assert.equal(f.sqlite.prepare('SELECT approved FROM account_devices').get().approved,0);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM account_entitlements').get().n,0);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM account_credentials').get().n,0);
  assert.equal(JSON.stringify(f.sqlite.prepare('SELECT * FROM device_access').all()),before);
 }finally{f.close()}
});
