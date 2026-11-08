import test from 'node:test';
import assert from 'node:assert/strict';
import {accountStack} from './helpers/account-stack.mjs';

async function newKey(){
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 return crypto.subtle.exportKey('jwk',pair.publicKey);
}
const profile=n=>({familyName:'Synthetic',givenName:'Person',personCode:'PERSON'+n,
 className:'Same class',phone:'090'+String(n).padStart(7,'0')});
async function approveFirstManager(f){
 const manager=await f.register(100,'manager');
 await f.flow.firstReview({kind:'owner',actor:'owner@fixture.invalid'},manager.account.accountId,1);
 await f.flow.submitProfile(manager.token,{...profile(100),expectedRevision:2});
 await f.service.ownerCommand({role:'owner',actor:'owner@fixture.invalid'},
  {accountId:manager.account.accountId,operation:'approve-manager',expectedRevision:0});
 return manager;
}
async function approveLearner(f,manager){
 const learner=await f.register(1,'learner');
 await f.flow.firstReview({kind:'manager',token:manager.token},learner.account.accountId,1);
 await f.flow.submitProfile(learner.token,{...profile(1),expectedRevision:2});
 await f.service.review(manager.token,learner.account.accountId,'approve');
 return learner;
}

test('real course HTTP route uses one canonical verified profile for distinct V2 browser keys; suspension denies new reads',async()=>{
 const f=accountStack({v2:true});
 try{
  const manager=await approveFirstManager(f);
  const learner=await approveLearner(f,manager);
  const anchor=learner.account.storageDeviceId;
  f.sqlite.prepare('UPDATE device_profiles SET completed_json=?,scores_json=?,attempts_json=? WHERE device_id=?')
   .run(JSON.stringify(['hoc-tap-01']),JSON.stringify({'01':9}),JSON.stringify({'01':2}),anchor);
  const body={action:'bootstrap',lessonNumber:'01'};
  const anonymous=await f.post('api/course/route.ts',body);
  assert.notEqual(anonymous.status,200,'V2 course route cannot fall back to anonymous legacy signed device claims');

  f.setCookie(learner.token);
  const first=await f.post('api/course/route.ts',body);
  assert.equal(first.status,200,JSON.stringify(await first.clone().json()));
  const firstData=await first.json();
  assert.ok(firstData.state.completed.includes('hoc-tap-01'));
  assert.equal(firstData.state.scores['01'],9);

  const second=await f.service.login({login:'fixture1',password:'Local-only unique passphrase 1',publicKey:await newKey()},'second');
  f.setCookie(second.token);
  const pending=await f.post('api/course/route.ts',body);
  assert.notEqual(pending.status,200,'a new device must fail closed until trusted approval');

  await f.service.approveDevice(learner.token,second.deviceId,'Local-only unique passphrase 1','original');
  assert.equal((await f.service.authorize(second.token)).storageDeviceId,anchor);
  const accepted=await f.post('api/course/route.ts',body);
  assert.equal(accepted.status,200,JSON.stringify(await accepted.clone().json()));
  const onSecond=await accepted.json();
  assert.deepEqual(onSecond.state.completed,firstData.state.completed);
  assert.deepEqual(onSecond.state.scores,firstData.state.scores);

  f.sqlite.prepare("UPDATE account_entitlements SET state='suspended' WHERE account_id=?").run(learner.account.accountId);
  const denied=await f.post('api/course/route.ts',body);
  assert.notEqual(denied.status,200,'a suspended account cannot open the course even with an approved browser');
  assert.deepEqual(JSON.parse(f.sqlite.prepare('SELECT completed_json FROM device_profiles WHERE device_id=?').get(anchor).completed_json),
   ['hoc-tap-01'],'suspension must preserve prior course completion');
 }finally{f.close()}
});
