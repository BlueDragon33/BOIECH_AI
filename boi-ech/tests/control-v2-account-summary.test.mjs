import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
import { DatabaseSync } from "node:sqlite";

const source = fs.readFileSync(new URL("../app/api/control/v2/account-summary/route.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

class ControlError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE accounts(account_id TEXT PRIMARY KEY);
    CREATE TABLE account_onboarding(account_id TEXT PRIMARY KEY,stage TEXT);
    CREATE TABLE account_entitlements(account_id TEXT PRIMARY KEY,state TEXT,expires_at TEXT);`);
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const add = (id, stage, state, expiry) => {
    db.prepare("INSERT INTO accounts VALUES(?)").run(id);
    if (stage) db.prepare("INSERT INTO account_onboarding VALUES(?,?)").run(id, stage);
    if (state) db.prepare("INSERT INTO account_entitlements VALUES(?,?,?)").run(id, state, expiry);
  };
  add("account-a", "active", "active", tomorrow);
  add("account-b", "requested", null, null);
  add("account-c", "active", "active", yesterday);
  add("account-d", "legacy_hold", null, null);
  add("account-e", "suspended", "suspended", tomorrow);
  let enabled = true;
  let calls = 0;
  const auth = {
    requireControlService: async request => {
      calls++;
      const credential = request.headers.get("authorization")?.slice(7);
      if (credential === "invalid") throw new ControlError("Invalid ticket", 403, "CONTROL_TICKET_FORBIDDEN");
      return { role: credential === "owner" ? "owner" : credential === "publisher" ? "publisher" : "viewer", actor: "someone@example.test" };
    },
    controlPreflight: () => new Response(null, { status: 204 }),
    controlResponse: (data, status) => Response.json(data, { status }),
    withControlCors: async (_req, response) => response,
  };
  const mocks = {
    "../../../account-runtime.server": {
      accountConfiguration: async () => ({ v2: enabled }),
      accountErrorResponse: error => Response.json({ error: error.message, code: error.code }, { status: error.status ?? 503 }),
    },
    "../../../device-auth.server": {
      DeviceAccessError: ControlError,
      getCourseDatabase: async () => ({
        prepare: sql => ({
          bind: (...values) => ({
            first: async () => {
              assert.doesNotMatch(sql, /learner_name|phone|person_code|device_access|payment_status/i);
              return db.prepare(sql).get(...values);
            },
          }),
        }),
      }),
    },
    "../../../control-auth.server": auth,
  };
  const mod = { exports: {} };
  new Function("require", "module", "exports", output)(name => {
    if (!(name in mocks)) throw new Error("Unexpected import: " + name);
    return mocks[name];
  }, mod, mod.exports);
  async function get(credential) {
    const headers = credential === null ? {} : { authorization: "Bearer " + credential };
    const response = await mod.exports.GET(new Request("https://boi.example.test/api/control/v2/account-summary", { headers }));
    return { status: response.status, data: await response.json() };
  }
  return { get, close: () => db.close(), setEnabled: v => { enabled = v; }, getCalls: () => calls, mod: mod.exports };
}

test("V2 summary is verified, count-only, no PII and matches live account states", async () => {
  const f = fixture();
  try {
    for (const credential of ["owner", "publisher"]) {
      const { status, data } = await f.get(credential);
      assert.equal(status, 200);
      assert.equal(data.contract, "boi-account-summary.v2");
      assert.equal(data.verified, true);
      assert.deepEqual(data.counts, {
        totalAccounts: 5, pending: 1, active: 1, suspended: 1, expired: 1, unverified: 2,
      });
      assert.deepEqual(Object.keys(data).sort(), ["asOf", "contract", "counts", "verified"]);
      assert.doesNotMatch(JSON.stringify(data), /account-a|learnerName|phone|personCode|deviceId|paymentStatus/);
    }
    assert.equal(f.mod.POST, undefined, "summary contract must not expose a write method");
  } finally { f.close(); }
});

test("V2 summary returns 401/403/409 without reading private account rows", async () => {
  const f = fixture();
  try {
    assert.equal((await f.get(null)).status, 401);
    assert.equal(f.getCalls(), 0, "missing auth must be denied before service authentication");
    assert.equal((await f.get("invalid")).status, 403);
    assert.equal((await f.get("viewer")).status, 403);
    f.setEnabled(false);
    const disabled = await f.get("owner");
    assert.equal(disabled.status, 409);
    assert.equal(disabled.data.code, "ACCOUNT_V2_REQUIRED");
  } finally { f.close(); }
});
