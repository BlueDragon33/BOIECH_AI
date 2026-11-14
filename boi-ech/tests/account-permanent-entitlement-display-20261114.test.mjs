import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const ts=require("typescript");
const raw=readFileSync(new URL("../app/account-term.ts",import.meta.url),"utf8");
const transpiled=ts.transpileModule(raw,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const moduleInstance={exports:{}};
new Function("module","exports",transpiled)(moduleInstance,moduleInstance.exports);
const {FOREVER_EXPIRES_AT,isUnlimitedAccountExpiry,replaceExpiryFromNow}=moduleInstance.exports;
const gate=readFileSync(new URL("../app/account-gate.tsx",import.meta.url),"utf8");

test("Canonical permanent D1 entitlement is rendered as unlimited",()=>{
 assert.equal(FOREVER_EXPIRES_AT,"9999-12-31T23:59:59.000Z");
 assert.equal(isUnlimitedAccountExpiry(FOREVER_EXPIRES_AT),true);
 assert.equal(replaceExpiryFromNow("forever",Date.UTC(2026,10,14)),FOREVER_EXPIRES_AT);
});
test("Temporary and long-dated entitlements never falsely display unlimited",()=>{
 for(const expiry of [null,undefined,"", "2100-01-01T00:00:00.000Z",
   "9999-12-31T23:59:58.000Z","2026-12-14T00:00:00.000Z"]){
  assert.equal(isUnlimitedAccountExpiry(expiry),false,String(expiry));
 }
 const now=Date.UTC(2026,10,14);
 for(const term of ["7d","30d","6m","1y","4y"]){
  const date=replaceExpiryFromNow(term,now);
  assert.ok(Date.parse(date)>now,term);
  assert.equal(isUnlimitedAccountExpiry(date),false,term);
 }
});
test("Header countdown never formats permanent entitlement as 2.9m days or an expiry in year 9999",()=>{
 assert.match(gate,/const unlimited=isUnlimitedAccountExpiry\(expiresAt\);/);
 assert.match(gate,/if\(unlimited\)return; \/\/ Permanent grants do not need a ticking countdown/);
 assert.match(gate,/data-expiring=\{!unlimited&&ms<=86400000\}/);
 assert.match(gate,/aria-label=\{unlimited\?"Thời hạn sử dụng: Không giới hạn"/);
 assert.match(gate,/<output aria-live="off">\{unlimited\?"Không giới hạn"/);
 assert.match(gate,/\{unlimited\?"Quyền sử dụng vĩnh viễn"/);
 assert.match(gate,/const expiry=unlimited\?null:/);
});
test("My profile shows Không giới hạn for permanent accounts and still formats normal dates",()=>{
 assert.match(gate,/isUnlimitedAccountExpiry\(account\?\.expiresAt\)\?"Không giới hạn":account\?\.expiresAt\?/);
 assert.match(gate,/Intl.DateTimeFormat\("vi-VN",\{dateStyle:"medium"\}\)\.format\(new Date\(account.expiresAt\)\)/);
});
