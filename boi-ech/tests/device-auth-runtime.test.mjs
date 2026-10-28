import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

// Execute the actual server and route against SQLite. Only the Workers binding,
// unused admin identity provider, and best-effort browser metadata are replaced.
function fixture(mode) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE course_profiles (user_key TEXT, completed_json TEXT, scores_json TEXT, device_hash TEXT, updated_at TEXT)");
  sqlite.exec("CREATE TABLE course_audit_log (id INTEGER PRIMARY KEY, actor TEXT, action TEXT, target TEXT, detail_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
  let transientBatchFailure = false;
  const database = {
    prepare(sql) {
      let args = [];
      const query = {
        bind(...values) { args = values; return query; },
        async first() { return sqlite.prepare(sql).get(...args) ?? null; },
        async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        async run() { const result = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; },
      };
      return query;
    },
    async batch(queries) {
      if (transientBatchFailure) { transientBatchFailure = false; throw new Error("temporary D1 transport failure"); }
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const query of queries) results.push(await query.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  const authSource = stripTypeScriptTypes(fs.readFileSync(new URL("../app/device-auth.server.ts", import.meta.url), "utf8"))
    .replace(/import \{ getChatGPTUser \} from "\.\/chatgpt-auth";/, "")
    .replace('await import("cloudflare:workers")', "testWorkers")
    .replace(/\bexport\s+/g, "");
  const authNames = ["createDeviceChallenge", "deviceErrorResponse", "getCourseDatabase", "getPublicDeviceState", "registerDevice", "saveDeviceRegistration", "verifyDeviceIdentityRequest", "verifyDeviceRequest"];
  const auth = new Function("testWorkers", "getChatGPTUser", `${authSource}; return {${authNames.join(",")}};`)({ env: { DB: database } }, async () => null);
  const routeSource = stripTypeScriptTypes(fs.readFileSync(new URL("../app/api/device/route.ts", import.meta.url), "utf8"))
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";/g, "")
    .replace(/\bexport\s+/g, "");
  const POST = new Function(...authNames, "captureDeviceMetadata", "process", `${routeSource}; return POST;`)(...authNames.map(name => auth[name]), async () => {}, { env: { BOI_ECH_ACCESS_MODE: mode } });
  return {
    sqlite, auth,
    failNextBatch() { transientBatchFailure = true; },
    async post(payload, host = "boi-ech.boiech-ai.workers.dev") {
      const response = await POST(new Request(`https://${host}/api/device`, { method: "POST", body: JSON.stringify(payload) }));
      return { status: response.status, ...await response.json() };
    },
  };
}

async function identity() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  return { publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey), privateKey: pair.privateKey };
}

async function proof(f, key, deviceId) {
  const { challenge } = await f.post({ action: "challenge", deviceId });
  const bytes = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.privateKey, new TextEncoder().encode(`boi-ech:${deviceId}:${challenge}`));
  return { deviceId, challenge, signature: Buffer.from(bytes).toString("base64url") };
}

for (const mode of [undefined, "standalone", "managed"]) {
  test(`production registration stays managed for mode ${mode ?? "unset"} across two new devices`, async () => {
    const f = fixture(mode);
    try {
      for (let index = 0; index < 2; index++) {
        const key = await identity();
        const result = await f.post({ action: "register", publicKey: key.publicKey });
        assert.equal(result.status, 200, JSON.stringify(result));
        assert.equal(result.device.status, "pending");
        assert.equal(result.device.accessGroup, "unassigned");
        assert.equal(result.device.personCode, null);
        assert.equal(result.device.phone, null);
        assert.equal(result.device.registrationComplete, false);
        const verified = await f.post({ action: "presence", ...await proof(f, key, result.device.deviceId) });
        assert.equal(verified.status, 200);
        assert.equal(verified.device.status, "pending");
        const { challenge } = await f.post({ action: "challenge", deviceId: result.device.deviceId });
        const forged = await f.post({ action: "presence", deviceId: result.device.deviceId, challenge, signature: "AA" });
        assert.equal(forged.status, 403);
        assert.equal(forged.code, "DEVICE_MISMATCH");
      }
      assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM device_access").get().n, 2);
    } finally { f.sqlite.close(); }
  });
}

test("managed registration applies enabled automation only after signed registration within quota", async () => {
  const f = fixture();
  try {
    await f.auth.getCourseDatabase();
    f.sqlite.exec("UPDATE access_automation_settings SET auto_confirm_new_devices=1, default_device_limit=1, updated_by='test-owner' WHERE id='global'");
    for (let index = 0; index < 2; index++) {
      const key = await identity();
      const { device } = await f.post({ action: "register", publicKey: key.publicKey });
      const result = await f.post({ action: "save-registration", ...await proof(f, key, device.deviceId), learnerFamilyName: "Nguyễn", learnerGivenName: "An", personRole: "learner", personCode: `HV${index + 1}`, className: "Lớp thử nghiệm", phone: `090000000${index}` });
      assert.equal(result.status, 200, JSON.stringify(result));
      assert.equal(result.device.status, index === 0 ? "approved" : "pending");
      assert.equal(Boolean(result.device.autoConfirmedAt), index === 0);
      assert.equal(Boolean(result.device.accessExpiresAt), index === 0);
    }
  } finally { f.sqlite.close(); }
});

test("schema initialization retries after a temporary database failure", async () => {
  const f = fixture("managed");
  try {
    f.failNextBatch();
    const key = await identity();
    const first = await f.post({ action: "register", publicKey: key.publicKey });
    assert.equal(first.status, 500);
    const retry = await f.post({ action: "register", publicKey: key.publicKey });
    assert.equal(retry.status, 200, JSON.stringify(retry));
    assert.equal(retry.device.status, "pending");
  } finally { f.sqlite.close(); }
});

test("existing blocked, paid, and expired access survives repeat registration", async () => {
  const f = fixture("standalone");
  try {
    const key = await identity();
    const { device } = await f.post({ action: "register", publicKey: key.publicKey });
    for (const status of ["blocked", "approved"]) {
      f.sqlite.prepare("UPDATE device_access SET status=?, access_group='paid', payment_status='paid_verified', access_expires_at='2000-01-01T00:00:00.000Z' WHERE device_id=?").run(status, device.deviceId);
      const result = await f.post({ action: "register", publicKey: key.publicKey });
      assert.equal(result.status, 200);
      assert.equal(result.device.status, status);
      assert.equal(result.device.paymentStatus, "paid_verified");
      assert.equal(result.device.accessExpired, true);
    }
  } finally { f.sqlite.close(); }
});

test("two explicit local standalone devices avoid shared identity collisions", async () => {
  const f = fixture("standalone");
  try {
    for (let index = 0; index < 2; index++) {
      const result = await f.post({ action: "register", publicKey: (await identity()).publicKey }, "localhost");
      assert.equal(result.status, 200, JSON.stringify(result));
      assert.equal(result.device.status, "approved");
    }
  } finally { f.sqlite.close(); }
});

test("additional-account token cannot reclassify an existing blocked, paid, or expired identity", async () => {
  const f = fixture("managed");
  try {
    const key = await identity();
    const { device } = await f.post({ action: "register", publicKey: key.publicKey });
    for (const status of ["blocked", "approved"]) {
      f.sqlite.prepare("UPDATE device_access SET status=?, access_group='paid', payment_status='paid_verified', blocked_at='2000-01-01', access_expires_at='2000-01-01T00:00:00.000Z' WHERE device_id=?").run(status, device.deviceId);
      const before = f.sqlite.prepare("SELECT * FROM device_access WHERE device_id=?").get(device.deviceId);
      const result = await f.post({ action: "register", publicKey: key.publicKey, legacyToken: "boi-ech-additional-account-manual-review-v1" });
      assert.equal(result.status, 200, JSON.stringify(result));
      assert.deepEqual(f.sqlite.prepare("SELECT * FROM device_access WHERE device_id=?").get(device.deviceId), before);
    }
  } finally { f.sqlite.close(); }
});

test("new additional accounts await manual review without consuming automation quota or undoing owner approval", async () => {
  const f = fixture("managed");
  try {
    await f.auth.getCourseDatabase();
    f.sqlite.exec("UPDATE access_automation_settings SET auto_confirm_new_devices=1, updated_by='test-owner'");
    const key = await identity();
    const { device } = await f.post({ action: "register", publicKey: key.publicKey, legacyToken: "boi-ech-additional-account-manual-review-v1" });
    assert.equal(device.status, "pending");
    assert.equal(device.label, "Tài khoản bổ sung · chờ quản trị duyệt");
    const fields = { learnerFamilyName: "Nguyễn", learnerGivenName: "An", personRole: "learner", personCode: "HVEXTRA", className: "Lớp thử nghiệm", phone: "0900000010" };
    const saved = await f.post({ action: "save-registration", ...await proof(f, key, device.deviceId), ...fields });
    assert.equal(saved.status, 200, JSON.stringify(saved));
    assert.equal(saved.device.status, "pending");
    assert.equal(saved.device.autoConfirmedAt, null);
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM course_audit_log WHERE action='learning_device_auto_confirmed'").get().n, 0);
    f.sqlite.prepare("UPDATE device_access SET status='approved', access_group='paid', payment_status='paid_verified', access_expires_at='2099-01-01T00:00:00.000Z' WHERE device_id=?").run(device.deviceId);
    const approved = await f.post({ action: "save-registration", ...await proof(f, key, device.deviceId), ...fields });
    assert.equal(approved.status, 200);
    assert.equal(approved.device.status, "approved");
    assert.equal(approved.device.paymentStatus, "paid_verified");
    assert.equal(approved.device.accessExpiresAt, "2099-01-01T00:00:00.000Z");
  } finally { f.sqlite.close(); }
});
