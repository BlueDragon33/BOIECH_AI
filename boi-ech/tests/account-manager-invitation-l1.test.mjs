import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {accountStack} from './helpers/account-stack.mjs';
const owner={role:'owner',actor:'owner@fixture.invalid'};
async function key(){
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 return crypto.subtle.exportKey('jwk',pair.publicKey);
}
function request(n,invite){
 return {role:'manager',login:'manager'+n,password:'Private actor passphrase! '+n,
  contactType:'email',contactValue:'manager'+n+'@fixture.invalid',
  managerInviteToken:invite,privacyAccepted:true,securityAnswer:"Ten thoi tho au"};
}
test('Owner issues a one-use invitation; DB stores only hash and an immutable audit',async()=>{
 const f=accountStack({v2:true});try{
  const issued=await f.service.issueManagerInvite(owner,1);
  assert.equal(issued.verified,true);
  assert.match(issued.inviteToken,/^[a-f0-9]{64}$/);
  assert.ok(Date.parse(issued.expiresAt)>Date.now());
  const h=createHash('sha256').update(issued.inviteToken).digest('hex');
  const row=f.sqlite.prepare('SELECT * FROM account_manager_invitations WHERE invite_hash=?').get(h);
  assert.equal(row.issued_by,owner.actor);
  assert.equal(row.consumed_by,null);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit WHERE action='owner.manager-invite.issued'").get().n,1);
  assert.doesNotMatch(JSON.stringify(row),new RegExp(issued.inviteToken));
  assert.throws(()=>f.sqlite.prepare('DELETE FROM account_audit').run(),/AUDIT_IMMUTABLE/);
 }finally{f.close()}
});
test('Applicant controls own credential+P256; redemption is atomic, pending and cannot replay',async()=>{
 const f=accountStack({v2:true});try{
  const issued=await f.service.issueManagerInvite(owner,1);
  const input={...request(10,issued.inviteToken),publicKey:await key()};
  const result=await f.service.registerManagerWithInvite(input,'peer-10');
  assert.equal(result.account.status,'pending');
  assert.equal(result.account.role,'manager');
  const row=f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?").get(result.account.accountId);
  assert.equal(row.stage,'requested');
  assert.equal(f.sqlite.prepare('SELECT status FROM device_access WHERE device_id=?').get(result.account.storageDeviceId).status,'pending');
  const consumed=f.sqlite.prepare('SELECT consumed_by,revision FROM account_manager_invitations').get();
  assert.equal(consumed.consumed_by,result.account.accountId);
  assert.equal(consumed.revision,2);
  await assert.rejects(async()=>f.service.registerManagerWithInvite(
   {...request(11,issued.inviteToken),publicKey:await key()},'peer-11'),e=>e.code==='MANAGER_INVITATION_INVALID');
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM accounts').get().n,1);
 }finally{f.close()}
});
test('Wrong role, expired or forged invitation cannot create account and no auth sessions',async()=>{
 const f=accountStack({v2:true});try{
  const issued=await f.service.issueManagerInvite(owner,1);
  await assert.rejects(async()=>f.service.registerManagerWithInvite(
    {...request(21,'0'.repeat(64)),publicKey:await key()},'peer-21'),e=>e.code==='MANAGER_INVITATION_INVALID');
  await assert.rejects(async()=>f.service.registerManagerWithInvite(
    {...request(22,issued.inviteToken),role:'teacher',publicKey:await key()},'peer-22'),e=>e.code==='ACCOUNT_INPUT');
  f.sqlite.prepare('UPDATE account_manager_invitations SET expires_at_ms=?').run(Date.now()-1);
  await assert.rejects(async()=>f.service.registerManagerWithInvite(
    {...request(23,issued.inviteToken),publicKey:await key()},'peer-23'),e=>e.code==='MANAGER_INVITATION_INVALID');
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM accounts').get().n,0);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n,0);
 }finally{f.close()}
});
test('CAS admission revision and quota 20 unused invites are enforced; no plaintext audit',async()=>{
 const f=accountStack({v2:true});try{
  await assert.rejects(()=>f.service.issueManagerInvite(owner,2),e=>e.code==='MANAGER_INVITATION_CONFLICT');
  const tokens=[];
  for(let i=0;i<20;i++)tokens.push((await f.service.issueManagerInvite(owner,1)).inviteToken);
  await assert.rejects(()=>f.service.issueManagerInvite(owner,1),e=>e.code==='MANAGER_INVITATION_CONFLICT');
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM account_manager_invitations').get().n,20);
  for(const token of tokens)assert.ok(!JSON.stringify(f.sqlite.prepare('SELECT * FROM account_audit').all()).includes(token));
 }finally{f.close()}
});

test('Actual account HTTP manager-register requires one-time invite and returns pending account',async()=>{
 const f=accountStack({v2:true});try{
  const issued=await f.service.issueManagerInvite(owner,1);
  const response=await f.post('api/accounts/route.ts',{
    action:'manager-register',...request(100,issued.inviteToken),publicKey:await key()
  });
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.ok,true);
  assert.equal(payload.account.role,'manager');
  assert.equal(payload.account.status,'pending');
  assert.ok((response.headers.get('set-cookie')??'').includes('HttpOnly'));
  assert.ok(!JSON.stringify(payload).includes(issued.inviteToken));
  const replay=await f.post('api/accounts/route.ts',{
    action:'manager-register',...request(101,issued.inviteToken),publicKey:await key()
  });
  assert.equal(replay.status,409);
  assert.equal((await replay.json()).code,'MANAGER_INVITATION_INVALID');
 }finally{f.close()}
});
