import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {accountStack} from "./helpers/account-stack.mjs";

const minute=60_000,hour=60*minute,day=24*hour;
function leaseFixture(){
 const f=accountStack({v2:true,singleReview:true});
 let now=Date.now();
 const Service=f.load("account-core.server.ts").AccountService;
 const s=new Service(f.db,()=>now,true,true);
 return {...f,serviceAt:s,advance:ms=>{now+=ms;},jump:v=>{now=v;},time:()=>now};
}
function row(f,token){
 const hash=createHashToken(token);
 return f.sqlite.prepare("SELECT issued_at_ms,expires_at,idle_expires_at,revoked FROM account_sessions WHERE token_hash=?").get(hash);
}
function createHashToken(token) {
 return requireHash(token);
}
import {createHash} from "node:crypto";
const requireHash=token=>createHash("sha256").update(token).digest("hex");

test("Active authenticated use extends idle lease and rolling 8h horizon without changing the cookie token",async()=>{
 const f=leaseFixture();
 try{
  const a=await f.register(41001);
  const first=row(f,a.token);
  assert.ok(first.issued_at_ms>0);
  assert.equal(first.expires_at-first.issued_at_ms,8*hour);
  assert.equal(first.idle_expires_at-first.issued_at_ms,30*minute);
  f.advance(25*minute);
  const renewed=await f.serviceAt.keepAlive(a.token);
  assert.equal(renewed.ok,true);
  const second=row(f,a.token);
  assert.equal(second.issued_at_ms,first.issued_at_ms);
  assert.ok(second.idle_expires_at>first.idle_expires_at);
  assert.ok(second.expires_at>first.expires_at);
  assert.equal(second.revoked,0);
  f.advance(7*minute);
  assert.equal((await f.serviceAt.session(a.token)).accountId,a.account.accountId);
  await assert.rejects(()=>f.serviceAt.authorize(a.token),e=>e.code==="ACCOUNT_ONBOARDING_REQUIRED");
  // Staying signed in does not manufacture an approval or an entitlement.
 }finally{f.close();}
});
test("An expired, forged or revoked session can never be revived by the keepalive endpoint",async()=>{
 const f=leaseFixture();try{
  const a=await f.register(41002);
  await assert.rejects(()=>f.serviceAt.keepAlive("a".repeat(64)),e=>["SESSION_INVALID","SESSION_REQUIRED"].includes(e.code));
  f.advance(31*minute);
  await assert.rejects(()=>f.serviceAt.keepAlive(a.token),e=>e.code==="SESSION_INVALID");
  const stale=row(f,a.token);
  assert.equal(stale.revoked,0);
  // Recreate fresh account so a revoke is tested independently of idle expiry.
  f.jump(Date.now());
  const b=await f.register(41003);
  const res=await f.serviceAt.keepAlive(b.token);
  assert.equal(res.ok,true);
  f.sqlite.prepare("UPDATE account_sessions SET revoked=1 WHERE token_hash=?").run(createHashToken(b.token));
  await assert.rejects(()=>f.serviceAt.keepAlive(b.token),e=>e.code==="SESSION_INVALID");
 }finally{f.close();}
});
test("Even continuous renewal cannot exceed the original seven-day authentication hard cap",async()=>{
 const f=leaseFixture();try{
  const a=await f.register(41004);
  const original=row(f,a.token),almost=original.issued_at_ms+7*day-5*minute;
  f.sqlite.prepare("UPDATE account_sessions SET expires_at=?,idle_expires_at=? WHERE token_hash=?")
   .run(almost+3*minute,almost+2*minute,createHashToken(a.token));
  f.jump(almost);
  const updated=await f.serviceAt.keepAlive(a.token);
  assert.equal(updated.ok,true);
  const after=row(f,a.token);
  assert.equal(after.issued_at_ms,original.issued_at_ms);
  assert.equal(after.expires_at,original.issued_at_ms+7*day);
  assert.equal(after.idle_expires_at,original.issued_at_ms+7*day);
  f.advance(5*minute);
  await assert.rejects(()=>f.serviceAt.keepAlive(a.token),e=>e.code==="SESSION_INVALID");
 }finally{f.close();}
});
test("Rotate keeps the original issue time and cannot reset the seven-day cap",async()=>{
 const f=leaseFixture();try{
  const a=await f.register(41005);
  const before=row(f,a.token);
  f.advance(2*minute);
  const b=await f.serviceAt.rotate(a.token);
  assert.notEqual(b.token,a.token);
  await assert.rejects(()=>f.serviceAt.session(a.token),e=>e.code==="SESSION_INVALID");
  const after=row(f,b.token);
  assert.equal(after.issued_at_ms,before.issued_at_ms);
 }finally{f.close();}
});
test("CSRF is enforced, status GET is read-only, and lease renewal response leaks no bearer cookie",async()=>{
 const f=leaseFixture();try{
  const a=await f.register(41006);
  f.setCookie(a.token);
  const before=row(f,a.token);
  const response=await f.get("api/accounts/route.ts");
  assert.equal(response.status,200);
  const publicState=await response.json();
  assert.equal(publicState.account.sessionExpiresAt,before.expires_at);
  assert.equal(publicState.account.sessionIdleExpiresAt,before.idle_expires_at);
  assert.equal(row(f,a.token).idle_expires_at,before.idle_expires_at);
  const denied=await f.load("api/accounts/route.ts").POST(new Request("https://fixture.invalid/api/accounts",{
   method:"POST",headers:{origin:"https://attacker.invalid","content-type":"application/json"},
   body:JSON.stringify({action:"keepalive"})}));
  assert.equal(denied.status,403);
  const valid=await f.post("api/accounts/route.ts",{action:"keepalive"});
  assert.equal(valid.status,200);
  assert.equal((await valid.json()).ok,true);
  assert.equal(valid.headers.get("set-cookie"),null,"keepalive never rotates or exposes the cookie");
  const runtime=readFileSync(new URL("../app/account-runtime.server.ts",import.meta.url),"utf8");
  assert.match(runtime,/HttpOnly; Secure; SameSite=Strict; Max-Age=/);
  assert.match(runtime,/604800/);
 }finally{f.close();}
});
test("Browser renewals require foreground engagement; background tabs and polling cannot act as perpetual auth",()=>{
 const source=readFileSync(new URL("../app/account-gate.tsx",import.meta.url),"utf8");
 assert.match(source,/document.hidden \|\| lock.current/);
 assert.match(source,/if \(refreshInFlight.current\) \{ queuedAfterCurrent = true; return; \}/);
 assert.match(source,/now-lastUserEngagementAt.current>15\*60_000/);
 assert.match(source,/action:"keepalive"/);
 assert.match(source,/Phiên đăng nhập sắp hết hạn/);
 assert.match(source,/Giữ phiên đăng nhập/);
 assert.match(source,/window.addEventListener\("focus", refresh\)/);
 assert.doesNotMatch(source,/needsApprovalPolling \? 20000 : 60000/);
});
