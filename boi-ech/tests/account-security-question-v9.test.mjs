import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {accountStack} from "./helpers/account-stack.mjs";

const password="V9 integration password #01";
async function registerWithSigningKey(f,n,role="learner",answer="Bé Bông"){
  const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  const publicKey=await crypto.subtle.exportKey("jwk",pair.publicKey);
  const login="childhood"+n;
  const account=await f.service.register({login,password,role,publicKey,
    securityAnswer:answer,contactType:"email",contactValue:login+"@example.invalid",
    privacyAccepted:true},"fixture-ip-"+n);
  return {login,account,privateKey:pair.privateKey,publicKey};
}
const svc=f=>new (f.load("account-security-question.server.ts").AccountSecurityQuestionService)(f.db,f.service);
async function proof(user,challenge){
  const bytes=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},user.privateKey,
    new TextEncoder().encode("boi-ech:recover:"+user.login+":"+challenge));
  return {challenge,signature:Buffer.from(bytes).toString("base64url")};
}

test("V9 question stored only as salted verifier at initial registration; no four profile fields",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const user=await registerWithSigningKey(f,17001);
  const row=f.sqlite.prepare("SELECT answer_verifier FROM account_recovery_questions WHERE account_id=?")
    .get(user.account.account.accountId);
  assert.ok(row);
  assert.match(row.answer_verifier,/^scrypt\$32768\$8\$3\$/);
  assert.equal(row.answer_verifier.length,114);
  assert.doesNotMatch(row.answer_verifier,/Bé Bông|bé bông/);
  assert.equal((await svc(f).status(user.account.token)).configured,true);
  assert.equal(f.sqlite.prepare("SELECT stage FROM account_onboarding WHERE account_id=?")
    .get(user.account.account.accountId).stage,"requested");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?")
    .get(user.account.account.accountId).n,0);
 }finally{f.close();}
});

test("V9 question alone cannot recover password; wrong answer and wrong original key fail",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const user=await registerWithSigningKey(f,17002),service=svc(f);
  const nonce=await service.challenge(user.login,"fixture-peer-q");
  await assert.rejects(()=>service.recover({login:user.login,
    securityAnswer:"Sai",password:"New password safe 123",challenge:nonce.challenge,
    signature:"invalid-signature"},"fixture-peer-q"),
    e=>e.status===401);
  const second=await service.challenge(user.login,"fixture-peer-q");
  const goodSignature=await proof(user,second.challenge);
  await assert.rejects(()=>service.recover({login:user.login,
    securityAnswer:"Sai",password:"New password safe 123",...goodSignature},"fixture-peer-q"),
    e=>e.status===401&&e.code==="AUTH_FAILED");
  const after=f.sqlite.prepare("SELECT generation FROM account_credentials WHERE account_id=?")
    .get(user.account.account.accountId);
  assert.equal(after.generation,1);
 }finally{f.close();}
});

test("V9 trusted original P-256 plus normalized answer recovers and revokes previous session",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const user=await registerWithSigningKey(f,17003),service=svc(f);
  const next=await service.challenge(user.login,"fixture-peer-q2");
  const recovery=await service.recover({login:user.login,
    securityAnswer:"  BÉ   BÔNG  ",password:"New password safe 123",
    ...await proof(user,next.challenge)},"fixture-peer-q2");
  assert.match(recovery.recoveryCode,/^[a-f0-9]{64}$/);
  assert.notEqual(recovery.recoveryCode,user.account.recoveryCode);
  await assert.rejects(()=>f.service.session(user.account.token),e=>e.status===401);
  const newSession=await f.service.login({login:user.login,password:"New password safe 123",
    publicKey:user.publicKey},"fixture-login-new");
  assert.ok(newSession.token);
  await assert.rejects(()=>service.recover({login:user.login,
    securityAnswer:"Bé Bông",password:"Next password safe 123",
    ...await proof(user,next.challenge)},"fixture-peer-q2"),e=>e.status===401);
 }finally{f.close();}
});

test("V9 cannot recover after original P-256 device was revoked",async()=>{
 const f=accountStack({v2:true,singleReview:true});
 try{
  const user=await registerWithSigningKey(f,17004),service=svc(f);
  const next=await service.challenge(user.login,"fixture-peer-revoked");
  f.sqlite.prepare("UPDATE account_devices SET revoked=1 WHERE account_id=?")
    .run(user.account.account.accountId);
  await assert.rejects(()=>service.recover({login:user.login,securityAnswer:"Bé Bông",
    password:"New password safe 123",...await proof(user,next.challenge)},"fixture-peer-revoked"),
    e=>e.status===401);
 }finally{f.close();}
});

test("V9 manager/learner/teacher registration has no initial Họ, Tên, Lớp, SĐT fields",()=>{
 const gate=readFileSync(new URL("../app/account-gate.tsx",import.meta.url),"utf8");
 assert.doesNotMatch(gate,/!v2\?\[\["familyName"/);
 assert.match(gate,/Đăng ký mới yêu cầu Account-first V2/);
 assert.match(gate,/Tên lúc nhỏ của bạn là gì\?/);
 assert.match(gate,/securityQuestionConfigured/);
 assert.match(gate,/profile-draft-activate/);
 assert.match(gate,/attemptedAutoActivation/);
 const backend=readFileSync(new URL("../app/account-security-question.server.ts",import.meta.url),"utf8");
 assert.match(backend,/b\.approved=1 AND b\.revoked=0/);
 assert.match(backend,/UPDATE account_sessions SET revoked=1/);
 assert.doesNotMatch(backend,/return \{[^}]*answer_verifier:/);
});
