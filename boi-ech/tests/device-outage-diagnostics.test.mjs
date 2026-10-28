import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(new URL("../../.github/workflows/diagnose-boi-automation.yml", import.meta.url), "utf8");

test("production diagnostics are manual, read only, and omit personal records", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\bpush\s*:/);
  assert.match(workflow, /environment: boi-ech-production/);
  assert.match(workflow, /pragma_table_info\('device_access'\)/);
  assert.match(workflow, /standalone_identity_count/);
  assert.doesNotMatch(workflow, /SELECT\s+\*|updated_by|detail_json|\bactor\b|\bUPDATE\b|\bDELETE\b|\bINSERT\b|\bALTER\b|\bDROP\b/i);
});
