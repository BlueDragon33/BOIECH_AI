import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin device type override is stored separately from automatic detection", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0016_device_type_override.sql", import.meta.url), "utf8");
  const auth = await readFile(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");

  assert.match(schema, /deviceTypeOverride: text\("device_type_override"\)/);
  assert.match(migration, /ADD COLUMN `device_type_override` text/);
  assert.match(auth, /device_type_override TEXT/);
  assert.match(auth, /ALTER TABLE device_access ADD COLUMN device_type_override TEXT/);
  assert.match(auth, /deviceType: deviceTypeOverride \?\? detectedDeviceType/);
});

test("admin can select auto desktop phone or tablet without changing BE identity", async () => {
  const route = await readFile(new URL("../app/api/admin/devices/route.ts", import.meta.url), "utf8");
  const manager = await readFile(new URL("../app/quan-ly-thiet-bi/device-manager.tsx", import.meta.url), "utf8");

  assert.match(route, /action === "device-type"/);
  assert.match(route, /\["auto", "desktop", "phone", "tablet"\]/);
  assert.match(route, /SET device_type_override = \?, updated_at = CURRENT_TIMESTAMP/);

  assert.match(manager, /deviceTypeOverride: DeviceType \| null/);
  assert.match(manager, /device\.deviceTypeOverride \?\? "auto"/);
  assert.match(manager, /<option value="auto">Tự động/);
  assert.match(manager, /<option value="desktop">Máy tính<\/option>/);
  assert.match(manager, /<option value="phone">Điện thoại<\/option>/);
  assert.match(manager, /<option value="tablet">Máy tính bảng \/ iPad<\/option>/);
  assert.match(manager, /act\("device-type", device\.deviceId\)/);
});

test("presence refreshes detected metadata then re-reads canonical effective classification", async () => {
  const route = await readFile(new URL("../app/api/device/route.ts", import.meta.url), "utf8");

  const presence = route.indexOf('if (action === "presence")');
  const capture = route.indexOf("await captureDeviceMetadata(request, device.deviceId)", presence);
  const canonical = route.indexOf("getPublicDeviceState(device.deviceId)", capture);

  assert.ok(presence >= 0);
  assert.ok(capture > presence);
  assert.ok(canonical > capture);
});

test("admin list exposes detected override and effective device types", async () => {
  const route = await readFile(new URL("../app/api/admin/devices/route.ts", import.meta.url), "utf8");

  assert.match(route, /detectedDeviceType/);
  assert.match(route, /deviceTypeOverride/);
  assert.match(route, /deviceType: deviceTypeOverride \?\? detectedDeviceType/);
  assert.match(route, /d\.device_type_override/);
});
