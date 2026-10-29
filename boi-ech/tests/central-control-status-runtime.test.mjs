import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";
import { fixture, identity } from "./helpers/device-auth-fixture.mjs";

function api(f) {
  const app = fileURLToPath(new URL("../app/", import.meta.url));
  const cache = new Map();
  function load(file) {
    if (file.endsWith("device-auth.server.ts")) return f.auth;
    if (file.endsWith("control-auth.server.ts")) return {
      requireControlService: async () => ({ actor: "test-owner@example.test", role: "owner" }),
      controlResponse: async (data, status = 200) => Response.json(data, { status }),
      withControlCors: async (_, response) => response,
    };
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const require = name => load(path.resolve(path.dirname(file), `${name}.ts`));
    new Function("require", "module", "exports", source)(require, loaded, loaded.exports);
    return loaded.exports;
  }
  return load(path.join(app, "api/control/overview/route.ts"));
}

async function setup() {
  const f = fixture("managed", true);
  const key = await identity();
  const { device } = await f.post({ action: "register", publicKey: key.publicKey });
  f.sqlite.prepare("UPDATE device_access SET status='blocked', payment_status='paid_verified', access_group='paid', access_expires_at='2000-01-01T00:00:00Z' WHERE device_id=?").run(device.deviceId);
  return { ...f, deviceId: device.deviceId, api: api(f) };
}

async function post(f, body) {
  const response = await f.api.POST(new Request("https://boi.test/api/control/overview", { method: "POST", body: JSON.stringify({ deviceId: f.deviceId, ...body }) }));
  return { status: response.status, ...await response.json() };
}

test("owning app rejects stale central status rather than unblocking a changed device", async () => {
  const f = await setup();
  try {
    const result = await post(f, { action: "unblock", expectedStatus: "approved", expectedPaymentStatus: "paid_verified", expectedAccessGroup: "paid" });
    assert.equal(result.status, 409);
    assert.equal(f.sqlite.prepare("SELECT status FROM device_access WHERE device_id=?").get(f.deviceId).status, "blocked");
  } finally { f.sqlite.close(); }
});

test("unblock only changes status and keeps paid expiry; concurrent payment change loses compare-and-swap", async () => {
  const f = await setup();
  try {
    let injected = false;
    const originalPrepare = f.database.prepare;
    f.database.prepare = sql => {
      const statement = originalPrepare(sql);
      if (/UPDATE device_access SET status = \?/.test(sql)) {
        const originalRun = statement.run;
        statement.run = async () => {
          if (!injected) { injected = true; f.sqlite.prepare("UPDATE device_access SET payment_status='awaiting_payment' WHERE device_id=?").run(f.deviceId); }
          return originalRun();
        };
      }
      return statement;
    };
    const result = await post(f, { action: "unblock", expectedStatus: "blocked", expectedPaymentStatus: "paid_verified", expectedAccessGroup: "paid" });
    assert.equal(result.status, 409);
    const row = f.sqlite.prepare("SELECT status,access_expires_at FROM device_access WHERE device_id=?").get(f.deviceId);
    assert.equal(row.status, "blocked"); assert.equal(row.access_expires_at, "2000-01-01T00:00:00Z");
  } finally { f.sqlite.close(); }
});

test("confirmed unblock preserves expired paid record without automatic renewal", async () => {
  const f = await setup();
  try {
    const result = await post(f, { action: "unblock", expectedStatus: "blocked", expectedPaymentStatus: "paid_verified", expectedAccessGroup: "paid" });
    assert.equal(result.status, 200);
    const row = f.sqlite.prepare("SELECT status,payment_status,access_group,access_expires_at FROM device_access WHERE device_id=?").get(f.deviceId);
    assert.deepEqual({ ...row }, { status: "approved", payment_status: "paid_verified", access_group: "paid", access_expires_at: "2000-01-01T00:00:00Z" });
  } finally { f.sqlite.close(); }
});

test("competing free and paid classifications cannot both commit the same central snapshot", async () => {
  const f = await setup();
  try {
    f.sqlite.prepare("UPDATE device_access SET status='pending', payment_status='unassigned', access_group='unassigned', learner_name='Test Teacher', person_role='teacher', person_code='SQTEST', class_name='A', phone='0900000099', registration_submitted_at=CURRENT_TIMESTAMP, access_expires_at=NULL WHERE device_id=?").run(f.deviceId);
    const snapshot = { expectedStatus: "pending", expectedPaymentStatus: "unassigned", expectedAccessGroup: "unassigned" };
    const results = await Promise.all([post(f, { action: "grant-free", ...snapshot }), post(f, { action: "require-payment", ...snapshot })]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM course_audit_log WHERE action IN ('learning_device_free_approved','learning_device_payment_required')").get().n, 1);
  } finally { f.sqlite.close(); }
});
