import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {accountStack} from './helpers/account-stack.mjs';
const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('P0: public Boi signup refuses manager before account record or password processing',async()=>{
 const f=accountStack({v2:true});
 try {
  const res=await f.post('api/accounts/route.ts',{
   action:'register',role:'manager',login:'manager-attempt',password:'Not in logs passphrase!',
   privacyAccepted:true
  });
  const body=await res.json();
  assert.equal(res.status,403);
  assert.equal(body.code,'MANAGER_OWNER_INTAKE_REQUIRED');
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM accounts').get().n,0);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM device_access').get().n,0);
 }finally{f.close()}
});
test('P0: public registration UI has only learner and teacher radio; Owner manager instructions visible',()=>{
 const roles=read('../app/registration-roles.tsx');
 const gate=read('../app/account-gate.tsx');
 assert.match(roles,/id:"learner"/);
 assert.match(roles,/id:"teacher"/);
 assert.doesNotMatch(roles,/id:"manager"/);
 assert.match(gate,/Application-Management/);
 assert.match(gate,/Thử đọc lại phiên/);
});
test('P0: actual HTTP registration ingress has a server-side manager deny, not UI-only protection',()=>{
 const route=read('../app/api/accounts/route.ts');
 assert.match(route,/p\.action === "register" && p\.role === "manager"/);
 assert.match(route,/MANAGER_OWNER_INTAKE_REQUIRED/);
});
