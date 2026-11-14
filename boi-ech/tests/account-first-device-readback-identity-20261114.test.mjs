import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=(name)=>readFileSync(new URL("../app/"+name,import.meta.url),"utf8");
const route=read("api/device/route.ts");
const workspace=read("account-workspace-bootstrap.tsx");
const runtime=read("account-runtime.server.ts");
const core=read("device-auth.server.ts");
// Exercise the ACTUAL production route helper rather than a copied test helper.
const parsed=ts.createSourceFile("api/device/route.ts",route,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
const declaration=parsed.statements.find(node=>ts.isFunctionDeclaration(node)
  &&node.name?.text==="preserveAccountDeviceReadback");
assert.ok(declaration,"registered route must contain the readback identity fix");
const transpiled=ts.transpileModule(declaration.getText(parsed),{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText;
const preserveAccountDeviceReadback=new Function(transpiled+"\nreturn preserveAccountDeviceReadback;")();

const id="a".repeat(64), accountId="acc_"+"b".repeat(64);
const server={
  deviceId:id,accountId,personRole:"teacher",registrationComplete:true,
  status:"approved",deviceCode:"BE-01",accessExpiresAt:null,
  accessExpired:false,accessExpiringSoon:false,accessDaysRemaining:null,
};
const raw={
  ...server,accountId:undefined,
  accessExpiresAt:"2025-01-01T00:00:00.000Z",
  accessExpired:true,accessExpiringSoon:false,accessDaysRemaining:0,
  platform:"Windows",browser:"Chrome",
};

test("regression: both Học viên and Giảng viên keep cookie-authorized accountId after D1 metadata refresh",()=>{
 for(const role of ["learner","teacher"]){
   const actual=preserveAccountDeviceReadback({...server,personRole:role},{...raw,personRole:role});
   assert.equal(actual.accountId,accountId);
   assert.equal(actual.deviceId,id);
   assert.equal(actual.personRole,role);
   assert.equal(actual.registrationComplete,true);
   assert.equal(actual.platform,"Windows");
   assert.equal(actual.browser,"Chrome");
   assert.equal(actual.accessExpired,false,"V2 entitlement was already authorized");
   assert.equal(actual.accessExpiresAt,null);
 }
});
test("a fresh D1 blocked or incomplete device NEVER becomes approved through identity merging",()=>{
 const blocked=preserveAccountDeviceReadback(server,{...raw,status:"blocked",registrationComplete:false});
 assert.equal(blocked.accountId,accountId);
 assert.equal(blocked.status,"blocked");
 assert.equal(blocked.registrationComplete,false);
 assert.equal(blocked.accessExpired,false,"expiry comes from authorized V2, not legacy D1");
});
test("without an authenticated account the old legacy register/presence contract stays untouched",()=>{
 const legacy={...server,accountId:undefined};
 const result=preserveAccountDeviceReadback(legacy,{...raw,accountId:undefined});
 assert.equal(result.accountId,undefined);
 assert.equal(result.accessExpired,true);
 assert.equal(result.accessExpiresAt,"2025-01-01T00:00:00.000Z");
});
test("a mismatched metadata row fails closed, never transfers identity across devices",()=>{
 assert.throws(()=>preserveAccountDeviceReadback(server,{...raw,deviceId:"c".repeat(64)}),
   /DEVICE_READBACK_IDENTITY_MISMATCH/);
});
test("missing D1 readback returns existing server-validated identity without inventing fields",()=>{
 assert.strictEqual(preserveAccountDeviceReadback(server,null),server);
});
test("both /api/device register and presence preserve authorized data after fresh D1 read",()=>{
 assert.match(route,/function preserveAccountDeviceReadback\(/);
 assert.equal((route.match(/device = preserveAccountDeviceReadback\(device, await getPublicDeviceState\(device.deviceId\)/g)||[]).length,2);
 assert.doesNotMatch(route,/device = \(await getPublicDeviceState\(device.deviceId\).catch/);
 assert.match(route,/let device = await registerDevice\(/);
 assert.match(route,/let device = await verifyDeviceIdentityRequest\(payload, standalone\)/);
});
test("client still rejects wrong accounts, role, blocked or incomplete server device",()=>{
 assert.match(workspace,/device.accountId!==accountId\|\|device.deviceId!==storageDeviceId/);
 assert.match(workspace,/device.personRole!==role\|\|device.status!=="approved"\|\|!device.registrationComplete/);
 assert.match(runtime,/const actor = config.v2 \? await service.authorize\(token\)/);
 assert.match(core,/const account = await \(await import\("\.\/account-runtime.server"\)\)\.resolveAccountDevice\(\)/);
 assert.match(core,/if \(account\) return account/);
});
