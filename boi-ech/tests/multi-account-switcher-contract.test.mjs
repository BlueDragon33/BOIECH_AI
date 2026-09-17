import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const switcher = fs.readFileSync(new URL("../app/multi-account-switcher.tsx", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/device/route.ts", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/multi-account-switcher.css", import.meta.url), "utf8");

test("same browser can keep multiple signed account credentials without replacing server identity", () => {
  assert.match(switcher, /const ACCOUNT_PREFIX = "tai-khoan:"/);
  assert.match(switcher, /const ACTIVE_KEY = "chinh"/);
  assert.match(switcher, /generateCredential/);
  assert.match(switcher, /storeVaultRecord/);
  assert.match(switcher, /writeActiveCredential\(record\.credential\)/);
  assert.match(switcher, /Đăng ký tài khoản mới/);
  assert.match(switcher, /Học viên hoặc Giảng viên/);
});

test("account switching snapshots local progress and offline state per account", () => {
  for (const store of ["tien-do", "dong-bo", "ban-rieng", "thong-ke-hoc"]) {
    assert.ok(switcher.includes(`"${store}"`), `missing isolated store: ${store}`);
  }
  assert.match(switcher, /snapshotLocalState/);
  assert.match(switcher, /restoreLocalState/);
  assert.match(switcher, /progress\.clear\(\); offline\.clear\(\); personal\.clear\(\); study\.clear\(\)/);
  assert.match(switcher, /clearVideoHistoryForPrivacy/);
  assert.match(switcher, /boi-ech-video-ai-v1/);
});

test("logout opens a local account chooser instead of deleting prior account data", () => {
  assert.match(switcher, /window\.localStorage\.setItem\(SESSION_KEY, "logged-out"\)/);
  assert.match(switcher, /setChooserOpen\(true\)/);
  assert.match(switcher, /archiveActiveAccount\(metaFromDom\(\)\)/);
  assert.doesNotMatch(switcher, /deleteDatabase\(DB_NAME\)/);
  assert.match(css, /\.multi-account-overlay/);
});

test("additional accounts are forced back to pending for explicit admin approval", () => {
  assert.match(switcher, /boi-ech-additional-account-manual-review-v1/);
  assert.match(route, /ADDITIONAL_ACCOUNT_REVIEW_TOKEN/);
  assert.match(route, /Tài khoản bổ sung · chờ quản trị duyệt/);
  assert.match(route, /status = 'pending'/);
  assert.match(route, /access_group = 'unassigned'/);
  assert.match(route, /payment_status = 'unassigned'/);
  assert.match(route, /personal_edit_enabled = 0/);
  assert.match(route, /device\.label === ADDITIONAL_ACCOUNT_REVIEW_LABEL/);
});

test("root layout mounts the multi-account controller exactly once", () => {
  assert.match(layout, /import MultiAccountSwitcher from "\.\/multi-account-switcher"/);
  assert.match(layout, /import "\.\/multi-account-switcher\.css"/);
  assert.equal((layout.match(/<MultiAccountSwitcher \/>/g) ?? []).length, 1);
});
