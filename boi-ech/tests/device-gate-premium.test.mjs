import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const account = readFileSync(new URL("../app/account-gate.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/device-gate-premium.css", import.meta.url), "utf8");
const deviceRoute = readFileSync(new URL("../app/api/device/route.ts", import.meta.url), "utf8");

test("P-256 initialization must fail closed without WebCrypto", () => {
  const init = page.slice(page.indexOf("async function getOrCreateDeviceCredential()"),
    page.indexOf("function legacyDeviceToken()"));
  assert.match(init, /typeof crypto === "undefined" \|\| !crypto\.subtle/);
  assert.match(init, /WEBCRYPTO_REQUIRED/);
  assert.match(init, /DEVICE_PRIVATE_KEY_REQUIRED/);
  assert.doesNotMatch(init, /publicKey:\s*\{\s*kty:\s*"EC"/);
});

test("signed device proof is real ECDSA, never synthetic random bytes", () => {
  const proof = page.slice(page.indexOf("async function signedDeviceProof("),
    page.indexOf("type SignedDeviceProof"));
  assert.match(proof, /!credential\.privateKey/);
  assert.match(proof, /crypto\.subtle\.sign/);
  assert.doesNotMatch(proof, /crypto\.getRandomValues\(new Uint8Array\(64\)\)/);
});

test("device requests have a bounded abort deadline including response JSON", () => {
  assert.match(page, /async function deviceRequest\(/);
  assert.match(page, /const controller = new AbortController\(\)/);
  assert.match(page, /return await parseDeviceResponse\(response\)/);
  assert.match(page, /controller\.abort\(\)/);
  assert.match(page, /DEVICE_TIMEOUT/);
  assert.match(page, /window\.clearTimeout\(timeout\)/);
  assert.equal((page.match(/deviceRequest\("\/api\/device"/g) ?? []).length, 4);
});

test("device error responses are explicit and do not authorize", () => {
  assert.match(page, /DEVICE_INVALID_RESPONSE/);
  assert.match(page, /DEVICE_NETWORK_ERROR/);
  assert.match(page, /if \(!response\.ok\) throw new CourseApiError/);
});

test("IndexedDB open handles blocked and timed-out upgrades without deleting data", () => {
  const init = page.slice(page.indexOf("function openDb()"), page.indexOf("type CachedLesson"));
  assert.match(init, /request\.onblocked/);
  assert.match(init, /10000/);
  assert.match(init, /request\.result\.close\(\)/);
  assert.doesNotMatch(init, /deleteDatabase|\.clear\(/);
});

test("the retry action reopens device identity initialization after a failure", () => {
  const retry = page.slice(page.indexOf("async function refreshDeviceAccess()"),
    page.indexOf("async function submitDeviceRegistration("));
  assert.match(retry, /deviceCredential \?\? await getOrCreateDeviceCredential\(\)/);
  assert.match(retry, /setDeviceChecking\(false\)/);
  assert.doesNotMatch(retry, /if \(!deviceCredential\) return/);
});

test("device polling skips hidden tabs and overlapping requests", () => {
  assert.match(page, /if \(document\.hidden \|\| !navigator\.onLine \|\| inFlight\) return/);
  assert.match(page, /20_000/);
  assert.match(page, /access\.status === "approved" && access\.registrationComplete && !access\.accessExpired/);
});

test("premium three-step status journey never implies access before approval", () => {
  assert.match(page, /device-gate-premium-steps/);
  for (const title of ["Nhận diện thiết bị", "Kiểm tra quyền truy cập", "Mở không gian làm việc"]) {
    assert.ok(page.includes(title), "Missing: " + title);
  }
  assert.match(page, /readyToLearn \? "Máy chủ đã xác nhận quyền"/);
  assert.match(page, /readyToLearn \? "Đã sẵn sàng truy cập"/);
  assert.match(page, /Xem thử chế độ Cán bộ quản lý \(chỉ xem, không tác động dữ liệu thực\)/);
});

test("layout still routes through AccountGate and loads the new skin", () => {
  assert.match(layout, /import AccountGate from "\.\/account-gate"/);
  assert.match(layout, /import "\.\/device-gate-premium\.css"/);
  assert.match(page, /className="device-gate device-gate-premium"/);
});

test("premium UI is responsive, keyboard accessible and reduced-motion safe", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /device-gate-premium-step\.is-problem/);
});

test("Account-first login, session poll and profile conflict readback are bounded", () => {
  assert.match(account, /async function accountReadWithinDeadline/);
  assert.match(account, /const data = await readAccountPayload\(response\)/);
  assert.match(account, /controller\.abort\(\)/);
  assert.match(account, /window\.clearTimeout\(timeout\)/);
  assert.equal((account.match(/accountReadWithinDeadline<\{/g) ?? []).length, 3);
  assert.doesNotMatch(account, /await fetch\("\/api\/accounts"/);
});

test("recovered server session clears stale transport errors", () => {
  assert.ok(account.includes('setDevices(data.devices ?? []); setReady(true); setError("");'));
});

test("backend device registration and presence still independently verify identity", () => {
  assert.match(deviceRoute, /verifyDeviceIdentityRequest/);
  assert.match(deviceRoute, /getPublicDeviceState/);
});
