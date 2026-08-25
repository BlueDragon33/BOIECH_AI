import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("binds every control device to a non-exportable signing key and one-time challenge", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");
  const server = await readFile(new URL("../app/control-device.server.ts", import.meta.url), "utf8");

  assert.match(client, /namedCurve: "P-256"/);
  assert.match(client, /false, \["sign"\]/);
  assert.match(client, /learning-control:\$\{access\.deviceId\}:\$\{challenge\.challenge\}/);
  assert.match(server, /DELETE FROM control_challenges WHERE nonce = \? AND device_id = \?/);
  assert.match(server, /DELETE FROM control_challenges\s+WHERE device_id = \?/);
  assert.match(server, /ORDER BY rowid DESC LIMIT 8/);
  assert.doesNotMatch(server, /DELETE FROM control_challenges WHERE device_id = \?"\)\.bind\(deviceId\)/);
  assert.match(server, /crypto\.subtle\.verify/);
  assert.match(server, /DEVICE_MISMATCH/);
  assert.match(server, /existing\.email !== email/);
});

test("requires owner approval per device without disabling a user's other devices", async () => {
  const route = await readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");

  assert.match(route, /actorDevice\.role !== "owner"/);
  assert.match(route, /targetId === actorDevice\.deviceId \|\| await isOwnerEmail\(target\.email\)/);
  assert.match(route, /OWNER_DEVICE_PROTECTED/);
  assert.match(route, /UPDATE control_devices SET status = 'blocked'/);
  assert.doesNotMatch(route, /UPDATE control_members SET status = 'blocked'/);
  assert.match(client, /role: "reviewer"/);
  assert.match(client, /role: "publisher"/);
  assert.doesNotMatch(client, /role: "editor"/);
  assert.doesNotMatch(route, /\["editor", "reviewer", "publisher"\]/);
});

test("keeps editing rights on Boi Ech and migrates old central editors to reviewers", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0001_wild_joystick.sql", import.meta.url), "utf8");

  assert.match(client, /Quyền quản trị/);
  assert.match(client, /Người sửa bài không cần vào đây/);
  assert.doesNotMatch(client, />Biên tập<\/button>/);
  assert.match(migration, /CASE WHEN "role" = 'editor' THEN 'reviewer'/);
});

test("keeps management APIs behind a signed approved device", async () => {
  const dashboard = await readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  const content = await readFile(new URL("../app/api/content/route.ts", import.meta.url), "utf8");
  const bridge = await readFile(new URL("../app/boi-ech.server.ts", import.meta.url), "utf8");

  assert.match(dashboard, /verifyControlProof/);
  assert.match(content, /verifyControlProof/);
  assert.match(content, /CONTENT_REVIEW_ROLE_REQUIRED/);
  assert.match(dashboard, /issueBoiBrowserBridge\(actorDevice\.email, actorDevice\.role\)/);
  assert.match(bridge, /name: "HMAC", hash: "SHA-256"/);
  assert.match(bridge, /Date\.now\(\) \+ 5 \* 60 \* 1000/);
});

test("keeps lesson editing on Bơi ếch and only decisions in the control center", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(client, /action: "approve-edit"/);
  assert.match(client, /action: "deny-edit"/);
  assert.match(client, /action: "request-changes"/);
  assert.match(client, /action: "cancel"/);
  assert.match(client, /boiApi\(bridge, "\/api\/control\/content"/);
  assert.doesNotMatch(client, /action: "save-draft"|action: "create-draft"|action: "submit-review"/);
  assert.match(client, /Trung tâm không sửa bài học/);
  assert.match(client, /Cho phép sửa/);
  assert.match(client, /Yêu cầu sửa lại/);
  assert.match(client, /Đồng ý cập nhật/);
  assert.match(client, /SectionDiffReview/);
  assert.match(client, /Đã thay đổi/);
  assert.match(client, /Nhấn để xem bản cũ/);
  assert.match(client, /currentSection/);
  assert.match(client, /proposedSection/);
  assert.match(styles, /review-value\.field\.changed/);
  assert.match(styles, /previous-value/);
  assert.doesNotMatch(client, /function ContentStudio/);
});

test("loads Boi Ech directly in the browser without the timeout-prone server fetch", async () => {
  const dashboard = await readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  const bridge = await readFile(new URL("../app/boi-ech.server.ts", import.meta.url), "utf8");
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(dashboard, /callBoiEch/);
  assert.doesNotMatch(bridge, /fetch\(`\$\{baseUrl\}/);
  assert.match(client, /mode: "cors"/);
  assert.match(client, /credentials: "omit"/);
  assert.match(client, /boiApi\(currentDashboard\.boiBridge, "\/api\/control\/overview", \{ query: statusQuery \}\)/);
  assert.match(client, /60_000/);
  assert.match(client, /Có thiết bị mới chờ duyệt/);
});

test("keeps device cards stable, checks only known status every minute, and discovers on demand", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");

  assert.match(client, /function mergeLearningDevices/);
  assert.match(client, /if \(!statusOnly\) return update/);
  assert.match(client, /\.\.\.update/);
  assert.match(client, /deviceId: device\.deviceId/);
  assert.match(client, /deviceCode: device\.deviceCode/);
  assert.match(client, /mergeLearningDevices\(currentDevices, incomingDevices, discoverNew, !discoverNew\)/);
  assert.match(client, /discoverNew: false, quiet: true/);
  assert.match(client, /deviceCodes=/);
  assert.match(client, /discoverNew: true/);
  assert.match(client, /discoverNew\s*\? "\?activityDays=0"/);
  assert.match(client, /async function openDetail/);
  assert.match(client, /activityTimeline\.length >= 30/);
  assert.match(client, /Cập nhật thiết bị/);
  assert.match(client, /Trạng thái tự động · 60 giây\/lần/);
  assert.doesNotMatch(client, /15_000/);
});

test("shows signed online presence, offline time, and exact payment wording", async () => {
  const route = await readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  const deviceServer = await readFile(new URL("../app/control-device.server.ts", import.meta.url), "utf8");
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");

  assert.match(route, /CONTROL_PRESENCE_TIMEOUT_MS = 150_000/);
  assert.match(route, /offlineSinceAt/);
  assert.match(deviceServer, /UPDATE control_devices SET last_seen_at = CURRENT_TIMESTAMP/);
  assert.match(client, /Offline từ/);
  assert.match(client, /Tín hiệu thiết bị cuối/);
  assert.match(client, /paid_verified: "Đã trả phí"/);
  assert.match(client, /awaiting_payment: "Chưa thanh toán"/);
  assert.match(client, /proof_submitted: "Chưa thanh toán"/);
});

test("enforces a visible role matrix and can revoke an entire control account", async () => {
  const route = await readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");

  assert.match(route, /operation === "deactivate-member"/);
  assert.match(route, /UPDATE control_members SET status = 'inactive'/);
  assert.match(route, /UPDATE control_devices SET status = 'blocked'/);
  assert.match(route, /operation === "delete-member"/);
  assert.match(route, /target\.member_status !== "inactive"/);
  assert.match(route, /DELETE FROM control_challenges WHERE device_id IN/);
  assert.match(route, /DELETE FROM control_devices WHERE email = \?/);
  assert.match(route, /DELETE FROM control_members WHERE email = \? AND status = 'inactive'/);
  assert.match(client, /roleCapabilities/);
  assert.match(client, /Thu hồi tài khoản/);
  assert.match(client, /Xóa tài khoản/);
  assert.match(client, /Nhập chính xác email để xác nhận/);
  assert.match(client, /Không xuất bản, không xác minh thanh toán/);
});

test("manages registration, payment groups, proof review, and per-device activity charts", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");

  assert.match(client, /className: string \| null/);
  assert.match(client, /phone: string \| null/);
  assert.match(client, /accessGroup: "unassigned" \| "free" \| "paid"/);
  assert.match(client, /\/api\/control\/payment-proof/);
  assert.match(client, /Xem ảnh chuyển khoản/);
  assert.match(client, /operation, "grant-free"|action\("grant-free"/);
  assert.match(client, /action\("require-payment"/);
  assert.match(client, /action\("verify-payment"/);
  assert.match(client, /Biểu đồ 30 ngày gần nhất/);
  assert.match(client, /activityDays=30/);
  assert.match(client, /activityDays=0/);
  assert.match(client, /title="Lần đăng nhập"/);
  assert.match(client, /title="Thời gian làm bài"/);
  assert.match(client, /title="Lượt kiểm tra"/);
  assert.match(client, /title="Tiến độ"/);
});

test("keeps the last device list on sync failure and offers exact BE/QT code guidance", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");

  assert.match(client, /learningDevices: previous\?\.learningDevices \?\? \[\]/);
  assert.match(client, /searchParams|get.*deviceCode|deviceCode=/i);
  assert.match(client, /Mã chưa đúng định dạng/);
  assert.match(client, /normalized\.startsWith\("QT-"\)/);
  assert.match(client, /\^BE-/);
  assert.match(client, /Nhập mã dự phòng/);
  assert.match(client, /Thiết bị mới được quét khi bấm/);
});

test("shows a combined audit trail only to publishing roles", async () => {
  const route = await readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");

  assert.match(route, /FROM control_audit_log ORDER BY id DESC LIMIT 100/);
  assert.match(route, /\["publisher", "owner"\]\.includes\(actorDevice\.role\)/);
  assert.match(client, /const upstreamAudit/);
  assert.match(client, /\.\.\.upstreamAudit, \.\.\.currentDashboard\.auditLog/);
  assert.match(client, /Nhật ký hệ thống/);
  assert.match(client, /actionLabels/);
});

test("provides a complete operations inbox, payment exceptions, and recoverable account controls", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");

  assert.match(client, /Hộp việc cần xử lý/);
  assert.match(client, /Ảnh chuyển khoản/);
  assert.match(client, /Tài khoản hết hạn/);
  assert.match(client, /action\("reject-payment"/);
  assert.match(client, /action\("unblock"/);
  assert.match(client, /action\("reset-progress"/);
  assert.match(client, /learnerFamilyName/);
  assert.match(client, /learnerGivenName/);
  assert.match(client, /paymentReviewNote/);
  assert.match(client, /accessExpiringSoon/);
});

test("lets only the owner identify and permanently remove confirmed spam devices", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(client, /filter === "incomplete" \? !device\.registrationComplete/);
  assert.match(client, /Hồ sơ chưa đủ/);
  assert.match(client, /canDelete=\{access\.role === "owner"\}/);
  assert.match(client, /action\("delete-spam-device"/);
  assert.match(client, /confirmDeviceCode: deleteConfirmation/);
  assert.match(client, /deleteConfirmation\.trim\(\)\.toUpperCase\(\) !== device\.deviceCode/);
  assert.match(client, /dashboard\.learningDevices\.filter\(\(device\) => device\.deviceId !== data\.deletedDeviceId\)/);
  assert.match(client, /learning_device_deleted: "Xóa vĩnh viễn thiết bị rác"/);
  assert.match(client, /function DeletedDevicesPanel/);
  assert.match(client, /operation: "restore-deleted-device"/);
  assert.match(client, /Không thể tự đăng ký lại/);
  assert.match(styles, /\.device-danger-zone/);
  assert.match(styles, /\.deleted-devices-panel/);
  assert.match(styles, /\.profile-warning/);
});

test("exports operational backups and installs a privacy-safe offline shell", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const offline = await readFile(new URL("../public/offline.html", import.meta.url), "utf8");
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));

  assert.match(client, /exportDevices/);
  assert.match(client, /exportAudit/);
  assert.match(client, /bao-cao-thiet-bi-/);
  assert.match(client, /nhat-ky-quan-tri-/);
  assert.match(client, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.equal(manifest.display, "standalone");
  assert.match(serviceWorker, /SAFE_ASSETS/);
  assert.match(serviceWorker, /caches\.match\("\/offline\.html"\)/);
  assert.doesNotMatch(serviceWorker, /cache\.put/);
  assert.match(offline, /không lưu hồ sơ học viên/i);
});

test("adds a role-gated AI operations center without moving lesson editing into administration", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");
  const ai = await readFile(new URL("../app/ai-control-center.tsx", import.meta.url), "utf8");

  assert.match(client, /Điều hành AI/);
  assert.match(client, /\/api\/control\/ai/);
  assert.match(ai, /canReview = \["reviewer", "publisher", "owner"\]/);
  assert.match(ai, /canManage = \["publisher", "owner"\]/);
  assert.match(ai, /update-settings/);
  assert.match(ai, /set-device-ai/);
  assert.match(ai, /review-interaction/);
  assert.match(ai, /resolve-feedback/);
  assert.match(ai, /AI thị giác: Tắt/);
  assert.match(ai, /Xuất báo cáo AI/);
  assert.doesNotMatch(ai, /save-draft|approve-publish|sectionContent/);
});

test("controls automatic 60-day access and device-local editing without granting publish rights", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");

  assert.match(client, /Tự động duyệt quyền sửa cục bộ/);
  assert.match(client, /defaultAccessDays/);
  assert.match(client, /defaultDeviceLimit/);
  assert.match(client, /activeAutoFreeDeviceCount/);
  assert.match(client, /remainingAutoFreeDeviceSlots/);
  assert.match(client, /Số thiết bị tự động/);
  assert.match(client, /Number\(event\.target\.value\) \|\| 20/);
  assert.match(client, /defaultDeviceLimit: body\.defaultDeviceLimit/);
  assert.match(client, /Khi đủ hạn mức, hồ sơ mới chuyển sang chờ duyệt thủ công/);
  assert.match(client, /operation: "update-automation"/);
  assert.match(client, /action\("toggle-personal-edit"/);
  assert.match(client, /action\("renew-access"/);
  assert.match(client, /không gửi, không duyệt và không cập nhật nội dung máy chủ/);
  assert.match(client, /không thể cập nhật máy chủ/);
  assert.match(client, /personalEditConfigured/);
  assert.match(client, /device\.personRole === "teacher"/);
  assert.match(client, /<ContentReviewCenter[\s\S]*automation=\{dashboard\.automation\}/);
  assert.doesNotMatch(client.match(/function AutomationCenter[\s\S]*?\n}/)?.[0] ?? "", /approve-publish|content_published|save-draft/);
});

test("identifies pending learning devices by learner name and learner or service code", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");

  assert.match(client, /function pendingLearnerLabel\(device: LearningDevice\)/);
  assert.match(client, /return `\$\{name\} - \$\{code\}`/);
  assert.match(client, /added\.filter\(\(device\) => device\.status === "pending" && device\.registrationComplete\)\.map\(pendingLearnerLabel\)/);
  assert.match(client, /device\.status === "pending" \? pendingLearnerLabel\(device\) : device\.deviceCode/);
  assert.match(client, /Cho phép tạo hồ sơ mới/);
});

test("keeps install controls floating and layout stable across narrow screens", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(client, /className="install-fab"/);
  assert.doesNotMatch(client, /className="button install-control"/);
  assert.doesNotMatch(styles, /zoom:\s*var\(--admin-zoom/);
  assert.doesNotMatch(styles, /grid-template-columns:\s*82px/);
  assert.match(styles, /\.control-sidebar nav \{[^}]*overflow-x: auto/);
  assert.match(styles, /\.topbar-actions \{[^}]*flex-wrap: nowrap[^}]*overflow-x: auto/);
});

test("uses complete Vietnamese font stacks and offers device-local appearance controls", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.match(styles, /--admin-ui-font/);
  assert.match(styles, /--admin-heading-font/);
  assert.match(client, /Aa<\/b> Giao diện/);
  assert.match(client, /learning-control-appearance-v1/);
  assert.match(client, /Khôi phục mặc định/);
  assert.match(client, /Chỉ lưu trên máy quản trị hiện tại/);
});

test("retries an expired proof silently and never exposes the obsolete expiry toast", async () => {
  const client = await readFile(new URL("../app/control-center.tsx", import.meta.url), "utf8");
  const server = await readFile(new URL("../app/control-device.server.ts", import.meta.url), "utf8");

  assert.match(client, /attempt < 2/);
  assert.match(client, /error\.data\.code !== "DEVICE_PROOF_EXPIRED"/);
  assert.doesNotMatch(client, /Phiên xác thực thiết bị đã hết hạn/);
  assert.doesNotMatch(server, /Phiên xác thực thiết bị đã hết hạn/);
});
