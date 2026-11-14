import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {accountStack} from "./helpers/account-stack.mjs";

const owner={role:"owner",actor:"owner@roster.fixture.invalid"};
const instant=(days)=>new Date(Date.now()-days*86400000).toISOString().replace("T"," ").slice(0,19);
const id=(n)=>n.toString(16).padStart(64,"0");
function orphan(f,n,days=15,role="learner"){
 const device=id(n),old=instant(days);
 f.sqlite.prepare(`INSERT INTO device_access
  (device_id,display_code,public_key_jwk,status,person_role,learner_name,
   class_name,created_at,last_seen_at)
  VALUES(?,?,?,'pending',?,?,?, ?,?)`)
  .run(device,"LEGACY-"+n,"{}",role,"Legacy user "+n,"Old class",old,old);
 f.sqlite.prepare("INSERT INTO device_profiles(device_id) VALUES(?)").run(device);
 return device;
}
async function activeManager(f){
 const revision=f.sqlite.prepare("SELECT revision FROM account_admission_limits WHERE person_role='manager'").get().revision;
 const invitation=await f.service.issueManagerInvite(owner,revision);
 const keys=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const publicKey=await crypto.subtle.exportKey("jwk",keys.publicKey);
 const issued=await f.service.registerManagerWithInvite({
   login:"rosterstaff",password:"Long unique manager fixture password 2026",
   role:"manager",managerInviteToken:invitation.inviteToken,
   contactType:"email",contactValue:"rosterstaff@fixture.invalid",
   publicKey,privacyAccepted:true
 }, "roster-test");
 await f.flow.completeProfileWithoutReview(issued.token,{
   familyName:"Rosters",givenName:"Administrator",facultyUnit:"Training",
   jobTitle:"Manager",jobPosition:"Supervisor",expectedRevision:1
 });
 const session=await f.service.authorize(issued.token);
 return {accountId:session.accountId,sessionHash:session.sessionHash};
}
async function data(){
 const f=accountStack({v2:true,singleReview:true});
 const svc=f.load("manager-roster-cleanup.server.ts");
 const manager=await activeManager(f);
 return {f,svc,manager};
}
const preview=(v,days=7)=>v.svc.inspectManagerRosterDb(v.f.db,{days});
const purge=(v,row,extra={})=>v.svc.purgeManagerRosterDb(v.f.db,v.manager,{
 days:7,deviceId:row.deviceId,snapshot:row.snapshot,
 reason:"Manager reviewed unused, unlinked old roster and confirmed data absence",
 confirmation:"XOA HO SO CU",...extra
});
test("34 roster-like rows can include 31 orphan legacy and three protected Account-first profiles",async()=>{
 const v=await data();try{
  for(let i=300;i<331;i++)orphan(v.f,i);
  for(let i=0;i<3;i++)await v.f.register(92000+i,i===2?"teacher":"learner");
  const result=await preview(v);
  assert.equal(result.scanned,34);
  assert.equal(result.eligible,31);
  assert.equal(result.protected,3);
  assert.ok(result.records.filter(r=>r.category==="account-first").every(r=>!r.eligible));
  assert.ok(result.records.filter(r=>r.category==="legacy").every(r=>r.eligible));
  assert.equal(v.f.sqlite.prepare("SELECT COUNT(*) AS n FROM accounts").get().n,4);
 }finally{v.f.close();}
});
test("only a selected aged orphan is deleted in an atomic D1 batch, keeping audit",async()=>{
 const v=await data();try{
  const old=orphan(v.f,700);
  const second=orphan(v.f,701);
  const result=await preview(v);
  const row=result.records.find(r=>r.deviceId===old);
  assert.equal(row?.eligible,true);
  const answer=await purge(v,row);
  assert.equal(answer.deleted,true);
  assert.equal(answer.auditPreserved,true);
  assert.equal(v.f.sqlite.prepare("SELECT COUNT(*) AS n FROM device_access WHERE device_id=?").get(old).n,0);
  assert.equal(v.f.sqlite.prepare("SELECT COUNT(*) AS n FROM device_profiles WHERE device_id=?").get(old).n,0);
  assert.equal(v.f.sqlite.prepare("SELECT COUNT(*) AS n FROM device_access WHERE device_id=?").get(second).n,1);
  assert.equal(v.f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit WHERE action='manager.legacy-roster.purged'").get().n,1);
  await assert.rejects(()=>purge(v,row),e=>e.code==="ROSTER_CLEANUP_NOT_FOUND");
 }finally{v.f.close();}
});
test("recent, previously approved and canonical accounts are NEVER manager-deletable",async()=>{
 const v=await data();try{
  const recent=orphan(v.f,710,1),approved=orphan(v.f,711,40);
  v.f.sqlite.prepare("UPDATE device_access SET status='approved',approved_at=? WHERE device_id=?")
    .run(instant(30),approved);
  const linked=await v.f.register(92008);
  const result=await preview(v);
  const a=result.records.find(r=>r.deviceId===recent);
  const b=result.records.find(r=>r.deviceId===approved);
  const c=result.records.find(r=>r.deviceId===linked.account.storageDeviceId);
  assert.equal(a?.eligible,false);assert.equal(b?.eligible,false);assert.equal(c?.eligible,false);
  assert.ok(c.blockers.some(t=>t.includes("Account-first")));
  for(const row of [a,b,c])await assert.rejects(()=>purge(v,row),
    e=>e.code==="ROSTER_CLEANUP_CHANGED");
 }finally{v.f.close();}
});
test("learning progress and historical payments block an otherwise unused legacy roster",async()=>{
 const v=await data();try{
  const progress=orphan(v.f,720),payment=orphan(v.f,721);
  v.f.sqlite.prepare("UPDATE device_profiles SET total_active_seconds=120 WHERE device_id=?").run(progress);
  v.f.sqlite.prepare("UPDATE device_access SET payment_status='paid_verified' WHERE device_id=?").run(payment);
  const scanned=await preview(v);
  const p=scanned.records.find(r=>r.deviceId===progress);
  const b=scanned.records.find(r=>r.deviceId===payment);
  assert.equal(p.eligible,false);assert.equal(b.eligible,false);
  assert.ok(p.blockers.some(t=>t.includes("tiến độ")));
  assert.ok(b.blockers.some(t=>t.includes("thanh toán")));
 }finally{v.f.close();}
});
test("stale snapshot, invalid manager session, wrong confirmation cannot purge",async()=>{
 const v=await data();try{
  const target=orphan(v.f,730),r=(await preview(v)).records.find(x=>x.deviceId===target);
  await assert.rejects(()=>purge(v,r,{confirmation:"wrong"}),
    e=>e.code==="ROSTER_CLEANUP_CONFIRMATION_REQUIRED");
  await assert.rejects(()=>v.svc.purgeManagerRosterDb(v.f.db,
    {accountId:v.manager.accountId,sessionHash:"invalid"},{
      days:7,deviceId:r.deviceId,snapshot:r.snapshot,
      reason:"Manager checks rejected unknown session",confirmation:"XOA HO SO CU"
    }),e=>e.code==="ROSTER_CLEANUP_CHANGED");
  v.f.sqlite.prepare("UPDATE device_access SET last_seen_at=CURRENT_TIMESTAMP WHERE device_id=?")
    .run(target);
  await assert.rejects(()=>purge(v,r),e=>e.code==="ROSTER_CLEANUP_CHANGED");
  assert.equal(v.f.sqlite.prepare("SELECT COUNT(*) AS n FROM device_access WHERE device_id=?").get(target).n,1);
 }finally{v.f.close();}
});
test("manager browser flow uses signed proof; no deletion from preview or untrusted user roles",()=>{
 const route=readFileSync(new URL("../app/api/manager/roster-cleanup/route.ts",import.meta.url),"utf8");
 const core=readFileSync(new URL("../app/manager-roster-cleanup.server.ts",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../app/manager-roster-cleanup.tsx",import.meta.url),"utf8");
 const workspace=readFileSync(new URL("../app/manager-workspace.tsx",import.meta.url),"utf8");
 assert.match(route,/verifyDeviceRequest\(input,false\)/);
 assert.match(core,/requireManager\(actor\)/);
 assert.match(core,/service\.authorize\(await runtime\.accountCookieToken\(\)\)/);
 assert.match(core,/service\.capability\(principal,"manager\.manage\.assigned"\)/);
 assert.match(core,/INSERT INTO account_audit/);
 assert.match(core,/NOT \$\{protectedData\}/);
 assert.doesNotMatch(core,/DELETE FROM accounts|DELETE FROM account_audit/);
 assert.match(ui,/confirmation!=="XOA HO SO CU"/);
 assert.match(ui,/window\.confirm\(/);
 assert.match(ui,/MAX=10/);
 assert.match(workspace,/Thanh lọc hồ sơ cũ/);
 assert.match(workspace,/onInspectCleanup=/);
});
