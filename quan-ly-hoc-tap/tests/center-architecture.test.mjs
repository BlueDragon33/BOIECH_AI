import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the central control plane separate from application operations", async () => {
  const hub = await readFile(new URL("../app/application-hub.tsx", import.meta.url), "utf8");
  const centerRoute = await readFile(new URL("../app/api/center/route.ts", import.meta.url), "utf8");
  const boiRoute = await readFile(new URL("../app/apps/boi-ech/page.tsx", import.meta.url), "utf8");

  assert.match(hub, /Tổng quan/);
  assert.match(hub, /Ứng dụng/);
  assert.match(hub, /Thiết bị & quyền/);
  assert.match(hub, /Nhật ký & bảo mật/);
  assert.match(hub, /Trung tâm cấp quyền và điều phối/);
  assert.match(hub, /Thiết bị học của từng ứng dụng phải quản lý bên trong ứng dụng đó/);

  assert.match(centerRoute, /verifyControlProof/);
  assert.match(centerRoute, /action === "manage-control-device"/);
  assert.match(centerRoute, /actorDevice\.role !== "owner"/);
  assert.doesNotMatch(centerRoute, /issueBoiBrowserBridge|issueHealthBrowserBridge|\/api\/control\/overview|payment|learningDevices/);

  assert.match(boiRoute, /ControlCenter/);
  assert.match(boiRoute, /\/apps\/boi-ech/);
});

test("uses one application registry to define scope and prevent cross-app mixing", async () => {
  const registry = await readFile(new URL("../app/application-registry.ts", import.meta.url), "utf8");
  const hub = await readFile(new URL("../app/application-hub.tsx", import.meta.url), "utf8");

  assert.match(registry, /id: "boi-ech"/);
  assert.match(registry, /id: "child-health"/);
  assert.match(registry, /id: "bauman-master-ai"/);
  assert.match(registry, /Không cấp quyền thiết bị quản trị trung tâm/);
  assert.match(registry, /Không dùng API\/DB Bơi ếch/);
  assert.match(registry, /Không mở thẳng Site Bauman từ Trung tâm/);
  assert.match(registry, /status: "planned"/);

  assert.match(hub, /getApplicationConfig/);
  assert.match(hub, /Mở khu quản trị riêng/);
  assert.doesNotMatch(hub, /boiApi|upstreamJson|payment-proof|health-content/);
});

test("requires explicit confirmation for destructive central account removal", async () => {
  const hub = await readFile(new URL("../app/application-hub.tsx", import.meta.url), "utf8");
  const centerRoute = await readFile(new URL("../app/api/center/route.ts", import.meta.url), "utf8");

  assert.match(hub, /window\.confirm/);
  assert.match(hub, /window\.prompt/);
  assert.match(hub, /Nhập chính xác email để xác nhận/);
  assert.match(centerRoute, /target\.member_status !== "inactive"/);
  assert.match(centerRoute, /CONTROL_MEMBER_MUST_BE_INACTIVE/);
  assert.match(centerRoute, /OWNER_DEVICE_PROTECTED/);
  assert.match(centerRoute, /control_audit_log/);
});
