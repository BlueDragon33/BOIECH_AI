import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accountStack } from "./helpers/account-stack.mjs";

const gate = readFileSync(new URL("../app/account-gate.tsx", import.meta.url), "utf8");
const owner = { kind: "owner", actor: "owner@fixture.invalid" };
const password = n => "Local-only unique passphrase " + n;
const managerProfile = {
  familyName: "Quan ly", givenName: "Kiem duyet",
  facultyUnit: "Trung tam", jobTitle: "Giao vien",
  jobPosition: "Quan ly", expectedRevision: 1,
};
function learnerProfile(n) {
  return { familyName: "Hoc vien", givenName: "Da khai",
    className: "Lop " + n, phone: "090" + String(n).padStart(7, "0"), expectedRevision: 1 };
}
async function publicKey() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign","verify"]);
  return crypto.subtle.exportKey("jwk", pair.publicKey);
}
async function accountState(f, token) {
  f.setCookie(token);
  const response = await f.get("api/accounts/route.ts");
  assert.equal(response.status, 200);
  return (await response.json()).account;
}

test("P1 real account path: register, pending, prefilled profile, one human review and activation", async () => {
  const f = accountStack({ v2: true, singleReview: true });
  try {
    const manager = await f.register(31001, "manager");
    const mId = manager.account.accountId;
    let state = await accountState(f, manager.token);
    assert.equal(state.status, "pending");
    assert.equal(state.onboardingStage, "requested");
    assert.equal(state.entitlementActive, false);
    await assert.rejects(() => f.service.authorize(manager.token),
      e => e.code === "ACCOUNT_ONBOARDING_REQUIRED");

    await f.flow.saveProfileDraft(manager.token, managerProfile);
    await f.flow.firstReview(owner, mId, 1);
    state = await accountState(f, manager.token);
    assert.equal(state.onboardingStage, "profile_required");
    assert.equal(state.profileDraftReady, true);
    assert.equal(state.entitlementActive, false, "human review does not itself grant app access");
    await f.flow.activateProfileDraft(manager.token);
    state = await accountState(f, manager.token);
    assert.equal(state.status, "approved");
    assert.equal(state.onboardingStage, "active");
    assert.equal(state.entitlementActive, true);

    const learner = await f.register(31002, "learner");
    const lId = learner.account.accountId;
    await f.flow.saveProfileDraft(learner.token, learnerProfile(31002));
    state = await accountState(f, learner.token);
    assert.equal(state.onboardingStage, "requested");
    assert.equal(state.profileDraftReady, true);
    assert.equal(state.entitlementActive, false);
    await f.flow.firstReview({ kind: "manager", token: manager.token }, lId, 1);
    state = await accountState(f, learner.token);
    assert.equal(state.onboardingStage, "profile_required");
    assert.equal(state.profileDraftReady, true);
    assert.equal(state.entitlementActive, false);
    await f.flow.activateProfileDraft(learner.token);
    state = await accountState(f, learner.token);
    assert.equal(state.onboardingStage, "active");
    assert.equal(state.entitlementActive, true);
    assert.equal((await f.service.authorize(learner.token)).accountId, lId);

    const grants = f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_audit WHERE action='account.review.first' AND target=?").get(lId);
    assert.equal(grants.n, 1, "a single authorized review, never hidden extra approval");
  } finally { f.close(); }
});

test("P1 new browser login cannot bypass trusted-device approval or read canonical learner profile", async () => {
  const f = accountStack({ v2: true, singleReview: true });
  try {
    const manager = await f.register(31011, "manager");
    await f.flow.firstReview(owner, manager.account.accountId, 1);
    await f.flow.submitProfile(manager.token, { ...managerProfile, expectedRevision: 2 });
    const learner = await f.register(31012, "learner");
    await f.flow.firstReview({ kind: "manager", token: manager.token }, learner.account.accountId, 1);
    await f.flow.submitProfile(learner.token, { ...learnerProfile(31012), expectedRevision: 2 });

    const remote = await f.service.login({
      login: "fixture31012", password: password(31012), publicKey: await publicKey(),
    }, "second-browser");
    let remoteView = await accountState(f, remote.token);
    assert.equal(remoteView.deviceApproved, false);
    assert.equal(remoteView.storageDeviceId, null);
    assert.equal(remoteView.name, null);
    await assert.rejects(() => f.service.authorize(remote.token),
      e => e.code === "DEVICE_APPROVAL_REQUIRED");
    await assert.rejects(() => f.service.approveDevice(remote.token, remote.deviceId, password(31012), "untrusted"),
      e => e.code === "DEVICE_APPROVAL_REQUIRED");

    await f.service.approveDevice(learner.token, remote.deviceId, password(31012), "original-browser");
    remoteView = await accountState(f, remote.token);
    assert.equal(remoteView.deviceApproved, true);
    assert.equal(remoteView.onboardingStage, "active");
    assert.equal(remoteView.entitlementActive, true);
    assert.equal((await f.service.authorize(remote.token)).accountId, learner.account.accountId);
    await f.service.revokeDevice(learner.token, remote.deviceId);
    await assert.rejects(() => f.service.session(remote.token),
      e => e.code === "SESSION_INVALID");
  } finally { f.close(); }
});

test("P1 pending-account polling still uses 20 seconds and never treats client state as approval", () => {
  assert.match(gate, /needsApprovalPolling \? 20000 : 60000/);
  assert.match(gate, /document\.hidden \|\| lock\.current \|\| refreshInFlight\.current/);
  assert.match(gate, /account\.onboardingStage!=="active"/);
  assert.match(gate, /account\.deviceApproved===false/);
  assert.match(gate, /account\.entitlementActive===false/);
  assert.match(gate, /action:"profile-draft-activate"/);
  assert.match(gate, /accountServerActive\(account, v2, observedNow\)/);
  const contract=readFileSync(new URL("../app/account-lifecycle-client.ts",import.meta.url),"utf8");
  assert.match(contract, /account\.status !== "approved"/);
  assert.match(contract, /account\.entitlementActive === true/);
});
