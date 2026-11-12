import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const helperSource=fs.readFileSync(new URL("../app/account-lifecycle-client.ts",import.meta.url),"utf8");
const gateSource=fs.readFileSync(new URL("../app/account-gate.tsx",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../app/account-gate.module.css",import.meta.url),"utf8");
const compiled=ts.transpileModule(helperSource,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText;
const exports={};
new Function("exports",compiled)(exports);
const {accountServerActive,shouldAutoResumeDocument,recoveryMustRemainVisible}=exports;

const pending={accountId:"acc_"+("a".repeat(64)),status:"pending",onboardingStage:"requested",
 deviceApproved:true,entitlementActive:false,expiresAt:null};
const active={...pending,status:"approved",onboardingStage:"active",
 deviceApproved:true,entitlementActive:true};

test("only server-verified status + trusted device + active onboarding + entitlement grants V2 UI",()=>{
 assert.equal(accountServerActive(pending,true,Date.now()),false);
 assert.equal(accountServerActive({...active,deviceApproved:false},true,Date.now()),false);
 assert.equal(accountServerActive({...active,entitlementActive:false},true,Date.now()),false);
 assert.equal(accountServerActive({...active,onboardingStage:"profile_required"},true,Date.now()),false);
 assert.equal(accountServerActive({...active,status:"blocked"},true,Date.now()),false);
 assert.equal(accountServerActive({...active,expiresAt:"2000-01-01T00:00:00Z"},true,Date.now()),false);
 assert.equal(accountServerActive({...active,expiresAt:"broken"},true,Date.now()),false);
 assert.equal(accountServerActive(active,true,Date.now()),true);
 assert.equal(accountServerActive(active,false,Date.now()),true);
});

test("auto resume happens exactly on same-account pending-to-active transition, not on blocked or login events",()=>{
 const id=active.accountId;
 assert.equal(shouldAutoResumeDocument({accountId:id,active:false},{accountId:id,active:true}),true);
 assert.equal(shouldAutoResumeDocument(null,{accountId:id,active:true}),false);
 assert.equal(shouldAutoResumeDocument({accountId:"",active:false},{accountId:id,active:true}),false);
 assert.equal(shouldAutoResumeDocument({accountId:id,active:true},{accountId:id,active:true}),false);
 assert.equal(shouldAutoResumeDocument({accountId:id,active:false},{accountId:id,active:false}),false);
 assert.equal(shouldAutoResumeDocument({accountId:id,active:false},{accountId:"another",active:true}),false);
});

test("a one-time recovery code cannot blank the whole app or be erased by auto reload",()=>{
 assert.equal(recoveryMustRemainVisible(true,"single-use-token"),true);
 assert.equal(recoveryMustRemainVisible(false,"single-use-token"),false);
 assert.equal(recoveryMustRemainVisible(true,""),false);
 assert.match(gateSource,/ready && active && account \? <div key=\{account\.accountId\}>\{children\}<\/div>/);
 assert.doesNotMatch(gateSource,/ready && active && !recovery && account \?/);
 assert.match(gateSource,/recoveryMustRemainVisible\(active,recovery\)/);
 assert.match(gateSource,/activationNeedsDocumentBootstrap\.current !== account\.accountId \|\| recovery/);
 assert.match(gateSource,/window\.location\.reload\(\)/);
 assert.match(gateSource,/Mã này chỉ hiển thị một lần/);
 assert.match(css,/\.activeRecovery\{/);
 assert.match(css,/@media\(max-width:600px\)/);
});

test("approval polling at 20s and automatic draft activation still work without extra clicks",()=>{
 assert.match(gateSource,/needsApprovalPolling \? 20000 : 60000/);
 assert.match(gateSource,/account\.onboardingStage==="profile_required"/);
 assert.match(gateSource,/account\.profileDraftReady!==true/);
 assert.match(gateSource,/action:"profile-draft-activate"/);
 assert.match(gateSource,/shouldAutoResumeDocument\(observedLifecycle\.current,nextLifecycle\)/);
 assert.match(gateSource,/readbackId !== readbackGeneration\.current/);
 assert.match(gateSource,/activationNeedsDocumentBootstrap\.current = null/);
});

test("profile submitted during manager approval retries once against readback and never registers again",()=>{
 assert.match(gateSource,/code!=="ACCOUNT_CAS_CONFLICT"/);
 assert.match(gateSource,/fresh\.account\?\.accountId!==account\?\.accountId/);
 assert.match(gateSource,/fresh\.account\.deviceApproved!==true/);
 assert.match(gateSource,/stage==="requested"\?"profile-draft-save":"submit-profile"/);
 assert.match(gateSource,/expectedRevision:fresh\.account\.onboardingRevision/);
 assert.doesNotMatch(gateSource,/action:"register".*expectedRevision:fresh/);
});
test("post-approval helper and UI source parse under real TypeScript compiler",()=>{
 for(const [name,source,kind] of [
  ["account-lifecycle-client.ts",helperSource,ts.ScriptKind.TS],
  ["account-gate.tsx",gateSource,ts.ScriptKind.TSX]
 ]){const parsed=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,kind);
   assert.equal(parsed.parseDiagnostics.length,0,name+": "+parsed.parseDiagnostics.map(x=>x.messageText).join(" | "));}
});
