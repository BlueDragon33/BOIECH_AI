import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const schema = fs.readFileSync(new URL("../db/schema.ts", import.meta.url), "utf8");
const bootstrap = fs.readFileSync(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../drizzle/0015_device_classification.sql", import.meta.url), "utf8");
const statusRoute = fs.readFileSync(new URL("../app/api/course/teacher-actions/status/route.ts", import.meta.url), "utf8");
const readiness = fs.readFileSync(new URL("../scripts/validate-release-readiness.mjs", import.meta.url), "utf8");

test("L12 keeps Drizzle device classification schema in parity with migration 0015", () => {
  for (const column of ["device_type", "platform", "browser", "user_agent"]) {
    assert.match(migration, new RegExp(`ADD COLUMN \\`${column}\\``));
    assert.match(schema, new RegExp(`text\\("${column}"\\)`));
  }
  assert.match(schema, /deviceType: text\("device_type"\)\.notNull\(\)\.default\("desktop"\)/);
  assert.match(schema, /device_access_type_status_idx/);
});

test("L12 fresh database bootstrap contains classification columns", () => {
  assert.match(bootstrap, /device_type TEXT NOT NULL DEFAULT 'desktop'/);
  assert.match(bootstrap, /platform TEXT/);
  assert.match(bootstrap, /browser TEXT/);
  assert.match(bootstrap, /user_agent TEXT/);
});

test("L12 repairs classification columns for older local databases before metadata writes", () => {
  assert.match(bootstrap, /PRAGMA table_info\(device_access\)/);
  assert.match(bootstrap, /ALTER TABLE device_access ADD COLUMN device_type/);
  assert.match(bootstrap, /ALTER TABLE device_access ADD COLUMN platform/);
  assert.match(bootstrap, /ALTER TABLE device_access ADD COLUMN browser/);
  assert.match(bootstrap, /ALTER TABLE device_access ADD COLUMN user_agent/);
  assert.match(bootstrap, /CREATE INDEX IF NOT EXISTS device_access_type_status_idx/);
});

test("L12 assignment status events are bounded and same-state updates are no-ops", () => {
  assert.match(statusRoute, /MAX_STATUS_EVENTS_PER_ASSIGNMENT = 24/);
  assert.match(statusRoute, /latestStatus === status/);
  assert.match(statusRoute, /unchanged: true/);
  assert.match(statusRoute, /COUNT\(\*\) AS count/);
  assert.match(statusRoute, />= MAX_STATUS_EVENTS_PER_ASSIGNMENT/);
  assert.match(statusRoute, /device_id = \?/);
  assert.match(statusRoute, /actionId/);
});

test("L12 release gate permanently checks schema parity and status-event bounds", () => {
  assert.match(readiness, /classification migration must add/);
  assert.match(readiness, /Drizzle schema must include/);
  assert.match(readiness, /local DB bootstrap must inspect legacy classification columns/);
  assert.match(readiness, /assignment status changes must be bounded/);
  assert.match(readiness, /duplicate assignment status transitions must be ignored/);
});
