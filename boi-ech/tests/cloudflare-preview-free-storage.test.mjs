import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const previewId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const productionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const env = {
  ...process.env,
  BOI_ECH_PREVIEW_D1_DATABASE_ID: previewId,
  BOI_ECH_PRODUCTION_D1_DATABASE_ID: productionId,
  BOI_ECH_PREVIEW_ORIGIN: "https://boi-ech-preview.example.invalid",
  APPLICATION_MANAGEMENT_PREVIEW_ORIGIN: "https://application-management-preview.example.invalid",
  GITHUB_SHA: "a".repeat(40),
};
const template = JSON.parse(fs.readFileSync(path.join(root, "wrangler.cloudflare.preview.example.jsonc"), "utf8"));

function temporary(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boi-free-preview-"));
  try { return run(dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function execute(script, cwd) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", script)], {
    cwd, env, encoding: "utf8", timeout: 10_000,
  });
  assert.equal(result.error, undefined);
  return result;
}

function prepare(dir, config = template) {
  fs.writeFileSync(path.join(dir, "wrangler.cloudflare.preview.example.jsonc"), JSON.stringify(config, null, 2));
  return execute("prepare-cloudflare-preview.mjs", dir);
}

function artifact(dir, change = () => {}) {
  const config = structuredClone(template);
  config.d1_databases[0].database_id = previewId;
  config.vars.BOI_ECH_BUILD_REVISION = "a".repeat(40);
  config.vars.BOI_ECH_ACCOUNT_ORIGIN = env.BOI_ECH_PREVIEW_ORIGIN;
  config.vars.APPLICATION_MANAGEMENT_ORIGIN = env.APPLICATION_MANAGEMENT_PREVIEW_ORIGIN;
  delete config.r2_buckets;
  change(config);
  fs.mkdirSync(path.join(dir, "dist", "server"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".wrangler", "deploy"), { recursive: true });
  fs.writeFileSync(path.join(dir, "dist", "server", "wrangler.json"), JSON.stringify(config));
  fs.writeFileSync(path.join(dir, ".wrangler", "deploy", "config.json"), JSON.stringify({ configPath: "../../dist/server/wrangler.json" }));
  return execute("validate-cloudflare-build-artifact.mjs", dir);
}

test("Account-first Preview packaging does not require an R2 subscription", () => temporary(dir => {
  const result = prepare(dir);
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(fs.readFileSync(path.join(dir, "wrangler.cloudflare.preview.jsonc"), "utf8"));
  assert.deepEqual(config.r2_buckets ?? [], [], "Account-first packaging must not request a billable storage binding");
  assert.equal(config.d1_databases[0].database_id, previewId);
}));

test("Preview preparation rejects an injected R2 dependency before writing configuration", () => {
  for (const binding of ["BUCKET", "OTHER_STORAGE"]) temporary(dir => {
    const config = structuredClone(template);
    config.r2_buckets = [{ binding, bucket_name: "unexpected-bucket" }];
    const result = prepare(dir, config);
    assert.notEqual(result.status, 0, "a stale or edited template must not activate R2");
    assert.match(result.stderr, /R2/);
    assert.equal(fs.existsSync(path.join(dir, "wrangler.cloudflare.preview.jsonc")), false);
  });
});

test("generated FREE Account-first artifact passes without R2", () => temporary(dir => {
  const result = artifact(dir);
  assert.equal(result.status, 0, result.stderr);
}));

test("generated Preview artifact rejects R2 under any binding name", () => {
  for (const binding of ["BUCKET", "OTHER_STORAGE"]) temporary(dir => {
    const result = artifact(dir, config => { config.r2_buckets = [{ binding, bucket_name: "boi-ech-preview-payments" }]; });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /R2/);
  });
});

test("no-R2 Preview still rejects a Production D1 identity", () => temporary(dir => {
  const result = artifact(dir, config => { config.d1_databases[0].database_id = productionId; });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /D1 ID|production D1/);
}));
