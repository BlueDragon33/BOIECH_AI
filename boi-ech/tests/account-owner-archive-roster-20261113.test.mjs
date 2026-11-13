import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {accountStack} from "./helpers/account-stack.mjs";

const owner={role:"owner",actor:"owner@fixture.invalid"};
async function key(){
 const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 return crypto.subtle.exportKey("jwk",pair.publicKey);
}
async function manager(f,n){
 const invite=await f.service.issueManagerInvite(owner,1);
 return f.service.registerManagerWithInvite({role:"manager",login:"archive-manager-"+n,
  password:"Unique local-only manager password "+n,contactType:"email",
  contactValue:"archive"+n+"@fixture.invalid",managerInviteToken:invite.inviteToken,
  privacyAccepted:true,securityAnswer:"Synthetic answer only",publicKey:await key()},"peer-"+n);
}

test("Owner roster exposes server registration time, last activity and live session count",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const registered=await manager(f,1);
  const item=(await f.service.ownerManagerPage("",40)).managers.find(a=>a.accountId===registered.account.accountId);
  assert.ok(item);
  assert.match(item.createdAt,/^\d{4}-\d\d-\d\d/);
  assert.equal(typeof item.lastSeenAt,"string");
  assert.ok(Number.isInteger(item.activeSessions)&&item.activeSessions>=0);
  assert.equal(item.status,"pending");
 }finally{f.close();}
});
test("Owner soft-archive requires exact CAS, typed account ID and purpose; revokes sessions without deleting history",async()=>{
 const f=accountStack({v2:true,singleReview:true});try{
  const registered=await manager(f,2),id=registered.account.accountId;
  const before=await f.service.ownerRead(id);
  const cmd={accountId:id,expectedRevision:before.revision,confirmation:id,
    reason:"Owner manually retired an obsolete manager intake"};
  await assert.rejects(()=>f.service.archiveManager({role:"publisher",actor:"viewer"},cmd),e=>e.code==="OWNER_REQUIRED");
  await assert.rejects(()=>f.service.archiveManager(owner,{...cmd,confirmation:"not-the-id"}),e=>e.code==="ACCOUNT_INPUT");
  await assert.rejects(()=>f.service.archiveManager(owner,{...cmd,expectedRevision:before.revision+1}),e=>e.code==="ACCOUNT_CAS_CONFLICT");
  const archived=await f.service.archiveManager(owner,cmd);
  assert.equal(archived.verified,true);
  assert.equal(archived.status,"blocked");
  assert.equal(archived.retainedHistory,true);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM accounts WHERE account_id=?").get(id).n,1);
  assert.equal(f.sqlite.prepare("SELECT status,management_enabled FROM device_access WHERE device_id=?").get(registered.account.storageDeviceId).status,"blocked");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_sessions WHERE account_id=? AND revoked=0").get(id).n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_devices WHERE account_id=? AND revoked=0").get(id).n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit WHERE action='owner.manager.archive' AND target=?").get(id).n,1);
  await assert.rejects(()=>f.service.archiveManager(owner,cmd),e=>e.code==="ACCOUNT_ALREADY_BLOCKED");
 }finally{f.close();}
});
test("Archive is never automatic; control route requires privileged owner and exact explicit command",()=>{
 const core=readFileSync(new URL("../app/account-core.server.ts",import.meta.url),"utf8");
 const route=readFileSync(new URL("../app/api/control/accounts/route.ts",import.meta.url),"utf8");
 assert.match(core,/input\.confirmation!==id/);
 assert.match(core,/reason\.trim\(\)\.length<10/);
 assert.match(core,/UPDATE account_sessions SET revoked=1/);
 assert.match(core,/INSERT INTO account_audit\(actor,action,target,purpose\)/);
 assert.match(route,/input\.action === "archive-manager"/);
 assert.match(route,/requireControlService\(request, "account-owner"\)/);
});
