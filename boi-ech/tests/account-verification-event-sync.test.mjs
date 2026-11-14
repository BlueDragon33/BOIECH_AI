import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../app/" + p, import.meta.url), "utf8");
const gate = read("account-gate.tsx");
const ceremony = read("account-verification-showcase.tsx");
const skin = read("account-verification-showcase.module.css");
const page = read("page.tsx");
const sync = read("verified-sync-client.ts");
const agent = read("conditional-sync-agent.tsx");
const settings = read("verified-sync-settings.tsx");
const storage = read("multi-account-switcher.tsx");

test("initial account check renders the showcase instead of the old checking-session card", () => {
  assert.match(gate, /if \(!ready\) return <AccountVerificationShowcase phase="checking"/);
  assert.match(gate, /if \(active && account && enteredAccountId !== account\.accountId\)/);
  assert.match(gate, /accountServerActive\(account, v2, Date\.now\(\)\)/);
  assert.match(gate, /setEnteredAccountId\(account\.accountId\)/);
});

test("automatic GO appears after READY, displays 1 second, and enters without click", () => {
  assert.match(ceremony, /schedule\(\(\) => setStage\(4\), 4950\)/);
  assert.match(ceremony, /schedule\(\(\) => setStage\(5\), 6100\)/);
  assert.match(ceremony, /schedule\(\(\) => goRef\.current\(\), 7100\)/);
  assert.match(ceremony, /schedule\(\(\) => setStage\(5\), 500\)/);
  assert.match(ceremony, /schedule\(\(\) => goRef\.current\(\), 1500\)/);
  assert.match(ceremony, /isGo \? "GO" : "READY"/);
  assert.doesNotMatch(ceremony, /onClick=\{onGo\}/);
});

test("ceremony never advances when server has not verified access or errors exist", () => {
  assert.match(ceremony, /if \(phase !== "verified" \|\| error\) return/);
  assert.match(ceremony, /const done = phase === "verified"/);
  assert.match(ceremony, /phase === "verified" && stage >= 4 && !error/);
  assert.match(ceremony, /role="alert"/);
  assert.match(ceremony, /onClick=\{onRetry\}/);
});

test("verification and auto-entry remain accessible to reduced-motion users", () => {
  assert.match(ceremony, /prefers-reduced-motion: reduce/);
  assert.match(skin, /prefers-reduced-motion:reduce/);
  assert.match(skin, /:focus-visible/);
  assert.match(skin, /@media\(max-width:550px\)/);
  assert.match(skin, /color:#fff/);
});

test("account server refresh is event-driven with no time-based background GET", () => {
  assert.doesNotMatch(gate, /needsApprovalPolling \? 20000 : 60000/);
  assert.doesNotMatch(gate, /window\.setInterval\(\(\) => \{ if\(mounted\.current\)/);
  for (const signal of ['"focus"', '"pageshow"', '"online"', '"boi:account:changed"']) {
    assert.ok(gate.includes('window.addEventListener(' + signal), "missing event: " + signal);
  }
  assert.match(gate, /navigator\.serviceWorker\?\.addEventListener\("message",onRemoteNotification\)/);
  assert.match(gate, /queuedAfterCurrent = true/);
});

test("pending device approval and presence send only on real changes/resume", () => {
  assert.match(page, /No periodic device-status polling/);
  assert.match(page, /window\.addEventListener\("boi:device:changed",sync\)/);
  assert.match(page, /navigator\.serviceWorker\?\.addEventListener\("message",onPush\)/);
  assert.doesNotMatch(page, /window\.setInterval\(sendPresence, 60_000\)/);
  assert.match(page, /if \(Date\.now\(\) - lastPresenceAt < 10_000\) return/);
});

test("data queue emits only after durable write, never on a synthetic timer", () => {
  const fn = sync.slice(sync.indexOf("export async function queueVerifiedSync("),
    sync.indexOf("export async function readPendingSync("));
  assert.match(fn, /await writeLocal\(accountId,event\)/);
  assert.match(fn, /window\.dispatchEvent\(new CustomEvent\("boi:sync:queued"/);
  assert.match(fn, /new BroadcastChannel\("boiech-verified-sync"\)/);
  assert.doesNotMatch(fn, /setInterval/);
});

test("automatic sync is account-bound, scope-consented, and conflict-safe", () => {
  assert.match(agent, /pending\.length === 0/);
  assert.match(agent, /method: "POST", cache: "no-store", credentials: "same-origin"/);
  assert.match(agent, /if \(grant\.enabled === 1/);
  assert.match(agent, /flushVerifiedSync\(accountId, undefined, allowedScopes\)/);
  assert.match(sync, /if\(allowedScopes&&!allowedScopes\.has\(event\.scope\)\)continue/);
  assert.match(sync, /status:"conflict"/);
  assert.match(sync, /if\(!ack\?\.acknowledged/);
  assert.match(gate, /<ConditionalSyncAgent accountId=\{account\.accountId\}/);
  assert.doesNotMatch(agent, /setInterval/);
});

test("manual controls remain and consent changes cause real-event sync", () => {
  assert.match(settings, /Đồng bộ ngay dữ liệu đang chờ/);
  assert.match(settings, /boi:sync:grant-changed/);
  assert.match(settings, /boi:sync:completed/);
  assert.match(agent, /window\.addEventListener\("boi:sync:grant-changed"/);
  assert.match(agent, /window\.addEventListener\("online", onResume\)/);
});

test("blocked local account databases terminate without clearing private keys", () => {
  assert.match(storage, /request\.onblocked/);
  assert.match(storage, /10000/);
  assert.match(storage, /request\.result\.close\(\)/);
  const openPart = storage.slice(storage.indexOf("function openAccountDb("),
    storage.indexOf("function requestValue"));
  assert.doesNotMatch(openPart, /deleteDatabase|\.clear\(/);
});
