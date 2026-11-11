import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const route = new URL("../app/api/control/v2/device-registry/route.ts", import.meta.url);

function fixture(t, { enabled = true, readFails = false } = {}) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec(`CREATE TABLE account_devices (
    account_id TEXT, device_id TEXT, public_key_jwk TEXT, approved INTEGER, revoked INTEGER,
    PRIMARY KEY (account_id, device_id)
  )`);
  let reads = 0;
  class DeviceAccessError extends Error {
    constructor(message, status, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  const modules = {
    "../../../../account-runtime.server": {
      accountConfiguration: async () => ({ v2: enabled }),
      accountErrorResponse: error => Response.json({ code: error.code ?? "INTERNAL_ERROR" }, { status: error.status ?? 500 }),
    },
    "../../../../device-auth.server": {
      DeviceAccessError,
      getCourseDatabase: async () => ({
        prepare: sql => ({
          all: async () => {
            reads++;
            if (readFails) return { success: false };
            assert.doesNotMatch(sql, /public_key_jwk|device_access|account_sessions/i);
            return { success: true, results: db.prepare(sql).all() };
          },
        }),
      }),
    },
    "../../../../control-auth.server": {
      requireControlService: async request => {
        const ticket = request.headers.get("authorization");
        if (ticket === "Bearer v1.invalid") throw new DeviceAccessError("Denied", 403, "CONTROL_TICKET_FORBIDDEN");
        return { role: ticket === "Bearer v1.owner" ? "owner" : "publisher" };
      },
      controlPreflight: () => new Response(null, { status: 204 }),
      controlResponse: (data, status) => Response.json(data, { status }),
      withControlCors: (_request, response) => response,
    },
  };
  const source = fs.existsSync(route) ? fs.readFileSync(route, "utf8") : "";
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = { exports: {} };
  new Function("require", "module", "exports", outputText)(name => modules[name] ?? nativeRequire(name), loaded, loaded.exports);
  assert.equal(typeof loaded.exports.GET, "function", "Owner needs a read-only Account-first device endpoint");
  return {
    handler: loaded.exports,
    reads: () => reads,
    add: (account, device, approved, revoked) => db.prepare("INSERT INTO account_devices VALUES (?, ?, ?, ?, ?)").run(account, device, "PRIVATE_JWK", approved, revoked),
    async get(credential = "v1.owner") {
      const headers = credential ? { authorization: "Bearer " + credential } : {};
      const response = await loaded.exports.GET(new Request("https://boi.example.test/api/control/v2/device-registry", { headers }));
      return { status: response.status, payload: await response.json() };
    },
  };
}

test("Owner reads real Account-first device bindings without exposing accounts or signing keys", async t => {
  const f = fixture(t);
  assert.equal(f.handler.POST, undefined);
  assert.equal((await f.get()).payload.counts.total, 0);
  f.add("PRIVATE_ACCOUNT_1", "PRIVATE_DEVICE", 0, 0);
  f.add("PRIVATE_ACCOUNT_2", "PRIVATE_DEVICE", 1, 0);
  f.add("PRIVATE_ACCOUNT_3", "OTHER_DEVICE", 1, 1);
  const result = await f.get();
  assert.equal(result.status, 200);
  assert.equal(result.payload.contract, "boi-device-registry.v2");
  assert.equal(result.payload.readOnly, true);
  assert.deepEqual(result.payload.counts, { total: 3 });
  assert.deepEqual(result.payload.devices.map(device => device.status), ["pending", "approved", "blocked"]);
  assert.equal(new Set(result.payload.devices.map(device => device.deviceId)).size, 3);
  assert.ok(result.payload.devices.every(device => /^[a-f0-9]{64}$/.test(device.deviceId)));
  assert.doesNotMatch(JSON.stringify(result.payload), /PRIVATE|OTHER_DEVICE/);
  assert.deepEqual((await f.get()).payload, result.payload);
});

test("Unauthorized and disabled registry reads never touch D1; failed reads cannot produce verified zero", async t => {
  const f = fixture(t, { enabled: false });
  for (const [credential, expected] of [[null, 401], ["raw-secret", 401], ["v1.invalid", 403], ["v1.publisher", 403], ["v1.owner", 409]]) {
    assert.equal((await f.get(credential)).status, expected);
  }
  assert.equal(f.reads(), 0);
  const failed = await fixture(t, { readFails: true }).get();
  assert.equal(failed.status, 503);
  assert.equal(failed.payload.counts, undefined);
});
