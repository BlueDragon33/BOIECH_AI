import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("auto-confirms complete new learners as free for a bounded default period", async () => {
  const schema = await read("../db/schema.ts");
  const auth = await read("../app/device-auth.server.ts");
  const overview = await read("../app/api/control/overview/route.ts");
  const migration = await read("../drizzle/0011_superb_vector.sql");

  assert.match(schema, /autoConfirmNewDevices/);
  assert.match(schema, /defaultAccessDays.*default\(60\)/);
  assert.match(auth, /shouldAutoConfirm/);
  assert.match(auth, /status = 'approved', access_group = 'free', payment_status = 'free_approved'/);
  assert.match(auth, /personal_edit_enabled = 1/);
  assert.match(overview, /action === "update-automation"/);
  assert.match(overview, /action === "renew-access"/);
  assert.match(overview, /action === "toggle-personal-edit"/);
  assert.match(migration, /CREATE TABLE `access_automation_settings`/);
  assert.match(migration, /ALTER TABLE `device_access` ADD `personal_edit_enabled`/);
});

test("keeps personal lesson edits local and outside every publish workflow", async () => {
  const studio = await read("../app/local-content-studio.tsx");
  const page = await read("../app/page.tsx");

  assert.match(studio, /BẢN RIÊNG TRÊN THIẾT BỊ/);
  assert.match(studio, /không gửi tới Trung tâm/);
  assert.doesNotMatch(studio, /fetch\(|XMLHttpRequest|\/api\//);
  assert.match(page, /objectStoreNames\.contains\("ban-rieng"\)/);
  assert.match(page, /writeLocalContent/);
  assert.match(page, /deviceAccess\?\.personalEditEnabled/);
  assert.doesNotMatch(studio, /publish|approve-publish|submit-review/i);
});

test("records active offline study idempotently and syncs it when connectivity returns", async () => {
  const page = await read("../app/page.tsx");
  const route = await read("../app/api/course/route.ts");
  const coach = await read("../app/offline-study-coach.tsx");

  assert.match(page, /action: "offline-session"/);
  assert.match(page, /clientEventId = `offline:\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(page, /void flushOfflineQueue\(\)/);
  assert.match(route, /action === "offline-session"/);
  assert.match(route, /clientEventAlreadyApplied/);
  assert.match(route, /6 \* 60 \* 60/);
  assert.match(route, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(coach, /AI cục bộ/);
  assert.match(coach, /Không camera/);
  assert.doesNotMatch([page, route, coach].join("\n"), /getUserMedia|MediaStream|face-api|pose estimation/i);
});

test("issues only server-verified completion certificates without exposing phone numbers", async () => {
  const route = await read("../app/api/certificate/route.ts");
  const certificatePage = await read("../app/chung-chi/page.tsx");
  const migration = await read("../drizzle/0011_superb_vector.sql");

  assert.match(route, /verifyDeviceRequest/);
  assert.match(route, /LESSONS\.every/);
  assert.match(route, /Number\(scores\[lesson\]\) >= 8/);
  assert.match(route, /verificationCode/);
  assert.doesNotMatch(route.match(/function publicCertificate[\s\S]*?\n}/)?.[0] ?? "", /phone/i);
  assert.match(certificatePage, /In \/ Lưu PDF/);
  assert.match(certificatePage, /Giảng viên có thể mở lại đúng liên kết/);
  assert.match(migration, /CREATE TABLE `course_certificates`/);
});

test("explains automatic learning telemetry instead of collecting it covertly", async () => {
  const page = await read("../app/page.tsx");
  assert.match(page, /Thời gian và tiến độ học được tự động ghi nhận/);
  assert.match(page, /Ứng dụng tự ghi nhận thời gian hoạt động/);
});
