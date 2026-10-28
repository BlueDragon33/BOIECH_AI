import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";
import { fixture, identity, proof } from "./helpers/device-auth-fixture.mjs";

const app = fileURLToPath(new URL("../app/", import.meta.url));

// Actual server modules, course data and migrations. Only the Workers DB binding
// and transport are substituted; signatures, authorization and SQL all execute.
function teacherApi(f) {
  const cache = new Map([[path.join(app, "device-auth.server.ts"), { exports: f.auth }]]);
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const record = { exports: {} }; cache.set(file, record);
    const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const require = name => {
      assert.ok(name.startsWith("."), `unexpected external server dependency: ${name}`);
      return load(path.resolve(path.dirname(file), `${name}.ts`));
    };
    new Function("require", "module", "exports", outputText)(require, record, record.exports);
    return record.exports;
  }
  return load(path.join(app, "api/teacher/overview/route.ts"));
}

async function register(f, personRole, className, index) {
  const key = await identity();
  const { device } = await f.post({ action: "register", publicKey: key.publicKey });
  const saved = await f.post({ action: "save-registration", ...await proof(f, key, device.deviceId), learnerFamilyName: "Kiểm", learnerGivenName: "Thử", personRole, personCode: `${personRole === "teacher" ? "SQ" : "HV"}TEST${index}`, className, phone: `09000000${String(index).padStart(2, "0")}` });
  assert.equal(saved.status, 200, JSON.stringify(saved));
  return { key, device: saved.device };
}

function clientLoader(f, api, key) {
  const source = ts.createSourceFile("teacher.tsx", fs.readFileSync(path.join(app, "teacher-role-shell.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && ["base64Url", "signedTeacherProof", "loadTeacherOverview"].includes(node.name?.text));
  const { outputText } = ts.transpileModule(functions.map(node => node.getText(source)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
  const fetch = async (url, options) => {
    options.signal?.throwIfAborted();
    const payload = JSON.parse(options.body);
    if (url === "/api/device") {
      const { status, ...body } = await f.post(payload);
      return Response.json(body, { status });
    }
    assert.equal(url, "/api/teacher/overview");
    return api.POST(new Request(`https://boi-ech.boiech-ai.workers.dev${url}`, { method: "POST", body: options.body }));
  };
  return new Function("fetch", "readStoredDeviceCredential", `${outputText}; return loadTeacherOverview;`)(fetch, async () => ({ version: 2, publicKey: key.publicKey, privateKey: key.privateKey }));
}

test("registered approved teacher loads the real signed overview and sees only assigned learners", async () => {
  const f = fixture("managed", true);
  try {
    await f.auth.getCourseDatabase();
    f.sqlite.exec("UPDATE access_automation_settings SET auto_confirm_new_devices=1, updated_by='test-owner'");
    const teacher = await register(f, "teacher", "Lớp A", 1);
    await register(f, "learner", "Lớp A", 2);
    await register(f, "learner", "Lớp B", 3);
    assert.equal(teacher.device.status, "approved");
    const data = await clientLoader(f, teacherApi(f), teacher.key)(teacher.device.deviceId);
    assert.equal(data.teacher.personCode, "SQTEST1");
    assert.equal(data.learners.length, 1);
    assert.equal(data.learners[0].personCode, "HVTEST2");
    assert.equal(data.privacy.mediaStored, false);
  } finally { f.sqlite.close(); }
});

test("pending and expired teacher access is reported without granting dashboard rights", async () => {
  const f = fixture("managed", true);
  try {
    const teacher = await register(f, "teacher", "Lớp A", 4);
    const load = clientLoader(f, teacherApi(f), teacher.key);
    await assert.rejects(load(teacher.device.deviceId), /chờ.*duyệt/i);
    f.sqlite.prepare("UPDATE device_access SET status='approved', access_expires_at='2000-01-01T00:00:00Z' WHERE device_id=?").run(teacher.device.deviceId);
    await assert.rejects(load(teacher.device.deviceId), /hết hạn/i);
  } finally { f.sqlite.close(); }
});

test("an approved learner cannot load teacher data with a valid signature", async () => {
  const f = fixture("managed", true);
  try {
    await f.auth.getCourseDatabase();
    f.sqlite.exec("UPDATE access_automation_settings SET auto_confirm_new_devices=1, updated_by='test-owner'");
    const learner = await register(f, "learner", "Lớp A", 5);
    await assert.rejects(clientLoader(f, teacherApi(f), learner.key)(learner.device.deviceId), /Chỉ Giảng viên/);
  } finally { f.sqlite.close(); }
});
