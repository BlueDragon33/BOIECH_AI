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
  assert.match(auth, /device_type, platform, browser/);
  assert.match(auth, /deviceType: row\.device_type === "phone" \|\| row\.device_type === "tablet"/);

  assert.match(metadata, /return \{ deviceType, platform, browser \}/);
  assert.match(route, /const metadata = await captureDeviceMetadata\(request, device\.deviceId\)/);
  assert.match(route, /device = \{ \.\.\.device, \.\.\.metadata \}/);

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
