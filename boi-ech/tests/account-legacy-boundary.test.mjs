import test from 'node:test';import assert from 'node:assert/strict';import {accountStack} from './helpers/account-stack.mjs';
test('account-mode teacher cannot approve past shared quota or mutate account approval via legacy roster',async()=>{
 const f=accountStack();try{
  const teacher=await f.register(100,'teacher'),learner=await f.register(1);
  f.sqlite.prepare("UPDATE device_access SET status='approved',access_group='free',payment_status='free_approved' WHERE device_id=?").run(teacher.account.storageDeviceId);
  const manager='a'.repeat(64);f.sqlite.prepare("INSERT INTO device_access(device_id,display_code,public_key_jwk,status,person_role,person_code,phone,learner_name,class_name,registration_submitted_at,management_enabled) VALUES(?,?,?,'approved','manager','MANAGERSEED','seedmanager','Seed manager','Other class',CURRENT_TIMESTAMP,1)").run(manager,'BE-MANAGER','{}');f.sqlite.prepare('INSERT INTO accounts(account_id,storage_device_id) VALUES(?,?)').run('acc_'+manager,manager);
  for(let n=201;n<=250;n++){const id=n.toString(16).padStart(64,'0');f.sqlite.prepare("INSERT INTO device_access(device_id,display_code,public_key_jwk,status,person_role,person_code,phone,learner_name,class_name,registration_submitted_at) VALUES(?,?,?,'pending','learner',?,?,?,'Other class',CURRENT_TIMESTAMP)").run(id,'BE-'+n,'{}','SEED'+n,'seed'+n,'Seed '+n);f.sqlite.prepare('INSERT INTO accounts(account_id,storage_device_id) VALUES(?,?)').run('acc_'+id,id);f.sqlite.prepare("INSERT INTO manager_device_assignments(target_device_id,manager_device_id,person_role) VALUES(?,?,'learner')").run(id,manager);f.sqlite.prepare("UPDATE device_access SET status='approved' WHERE device_id=?").run(id);}
  f.setCookie(teacher.token);
  const before=f.sqlite.prepare('SELECT status,payment_status,access_expires_at FROM device_access WHERE device_id=?').get(learner.account.storageDeviceId);
  for(const action of ['approve','remove']){
   const response=await f.post('api/teacher/roster/route.ts',{action,personCode:'PERSON1',deviceId:teacher.account.storageDeviceId});assert.equal(response.status,403);assert.equal((await response.json()).code,'ACCOUNT_REVIEW_MANAGER_REQUIRED');
   assert.deepEqual(f.sqlite.prepare('SELECT status,payment_status,access_expires_at FROM device_access WHERE device_id=?').get(learner.account.storageDeviceId),before);
  }
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM device_access WHERE person_role='learner' AND status='approved'").get().n,50);
  await assert.rejects(()=>f.service.authorize(learner.token,true),/PENDING/);
  const list=await f.post('api/teacher/roster/route.ts',{action:'list',deviceId:teacher.account.storageDeviceId});assert.equal(list.status,200);assert.equal((await list.json()).canManage,false);
 }finally{f.close()}
});
test('pre-proof challenges on both HTTP endpoints reveal no profile on success or blocked errors',async()=>{
 const f=accountStack();try{
  const learner=await f.register(1);f.sqlite.prepare("UPDATE device_access SET payment_review_note='SENSITIVE PAYMENT NOTE' WHERE device_id=?").run(learner.account.storageDeviceId);
  for(const status of ['pending','blocked']){
   f.sqlite.prepare('UPDATE device_access SET status=? WHERE device_id=?').run(status,learner.account.storageDeviceId);
   for(const[route,action]of[['api/accounts/route.ts','legacy-challenge'],['api/device/route.ts','challenge']]){
    const response=await f.post(route,{action,deviceId:learner.account.storageDeviceId});const data=await response.json();assert.doesNotMatch(JSON.stringify(data),/SENSITIVE PAYMENT NOTE|phone|learnerName|paymentReviewNote|"device"/);
    if(response.ok){assert.deepEqual(Object.keys(data).sort(),['challenge','expiresAt']);assert.equal(typeof data.challenge,'string')}else assert.equal(response.status,403);
   }
  }
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM account_audit WHERE action='registrants.read.all'").get().n,0);
 }finally{f.close()}
});

test('flag OFF preserves the legacy challenge response contract',async()=>{
 const f=accountStack();try{
  const learner=await f.register(1);f.setAccountMode(false);
  const response=await f.post('api/device/route.ts',{action:'challenge',deviceId:learner.account.storageDeviceId});
  assert.equal(response.status,200);const data=await response.json();assert.equal(typeof data.challenge,'string');assert.equal(data.device.deviceId,learner.account.storageDeviceId);assert.equal(data.device.phone,'0900000001');
 }finally{f.close()}
});
