import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const scope=read("app/account-scope.ts");
const gate=read("app/account-gate.tsx");
const portable=read("app/multi-account-switcher.tsx");
const lifecycle=read("app/account-lifecycle-client.ts");
const editor=read("app/bien-tap-noi-dung/editor-session-gate.tsx");

const exported={};
new Function("exports",ts.transpileModule(scope,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText)(exported);
const {accountTransitionNeedsReload,mayReusePreparedAccountScope}=exported;

test("F5 readback of the same account skips repeat IndexedDB writes but never skips first setup or legacy claim",()=>{
  const namespace="boi-ech-doc-lap:acc_"+"a".repeat(64);
  assert.equal(mayReusePreparedAccountScope(undefined,namespace,false),false);
  assert.equal(mayReusePreparedAccountScope("boi-ech-doc-lap:signed-out",namespace,false),false);
  assert.equal(mayReusePreparedAccountScope(namespace,namespace,false),true);
  assert.equal(mayReusePreparedAccountScope(namespace,namespace,true),false);
  assert.equal(mayReusePreparedAccountScope(namespace,namespace.replace(/a/g,"b"),false),false);
  assert.match(portable,/if \(mayReusePreparedAccountScope\(existingScope, requestedScope, claim\)\) return;/);
  assert.match(portable,/ACCOUNT_DOCUMENT_RELOAD_REQUIRED/);
  assert.match(portable,/await portableValue\("portable:initialized:" \+ accountId, true\)/);
  assert.match(portable,/tx\.objectStore\(DEVICE_STORE\)\.put\(credential, ACTIVE_KEY\)/);
  assert.match(portable,/dataset\.accountLocalDatabase = databaseName/);
});

test("P-256 credential databases are closed after reads/writes and never deleted by readback",()=>{
  for(const name of ["readActiveCredential","writeActiveCredential"]){
    const match=portable.match(new RegExp("async function "+name+"\\([^]*?\\n\\}"));
    assert.ok(match,name+" exists");
    assert.match(match[0],/finally \{[\s\S]*?db\.close\(\)/);
  }
  assert.match(portable,/finally \{ profileDb\.close\(\); \}/);
  const prepare=portable.slice(portable.indexOf("export async function preparePortableAccount"),portable.indexOf("export async function portableWorkspaceCredential"));
  assert.doesNotMatch(prepare,/deleteDatabase|clearAccountLocalState\(/);
});

test("subscription remains stable while approval/entitlement/role changes; async reads are guarded",()=>{
  assert.match(gate,/const waitingForApprovalRef = useRef\(waitingForApproval\)/);
  assert.match(gate,/waitingForApprovalRef\.current = waitingForApproval/);
  assert.match(gate,/if\(!waitingForApprovalRef\.current && !mediaPlaying/);
  assert.match(gate,/\}, \[enabled, bypass, reload\]\);/);
  assert.doesNotMatch(gate,/\}, \[enabled, bypass, reload, waitingForApproval\]\);/);
  assert.match(gate,/if \(refreshInFlight\.current\) \{ queuedAfterCurrent = true; return; \}/);
  assert.match(gate,/readbackId !== readbackGeneration\.current/);
  assert.match(gate,/lastLeaseRenewalAttemptAt\.current/);
});

test("manager cannot mount privileged board before fully verified session and board readback",()=>{
  assert.match(gate,/const managerDashboard=Boolean\(ready && active && v2 && account\?\.role==="manager"/);
  assert.match(gate,/enteredAccountId===account\.accountId/);
  assert.match(gate,/managerPreload\?\.accountId===account\.accountId && Boolean\(managerPreload\.board\)/);
  assert.match(gate,/managerPreload\?\.accountId===id && Boolean\(managerPreload\.board\)/);
  assert.match(gate,/createTrainingClient\(getManagerProof\)\.read\(range,controller\.signal\)/);
  assert.match(gate,/if \(active && account && enteredAccountId !== account\.accountId\)/);
});

test("no unverifiable session can resume, but transient errors do not delete cookies or signing keys",()=>{
  assert.match(lifecycle,/account\.status !== "approved"/);
  assert.match(lifecycle,/account\.onboardingStage === "active"/);
  assert.match(lifecycle,/account\.entitlementActive === true/);
  assert.match(gate,/resumeVerifiedSessionOnLoad\.current/);
  assert.match(gate,/roleBootstrap\?\.accountId===id && roleBootstrap\.role===account\.role/);
  assert.match(gate,/roleDeviceVerified\.device\.status==="approved"/);
  assert.match(gate,/readAccountPayload\(response\)/);
  assert.match(editor,/credentials: "same-origin"/);
  assert.match(editor,/EDITOR_SESSION_NETWORK/);
  const reload=gate.slice(gate.indexOf("const reload = useCallback"),gate.indexOf("useEffect(()=>{",gate.indexOf("const reload = useCallback")));
  assert.doesNotMatch(reload,/indexedDB\.deleteDatabase|localStorage\.clear|sessionStorage\.clear/);
  assert.equal(accountTransitionNeedsReload("account-A","account-B"),true);
  assert.equal(accountTransitionNeedsReload("account-A","account-A"),false);
  assert.equal(accountTransitionNeedsReload("account-A",""),true);
});

test("foreground study/edit/video activity renews bounded session without periodic background polling",()=>{
  const body=gate.slice(gate.indexOf("const keepAliveIfEngaged=async"),gate.indexOf("// Conditional sync:"));
  assert.match(body,/now-lastLeaseRenewalAttemptAt\.current<4\*60_000/);
  assert.match(body,/now-lastUserEngagementAt\.current>15\*60_000/);
  assert.match(body,/await send\(\{action:"keepalive"\}\)/);
  assert.match(body,/const engagement=\(\)=>\{/);
  assert.match(body,/if\(document\.hidden \|\| lock\.current\)return/);
  assert.match(body,/lastUserEngagementAt\.current=Date\.now\(\)/);
  assert.match(body,/void keepAliveIfEngaged\(\)/);
  assert.match(gate,/document\.addEventListener\("timeupdate",engagement,true\)/);
  assert.match(gate,/document\.removeEventListener\("timeupdate",engagement,true\)/);
  assert.match(gate,/window\.addEventListener\("pointerdown",engagement/);
  assert.match(gate,/window\.addEventListener\("keydown",engagement\)/);
  assert.doesNotMatch(gate,/setInterval\(\(\) => .*keepalive/);
  // The server alone enforces expiration/revocation and a 7-day hard cap.
  const core=read("app/account-core.server.ts");
  assert.match(core,/async keepAlive\(token: string\)/);
  assert.match(core,/issued_at_ms\+\?>\?/);
  assert.match(core,/revoked=0/);
});

test("all touched runtime modules remain parseable TypeScript/TSX",()=>{
  for(const [name,body,kind] of [
    ["account-scope.ts",scope,ts.ScriptKind.TS],
    ["account-gate.tsx",gate,ts.ScriptKind.TSX],
    ["multi-account-switcher.tsx",portable,ts.ScriptKind.TSX],
  ]){
    const ast=ts.createSourceFile(name,body,ts.ScriptTarget.Latest,true,kind);
    assert.equal(ast.parseDiagnostics.length,0,name+": "+ast.parseDiagnostics.map(x=>x.messageText).join(" | "));
  }
});
