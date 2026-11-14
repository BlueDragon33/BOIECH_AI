import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../app/" + p, import.meta.url), "utf8");
const gate=read("account-gate.tsx");
const ceremony=read("account-verification-showcase.tsx");
const skin=read("account-verification-showcase.module.css");
const manager=read("manager-workspace.tsx");
const training=read("training-client.ts");
const agent=read("conditional-sync-agent.tsx");
const settings=read("verified-sync-settings.tsx");
const notice=read("manual-sync-notices.ts");
const storage=read("multi-account-switcher.tsx");
const sync=read("verified-sync-client.ts");
const page=read("page.tsx");

test("checking screen starts during real session readback; display never grants access",()=>{
 assert.match(gate,/if \(!ready\) return <AccountVerificationShowcase phase="checking" checks=\{\[false,false,false\]\}/);
 assert.match(gate,/if \(active && account && enteredAccountId !== account.accountId\)/);
 assert.match(gate,/accountServerActive\(account, v2, Date.now\(\)\)/);
 assert.match(gate,/if \(accountServerActive\(account, v2, Date.now\(\)\) && workspaceVerified && deviceVerified\)/);
 assert.match(gate,/setEnteredAccountId\(account.accountId\)/);
});
test("three real checks gate visual transitions; GO appears centrally for exactly 1 second",()=>{
 assert.match(ceremony,/checks\?: readonly \[boolean, boolean, boolean\]/);
 assert.match(ceremony,/const \[sessionOk, accessOk, workspaceOk\] = approved/);
 assert.match(ceremony,/const allVerified = phase === "verified" && sessionOk && accessOk && workspaceOk && !error/);
 assert.match(ceremony,/const realCheckPassed = \[sessionOk, accessOk, workspaceOk\]\[stage\]/);
 assert.match(ceremony,/if \(realCheckPassed\) timer = window.setTimeout/);
 assert.match(ceremony,/stage === 3/);
 assert.match(ceremony,/stage === 4/);
 assert.match(ceremony,/stage === 5/);
 assert.match(ceremony,/window.setTimeout\(\(\) => goRef.current\(\), 1000\)/);
 assert.match(ceremony,/isGo \? "GO" : isReady \? "READY" : "CHECKING\.\.\."/);
 assert.doesNotMatch(ceremony,/onClick=\{onGo\}/);
 assert.doesNotMatch(ceremony,/className=\{styles.shield\}/);
});
test("manager first D1-backed board is loaded BEFORE READY and passed into the main screen",()=>{
 assert.match(gate,/createTrainingClient\(getManagerProof\).read\(range,controller.signal\)/);
 assert.match(gate,/setManagerPreload\(\{accountId:id,board,range\}\)/);
 assert.match(gate,/managerPreload\?\.accountId===account.accountId/);
 assert.match(gate,/checks=\{\[ready,active && deviceVerified,workspaceVerified\]\}/);
 assert.match(gate,/const workspaceVerified=managerVerified&&/);
 assert.match(gate,/initialBoard=\{managerPreload\?\.accountId===account.accountId\?managerPreload.board:undefined\}/);
 assert.match(manager,/useState<TrainingBoard\|null>\(initialBoard\?\?null\)/);
 assert.match(manager,/skipPreloadedRead.current/);
 assert.match(manager,/if\(skipPreloadedRead.current\)\{skipPreloadedRead.current=false;return;\}/);
 assert.match(training,/function initialTrainingWindow/);
});
test("when manager prefetch fails, no READY or GO and retry uses an actual server request",()=>{
 assert.match(gate,/setManagerPreloadError\(cause instanceof Error/);
 assert.match(gate,/error=\{roleBootstrapError\|\|managerPreloadError\|\|error\}/);
 assert.match(gate,/setManagerPreloadAttempt\(value=>value\+1\)/);
 assert.match(ceremony,/if \(error \|\| phase !== "verified"\) return/);
 assert.match(ceremony,/role="alert"/);
 assert.match(ceremony,/onClick=\{onRetry\}/);
});
test("the orbit rotates in CHECKING, pulses in READY and flashes GO",()=>{
 assert.match(ceremony,/data-mode=\{orbitState\}/);
 assert.match(skin,/boiOrbitForward/);
 assert.match(skin,/boiReadyPulse/);
 assert.match(skin,/boiGoFlash/);
 assert.match(skin,/boiGoWord/);
 assert.match(ceremony,/prefers-reduced-motion: reduce/);
 assert.match(skin,/prefers-reduced-motion:reduce/);
 assert.match(skin,/:focus-visible/);
});
test("account and device auth remain event-triggered without periodic read loops",()=>{
 assert.doesNotMatch(gate,/needsApprovalPolling \? 20000 : 60000/);
 assert.doesNotMatch(gate,/window.setInterval\(\(\) => \{ if\(mounted.current\)/);
 for(const signal of ['"focus"','"pageshow"','"online"','"boi:account:changed"']){
   assert.ok(gate.includes("window.addEventListener("+signal),"missing "+signal);
 }
 assert.match(page,/No periodic device-status polling/);
 assert.doesNotMatch(page,/window.setInterval\(sendPresence, 60_000\)/);
});
test("a durable queued event ONLY recounts local pending data; never sends network traffic",()=>{
 const queued=sync.slice(sync.indexOf("export async function queueVerifiedSync("),sync.indexOf("export async function readPendingSync("));
 assert.match(queued,/await writeLocal\(accountId,event\)/);
 assert.match(queued,/boi:sync:queued/);
 assert.match(agent,/readPendingSync\(accountId\)/);
 assert.match(agent,/boi:sync:queue-count/);
 assert.doesNotMatch(agent,/flushVerifiedSync|fetch\(|setInterval/);
 assert.doesNotMatch(agent,/boi:sync:grant-changed/);
});
test("manager sync bubble counts known local queue and received notices only",()=>{
 assert.match(manager,/useBoiSyncNotices/);
 assert.match(manager,/boi-manual-sync-badge/);
 assert.match(manager,/syncPending>0/);
 assert.match(manager,/onManualSync=\{\(\)=>void manualSync\(\)\}/);
 assert.match(manager,/const success=await refresh\(\)/);
 assert.match(manager,/if\(!success\)return/);
 assert.match(manager,/acknowledge\(observed\)/);
 assert.match(notice,/function read\(scope:string\)/);
 assert.match(notice,/sessionStorage.getItem/);
 assert.match(notice,/boi:manual-sync:acknowledged/);
 assert.doesNotMatch(notice,/setInterval|fetch\(/);
});
test("verified data flush is explicit and preserves conflict/ACK semantics",()=>{
 assert.match(settings,/onClick=\{\(\)=>void flush\(\)\}/);
 assert.match(settings,/pending>0\?<span className="boi-manual-sync-badge"/);
 assert.match(settings,/flushVerifiedSync\(accountId\)/);
 assert.match(sync,/status:"conflict"/);
 assert.match(sync,/if\(!ack\?\.acknowledged/);
 assert.match(gate,/<ConditionalSyncAgent accountId=\{account.accountId\}/);
 assert.match(storage,/request.onblocked/);
});
