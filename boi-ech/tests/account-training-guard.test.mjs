import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fixture,identity} from './helpers/device-auth-fixture.mjs';
test('actual final training SQL denies expired capability and revoked sessions after an earlier check',async()=>{
 const f=fixture('managed',true);try{
  const key=await identity();const {device}=await f.post({action:'register',publicKey:key.publicKey});const id='acc_'+device.deviceId,hash='a'.repeat(64),now=Date.now();
  f.sqlite.prepare("UPDATE device_access SET person_role='manager',status='approved',management_enabled=1,person_code='GUARD',phone='0900000090',learner_name='Synthetic manager',class_name='A',registration_submitted_at=CURRENT_TIMESTAMP WHERE device_id=?").run(device.deviceId);
  f.sqlite.prepare('UPDATE device_access SET management_enabled=1 WHERE device_id=?').run(device.deviceId);
  f.sqlite.prepare('INSERT INTO accounts(account_id,storage_device_id) VALUES(?,?)').run(id,device.deviceId);
  f.sqlite.prepare("INSERT INTO account_credentials(account_id,password_verifier,recovery_hash,generation) VALUES(?,'unused-test-verifier','unused-test-recovery',1)").run(id);
  f.sqlite.prepare('INSERT INTO account_devices(account_id,device_id,public_key_jwk) VALUES(?,?,?)').run(id,device.deviceId,JSON.stringify(key.publicKey));
  f.sqlite.prepare('INSERT INTO account_sessions(token_hash,account_id,device_id,generation,expires_at,idle_expires_at) VALUES(?,?,?,1,?,?)').run(hash,id,device.deviceId,now+60000,now+60000);
  f.sqlite.prepare("INSERT INTO account_manager_permissions(account_id,scope,enabled,expires_at,granted_by) VALUES(?,'manager.manage.assigned',1,?,'fixture')").run(id,now-1000);
  const source=fs.readFileSync(new URL('../app/training-management.server.ts',import.meta.url),'utf8');const match=source.match(/const authorityGuard=actor\.accountId\?`([\s\S]*?)`:AUTH_GUARD/);assert.ok(match,'production authority SQL must be present');
  const guard=new Function('scopedTarget','return `'+match[1]+'`;')(null);
  const insert=f.sqlite.prepare("INSERT INTO training_resources(id,kind,name,capacity,required_teachers,status,version) SELECT ?,'building',?,10,1,'active',1 WHERE "+guard);
  assert.equal(Number(insert.run('expired','Expired',device.deviceId,hash).changes),0);
  f.sqlite.prepare('UPDATE account_manager_permissions SET expires_at=? WHERE account_id=?').run(now+60000,id);
  f.sqlite.prepare('UPDATE account_sessions SET revoked=1').run();assert.equal(Number(insert.run('revoked','Revoked',device.deviceId,hash).changes),0);
  f.sqlite.prepare('UPDATE account_sessions SET revoked=0').run();assert.equal(Number(insert.run('allowed','Allowed',device.deviceId,hash).changes),1);
  f.sqlite.prepare('UPDATE account_manager_permissions SET enabled=0').run();assert.equal(Number(insert.run('no-scope','No scope',device.deviceId,hash).changes),0);
 }finally{f.sqlite.close()}
});
