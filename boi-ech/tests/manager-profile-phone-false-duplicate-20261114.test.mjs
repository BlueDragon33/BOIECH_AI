import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accountStack } from "./helpers/account-stack.mjs";

const owner = { role: "owner", actor: "owner@phone-fix.fixture.invalid" };
const professional = { familyName: "Nguyen Dinh", givenName: "Nam",
  facultyUnit: "Testing department", jobTitle: "Lecturer", jobPosition: "Section leader",
  expectedRevision: 1 };

async function manager(f, suffix, kind = "email") {
  const admission = f.sqlite.prepare(
    "SELECT revision FROM account_admission_limits WHERE person_role='manager'").get();
  const invite = await f.service.issueManagerInvite(owner, admission.revision);
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicKey = await crypto.subtle.exportKey("jwk", keys.publicKey);
  return f.service.registerManagerWithInvite({
    login: "phonefix" + suffix, role: "manager",
    password: "Private manager fixture password " + suffix,
    privacyAccepted: true, publicKey,
    contactType: kind, contactValue: kind === "email"
      ? "phonefix" + suffix + "@fixture.invalid"
      : "+7 (999) 234-55-66",
    managerInviteToken: invite.inviteToken,
  }, "phone-fix-test");
}

test("V3: two distinct email-first managers WITHOUT an optional phone both activate, no false duplicate", async () => {
  const f = accountStack({ v2: true, singleReview: true });
  try {
    const first = await manager(f, "empty1");
    const second = await manager(f, "empty2");
    for (const account of [first, second]) {
      const activated = await f.flow.completeProfileWithoutReview(account.token, professional);
      assert.equal(activated.stage, "active");
      const row = f.sqlite.prepare(`SELECT d.phone, c.kind, c.secondary_kind, c.secondary_value
        FROM device_access d JOIN accounts a ON a.storage_device_id=d.device_id
        JOIN account_contacts c ON c.account_id=a.account_id
        WHERE a.account_id=?`).get(account.account.accountId);
      assert.equal(row.phone, null, "SQL NULL must represent absent optional manager phone");
      assert.equal(row.kind, "email");
      assert.equal(row.secondary_kind, null);
      assert.equal(row.secondary_value, null);
      assert.equal((await f.service.ownerRead(account.account.accountId)).entitlement.active, true);
    }
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM accounts").get().n, 2);
  } finally { f.close(); }
});

test("V3: two different secondary phone numbers are saved and accepted atomically for email-first managers", async () => {
  const f = accountStack({ v2: true, singleReview: true });
  try {
    const people = [
      { value: "+84 (912) 345-678", phone: "0912345678", stored: "+84912345678" },
      { value: "+84 (912) 345-679", phone: "0912345679", stored: "+84912345679" },
    ];
    for (let i = 0; i < people.length; i++) {
      const a = await manager(f, "different" + i);
      const done = await f.flow.completeProfileWithoutReview(a.token, {
        ...professional, secondaryContact: people[i].value
      });
      assert.equal(done.stage, "active");
      const row = f.sqlite.prepare(`SELECT d.phone, c.kind, c.value,
          c.secondary_kind, c.secondary_value, c.verified
        FROM device_access d JOIN accounts a ON a.storage_device_id=d.device_id
        JOIN account_contacts c ON c.account_id=a.account_id WHERE a.account_id=?`)
        .get(a.account.accountId);
      assert.equal(row.phone, people[i].phone);
      assert.equal(row.kind, "email");
      assert.equal(row.secondary_kind, "phone");
      assert.equal(row.secondary_value, people[i].stored);
      assert.equal(row.verified, 0, "self-declared phone must never become verified OTP");
    }
  } finally { f.close(); }
});

test("V3: a GENUINE duplicate phone is still rejected; failed manager remains pending and can retry a different number", async () => {
  const f = accountStack({ v2: true, singleReview: true });
  try {
    const first = await manager(f, "actual1");
    await f.flow.completeProfileWithoutReview(first.token, {
      ...professional, secondaryContact: "+84 912 345 678"
    });
    const second = await manager(f, "actual2");
    await assert.rejects(
      () => f.flow.completeProfileWithoutReview(second.token, {
        ...professional, secondaryContact: "0912 345 678"
      }), error => error.code === "PROFILE_PHONE_IN_USE"
    );
    const id = second.account.accountId;
    assert.equal((await f.flow.ownStatus(second.token)).stage, "requested");
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?").get(id).n, 0);
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_manager_profiles WHERE account_id=?").get(id).n, 0);
    assert.equal(f.sqlite.prepare("SELECT secondary_value FROM account_contacts WHERE account_id=?").get(id).secondary_value, null);
    const active = await f.flow.completeProfileWithoutReview(second.token, {
      ...professional, secondaryContact: "+84912345679"
    });
    assert.equal(active.stage, "active");
  } finally { f.close(); }
});

test("V3: invalid optional manager contact does not partly update profile, contact or entitlements", async () => {
  const f = accountStack({ v2: true, singleReview: true });
  try {
    const a = await manager(f, "invalid");
    for (const value of ["abc", 12345, "bad phone"]) {
      await assert.rejects(() => f.flow.completeProfileWithoutReview(a.token, {
        ...professional, secondaryContact: value
      }), error => error.code === "ACCOUNT_CONTACT_INVALID");
    }
    const id = a.account.accountId;
    assert.equal((await f.flow.ownStatus(a.token)).stage, "requested");
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM account_entitlements WHERE account_id=?").get(id).n, 0);
    assert.equal(f.sqlite.prepare("SELECT secondary_value FROM account_contacts WHERE account_id=?").get(id).secondary_value, null);
  } finally { f.close(); }
});

test("V3: phone-first manager preserves primary phone when adding secondary email", async () => {
  const f = accountStack({ v2: true, singleReview: true });
  try {
    const a = await manager(f, "phonefirst", "phone");
    const done = await f.flow.completeProfileWithoutReview(a.token, {
      ...professional, secondaryContact: "MiXeD@Example.com"
    });
    assert.equal(done.stage, "active");
    const row = f.sqlite.prepare(`SELECT d.phone, c.kind, c.value, c.secondary_kind, c.secondary_value
      FROM device_access d JOIN accounts a ON a.storage_device_id=d.device_id
      JOIN account_contacts c ON c.account_id=a.account_id WHERE a.account_id=?`)
      .get(a.account.accountId);
    assert.equal(row.kind, "phone");
    assert.equal(row.secondary_kind, "email");
    assert.equal(row.secondary_value, "mixed@example.com");
    assert.equal(row.phone, "+79992345566");
  } finally { f.close(); }
});

test("manager UI reports real conflict inline at secondaryContact and clears it while editing", () => {
  const source = readFileSync(new URL("../app/account-gate.tsx", import.meta.url), "utf8");
  assert.match(source, /const fieldName=account\?\.role==="manager"&&account\.primaryContactKind==="email"/);
  assert.match(source, /\?"secondaryContact":"phone"/);
  assert.match(source, /name="secondaryContact"/);
  assert.match(source, /aria-invalid=\{Boolean\(fieldErrors\.secondaryContact\)\}/);
  assert.match(source, /profile-secondary-contact-error/);
  assert.match(source, /delete next\.secondaryContact/);
});
