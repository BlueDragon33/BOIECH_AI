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
 assert.match(roles,/includeManager/);
 assert.match(roles,/includeManager\?\[/);
 assert.match(gate,/includeManager=\{false\}/);
 assert.match(gate,/Application-Management/);
 assert.match(gate,/Thử đọc lại phiên/);
 assert.match(gate,/Không kết nối được máy chủ tài khoản/);
 assert.match(gate,/tránh trùng yêu cầu/);
 assert.doesNotMatch(gate,/setTimeout\([^)]*send\(/);
 assert.match(gate,/<ManagerV2ReviewPanel\/>/);
});
test('P0: actual HTTP registration ingress has a server-side manager deny, not UI-only protection',()=>{
 const route=read('../app/api/accounts/route.ts');
 assert.match(route,/p\.action === "register" && p\.role === "manager"/);
 assert.match(route,/MANAGER_OWNER_INTAKE_REQUIRED/);
 const legacy=read('../app/device-auth.server.ts');
 assert.match(legacy,/personRole === "manager"/);
 assert.match(legacy,/current\?\.person_role !== "manager"/);
 assert.match(legacy,/accountFirstRuntimeEnabled && personRole/);
 assert.match(legacy,/MANAGER_OWNER_INTAKE_REQUIRED/);
});

test("L2 auth UX: simple login, separate registration and contextual password recovery",()=>{
 const gate=read('../app/account-gate.tsx');
 const css=read('../app/account-gate.module.css');
 assert.match(gate,/mode==="register" \? "Đăng ký"/);
 assert.match(gate,/mode==="login"\?<div className=\{styles.authInlineLinks\}/);
 assert.match(gate,/name="passwordConfirm"/);
 assert.match(gate,/fields\.password!==fields\.passwordConfirm/);
 assert.match(gate,/key=\{mode\} className=\{styles.authForm\}/);
 assert.match(gate,/Chưa có tài khoản\?/);
 assert.match(gate,/Đã có tài khoản\?/);
 assert.doesNotMatch(gate,/"Đăng ký một lần"|"Chuyển hồ sơ cũ"|"Gỡ máy cũ khi đủ 3 thiết bị"/);
 assert.match(css,/authRoot/);
 assert.match(css,/@media\(max-width:560px\)/);
});
test("L2 account UX: linked devices stay in authenticated account area and manager invites retain their path",()=>{
 const gate=read('../app/account-gate.tsx');
 assert.match(gate,/account \? styles\.root :/);
 assert.match(gate,/className=\{styles\.profileDevices\}/);
 assert.match(gate,/Thu hồi thiết bị này/);
 assert.match(gate,/managerInviteRef\.current=invite;setManagerInvite\(invite\)/);
 assert.match(gate,/includeManager=\{false\}/);
});
