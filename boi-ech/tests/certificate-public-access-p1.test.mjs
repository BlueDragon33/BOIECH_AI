import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const gate = fs.readFileSync(new URL("../app/account-gate.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/chung-chi/page.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/chung-chi/layout.tsx", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/certificate/route.ts", import.meta.url), "utf8");

const VALID_CODE = "BECH-ABCDE-12345-67890-ABCDE";
const certificate = {
  verification_code: VALID_CODE,
  device_code: "BE-SECRET-DEVICE",
  learner_name: "Nguyen Van A",
  class_name: "Lop Boi Ech",
  scores_json: '{"01":10,"02":9,"03":8}',
  total_active_seconds: 12345,
  completed_at: "2026-11-12T09:00:00.000Z",
  course_version: 7,
  issued_at: "2026-11-12T10:00:00.000Z",
};
function harness(result = certificate) {
  let reads = 0, signatureChecks = 0, writes = 0, boundCode = "";
  class DeviceAccessError extends Error {
    constructor() { super("Device not approved"); this.status = 403; this.code = "DEVICE_PENDING"; }
  }
  const db = { prepare(sql) {
    if (!sql.includes("FROM course_certificates WHERE verification_code = ?")) {
      writes += 1;
      throw new Error("Unexpected database operation from public verification");
    }
    return {
      bind(code) { boundCode = code; return this; },
      async first() { reads += 1; return result; },
    };
  }};
  const compiled = ts.transpileModule(route, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", compiled)(name => {
    assert.equal(name, "../../device-auth.server");
    return {
      DeviceAccessError,
      getCourseDatabase: async () => db,
      verifyDeviceRequest: async () => { signatureChecks += 1; throw new DeviceAccessError(); },
    };
  }, mod, mod.exports);
  return {
    api: mod.exports,
    observed: () => ({ reads, signatureChecks, writes, boundCode }),
  };
}
function verificationRequest(code) {
  return new Request("https://fixture.invalid/api/certificate?code=" + encodeURIComponent(code));
}

test("P1 public verification page bypasses only read-only certificate route", () => {
  assert.match(gate, /const bypass = pathname === "\/chung-chi" \|\| pathname === "\/xem-thu-can-bo-quan-ly"/);
  assert.match(gate, /if \(!enabled \|\| bypass\) return children/);
  assert.doesNotMatch(gate, /pathname\.startsWith\("\/chung-chi"/);
  assert.match(layout, /robots:\s*\{ index: false, follow: false \}/);
  assert.match(page, /fetch\(`\/api\/certificate\?code=/);
  assert.match(page, /In \/ Lưu PDF/);
  assert.doesNotMatch(page, /certificate\.(deviceCode|scores|totalActiveSeconds)/);
});

test("P1 public GET verifies a certificate without any account cookie and returns minimal fields", async () => {
  const { api, observed } = harness();
  const response = await api.GET(verificationRequest(VALID_CODE.toLowerCase()));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  const data = await response.json();
  assert.equal(data.valid, true);
  assert.deepEqual(Object.keys(data.certificate).sort(), [
    "verificationCode", "learnerName", "className", "completedAt",
    "courseVersion", "issuedAt", "courseTitle",
  ].sort());
  assert.equal(data.certificate.learnerName, certificate.learner_name);
  assert.equal(data.certificate.verificationCode, VALID_CODE);
  assert.equal(observed().boundCode, VALID_CODE);
  assert.equal(observed().signatureChecks, 0, "public lookup must not require a signed device");
  assert.equal(observed().writes, 0, "public GET must never mutate D1");
  assert.doesNotMatch(JSON.stringify(data.certificate), /BE-SECRET-DEVICE|"scores"|"totalActiveSeconds"/);
});

test("P1 invalid and unknown certificate codes never disclose a record", async () => {
  const invalid = harness();
  const bad = await invalid.api.GET(verificationRequest("not-a-code"));
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { valid: false, error: "Mã chứng chỉ không hợp lệ." });
  assert.equal(invalid.observed().reads, 0);
  const unknown = harness(null);
  const missing = await unknown.api.GET(verificationRequest(VALID_CODE));
  assert.equal(missing.status, 404);
  const body = await missing.json();
  assert.equal(body.valid, false);
  assert.equal(body.certificate, undefined);
  assert.equal(unknown.observed().writes, 0);
});

test("P1 public certificate route never turns issuance into anonymous permission", async () => {
  const { api, observed } = harness();
  const request = new Request("https://fixture.invalid/api/certificate", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "issue", deviceId: "untrusted" }),
  });
  const response = await api.POST(request);
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.code, "DEVICE_PENDING");
  assert.equal(observed().signatureChecks, 1);
  assert.equal(observed().writes, 0);
  assert.match(route, /LESSONS\.every/);
  assert.match(route, /Number\(scores\[lesson\]\) >= 8/);
  assert.match(route, /certificate: issuedCertificate\(row\), created: true/);
  assert.match(route, /certificate: publicCertificate\(row\)/);
});
