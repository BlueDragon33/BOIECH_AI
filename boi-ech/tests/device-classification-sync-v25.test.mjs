import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("device classification is synchronized from server metadata into the authorized learner shell", async () => {
  const auth = await readFile(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");
  const metadata = await readFile(new URL("../app/device-metadata.server.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/device/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(auth, /export type DeviceType = "desktop" \| "phone" \| "tablet"/);
  assert.match(auth, /deviceType: DeviceType/);
  assert.match(auth, /device_type, device_type_override, platform, browser/);
  assert.match(auth, /deviceType: deviceTypeOverride \?\? detectedDeviceType/);

  assert.match(metadata, /return \{ deviceType, platform, browser \}/);
  assert.match(route, /await captureDeviceMetadata\(request, device\.deviceId\)/);
  assert.match(route, /getPublicDeviceState\(device\.deviceId\)/);

  const capture = route.indexOf("await captureDeviceMetadata(request, device.deviceId)");
  const canonical = route.indexOf("getPublicDeviceState(device.deviceId)", capture);
  assert.ok(capture >= 0);
  assert.ok(canonical > capture);

  assert.match(page, /deviceType: "desktop" \| "phone" \| "tablet"/);
  assert.match(page, /data-device-id=\{deviceAccess\.deviceId\}/);
  assert.match(page, /data-device-type=\{deviceAccess\.deviceType\}/);
  assert.match(page, /data-device-platform=\{deviceAccess\.platform \?\? ""\}/);
  assert.match(page, /data-device-browser=\{deviceAccess\.browser \?\? ""\}/);
});

test("device classification remains attached to the BE identity rather than viewport-only detection", async () => {
  const auth = await readFile(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(auth, /deviceId: row\.device_id/);
  assert.match(auth, /deviceCode: row\.display_code/);
  assert.match(page, /data-device-id=\{deviceAccess\.deviceId\}/);
  assert.match(page, /data-device-type=\{deviceAccess\.deviceType\}/);
});
