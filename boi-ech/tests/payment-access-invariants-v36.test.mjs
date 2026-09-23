import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const auth = fs.readFileSync(new URL("../app/device-auth.server.ts", import.meta.url), "utf8");
const control = fs.readFileSync(new URL("../app/api/control/overview/route.ts", import.meta.url), "utf8");

test("V36 manual free or paid classification is the safe default", () => {
  assert.match(auth, /auto_confirm_new_devices INTEGER NOT NULL DEFAULT 0/);
  assert.match(auth, /VALUES \('global', 0, 60, 20\)/);
  assert.match(auth, /system:payment-classification-migration/);
  assert.match(auth, /auto_confirm_new_devices = 1[\s\S]{0,160}updated_by IS NULL/);
});

test("V36 renewal cannot convert unfinished paid access into free access", () => {
  assert.match(control, /!\["free_approved", "paid_verified"\]\.includes\(current\.payment_status\)/);
  assert.match(control, /Chỉ gia hạn sau khi quyền miễn phí hoặc thanh toán đã được xác nhận/);
});

test("V36 personal edit cannot bypass pending paid verification", () => {
  assert.match(control, /enabled && current\.access_group === "paid" && current\.payment_status !== "paid_verified"/);
  assert.match(control, /hãy xác minh thanh toán trước khi bật quyền sửa nội dung/);
});
