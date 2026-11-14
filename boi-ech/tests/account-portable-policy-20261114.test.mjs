import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";

const sql = fs.readFileSync(new URL("../drizzle/0040_mobile_account_first_sessions.sql", import.meta.url), "utf8");
const core = fs.readFileSync(new URL("../app/account-core.server.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/accounts/route.ts", import.meta.url), "utf8");
const classifySource = fs.readFileSync(new URL("../app/account-client-class.ts", import.meta.url), "utf8");
const runtime = ts.transpileModule(classifySource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function("exports", runtime)(exports);
const { classifyAccountClient } = exports;

test("phone, iPad, tablet classification uses only request headers and is explicit about spoofability", () => {
  assert.equal(classifyAccountClient("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1 Mobile/15E148", null), "phone");
  assert.equal(classifyAccountClient("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1 Mobile/15E148", null), "tablet");
  assert.equal(classifyAccountClient("Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36", null), "tablet");
  assert.equal(classifyAccountClient("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Mobile Safari/537.36", null), "phone");
  assert.equal(classifyAccountClient("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/154.0", "?0"), "desktop");
  assert.equal(classifyAccountClient("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) Safari/605", null), "desktop");
  assert.equal(classifyAccountClient("unknown", "?1"), "phone");
  assert.match(classifySource, /NOT a proof of a/);
  assert.doesNotMatch(route, /p\.clientClass|p\.isMobile|p\.deviceType/);
});

test("D1 migration keeps three desktop key slots but does not count portable browser sessions", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE account_devices (
      account_id TEXT NOT NULL, device_id TEXT NOT NULL,
      public_key_jwk TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0,
      revoked INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(account_id,device_id)
    );`);
    db.exec(sql);
    const insert = (id, cls) => db.prepare("INSERT INTO account_devices(account_id,device_id,public_key_jwk,approved,client_class) VALUES(?,?,?,?,?)")
      .run("account", id, "public-key", 1, cls);
    for (const id of ["desktop1","desktop2","desktop3"]) insert(id, "desktop");
    assert.throws(() => insert("desktop4", "desktop"), /ACCOUNT_DEVICE_LIMIT_REACHED/);
    for (const id of ["iphone1","iphone2","ipad1","tablet2","android1"]) insert(id, id.startsWith("ipad")||id.startsWith("tablet")?"tablet":"phone");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM account_devices WHERE revoked=0").get().n, 8);
    assert.throws(() => db.prepare("UPDATE account_devices SET client_class='unsupported' WHERE device_id='iphone1'").run(), /CHECK constraint failed/);
    db.prepare("UPDATE account_devices SET revoked=1 WHERE device_id='desktop3'").run();
    insert("desktop4", "desktop");
    assert.throws(() => db.prepare("UPDATE account_devices SET revoked=0 WHERE device_id='desktop3'").run(), /ACCOUNT_DEVICE_LIMIT_REACHED/);
  } finally { db.close(); }
});

test("mobile session approval does not waive password, account state or explicit revocation", () => {
  assert.match(core, /await verifyPassword\(input\.password, row\?\.password_verifier \?\? dummy\)/);
  assert.match(core, /await this\.assertReentryAllowed\(login,keyId\)/);
  assert.match(core, /if\s*\(existing\?\.revoked\) fail\("DEVICE_REVOKED", 403\)/);
  assert.match(core, /client_class=\?/);
  assert.match(core, /WHERE account_id=\? AND device_id=\? AND revoked=0/);
  assert.match(core, /approved=0 OR client_class<>\?/);
  assert.match(core, /account\.portable-session\.verified/);
  assert.match(core, /if \(!actor\.deviceApproved\) fail\("DEVICE_APPROVAL_REQUIRED"\)/);
  assert.match(core, /await new AccountEntitlementService\(this\.db,this\.now\)\.assertActive\(actor\.accountId\)/);
  assert.match(route, /clientClass = classifyAccountClient\(request\.headers\.get\("user-agent"\), request\.headers\.get\("sec-ch-ua-mobile"\)\)/);
});

test("preserves existing mobile account and renewal source code under TypeScript parsing", () => {
  for (const [name, source, kind] of [
    ["account-core.server.ts", core, ts.ScriptKind.TS],
    ["api/accounts/route.ts", route, ts.ScriptKind.TS],
    ["manager-renewal-panel.tsx", fs.readFileSync(new URL("../app/manager-renewal-panel.tsx", import.meta.url),"utf8"),ts.ScriptKind.TSX]
  ]) {
    const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, kind);
    assert.equal(parsed.parseDiagnostics.length, 0, name + ": " + parsed.parseDiagnostics.map(x=>x.messageText).join("; "));
  }
});
