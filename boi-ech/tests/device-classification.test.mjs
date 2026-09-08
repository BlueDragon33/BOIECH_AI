import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("classifies Boi Ech access devices without replacing BE identities", async () => {
  const metadata = await readFile(new URL("../app/device-metadata.server.ts", import.meta.url), "utf8");
  const deviceRoute = await readFile(new URL("../app/api/device/route.ts", import.meta.url), "utf8");
  const adminRoute = await readFile(new URL("../app/api/admin/devices/route.ts", import.meta.url), "utf8");
  const manager = await readFile(new URL("../app/quan-ly-thiet-bi/device-manager.tsx", import.meta.url), "utf8");

  assert.match(metadata, /"desktop" \| "phone" \| "tablet"/);
  assert.match(metadata, /ipadLike/);
  assert.match(metadata, /macintosh.*mobile/);
  assert.match(metadata, /UPDATE device_access/);
  assert.match(deviceRoute, /registerDevice\(payload\.publicKey, payload\.legacyToken, autoApprove\)/);
  assert.match(deviceRoute, /captureDeviceMetadata\(request, device\.deviceId\)/);
  assert.match(adminRoute, /d\.device_type, d\.platform, d\.browser/);
  assert.match(manager, /Máy tính bảng \/ iPad/);
  assert.match(manager, /Điện thoại/);
  assert.match(manager, /device\.deviceType/);
});
