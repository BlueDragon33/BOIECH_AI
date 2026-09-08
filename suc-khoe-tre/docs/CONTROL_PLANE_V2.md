# Sức khỏe Y tế — Control Plane v2

## Mục tiêu

Hoàn thiện kết nối giữa Web App `suc-khoe-tre` và Trung tâm Quản trị trước khi phát triển sâu nghiệp vụ sức khỏe.

## Ranh giới bắt buộc

### Web App Sức khỏe Y tế sở hữu

- hồ sơ trẻ;
- chiều cao, cân nặng và lịch sử theo dõi;
- checklist hằng ngày;
- dinh dưỡng, nước, bữa ăn;
- vận động, chăm sóc, nhật ký;
- nhắc việc cá nhân và bản sao local-first.

Các dữ liệu trên không được mặc định chuyển sang Trung tâm Quản trị.

### Trung tâm Quản trị chỉ điều khiển

- thiết bị truy cập;
- trạng thái `pending / approved / blocked`;
- tên gợi nhớ và phân loại thiết bị;
- quyền chỉnh sửa;
- quyền Google Calendar;
- phiên truy cập;
- policy vận hành;
- thông báo hệ thống vận hành;
- kiểm duyệt nội dung;
- audit.

## Luồng truy cập

```text
Thiết bị mới
   ↓
Tạo khóa ECDSA P-256 trên thiết bị
   ↓
Đăng ký SK Device
   ↓
PENDING
   ↓ Trung tâm cấp quyền
APPROVED
   ↓
Challenge + chữ ký thiết bị
   ↓
Kiểm tra global access policy
   ↓
Tạo Access Session có TTL
   ↓
Tải nội dung Web App
   ↓
Heartbeat = chữ ký thiết bị + sessionId
```

Khi thiết bị bị `BLOCKED`, toàn bộ phiên còn active của thiết bị bị thu hồi và quyền sửa/Google Calendar được tắt.

## Phiên truy cập

Bảng `site_access_sessions` lưu thông tin vận hành tối thiểu:

- session id;
- device id;
- started / last seen / expires;
- active / revoked / expired;
- thời điểm, người và lý do thu hồi.

Không lưu dữ liệu sức khỏe trong phiên.

## Policy

Bảng singleton `site_control_policy` quản lý:

- `access_enabled`;
- `pending_poll_seconds`;
- `heartbeat_seconds`;
- `session_timeout_seconds`;
- `session_ttl_minutes`;
- `system_notice_enabled`;
- `system_notice`.

Chỉ role `owner` được sửa policy.

## Control API

Các endpoint phía Sức khỏe Y tế:

- `GET /api/control/status`
- `GET|POST /api/control/devices`
- `GET|POST /api/control/sessions`
- `GET|POST /api/control/policy`
- `GET /api/control/audit`
- `GET|POST /api/control/health-content`

Tất cả endpoint chỉ chấp nhận service secret hoặc vé HMAC ngắn hạn do Trung tâm Quản trị phát hành.

## Vé quản trị

Vé trình duyệt có TTL 5 phút và được ràng buộc với:

- issuer `quan-ly-hoc-tap`;
- audience `child-health-control`;
- app `child-health`;
- actor;
- role;
- `controlDeviceId`;
- `jti`;
- `iat / exp`.

Health bridge được phát hành từ `health-bridge.server.ts`, không còn phụ thuộc đường phát vé của Bơi ếch trong luồng Sức khỏe Y tế v2.

## Control Center v2

Màn quản trị Sức khỏe Y tế có 7 vùng:

1. Tổng quan
2. Thiết bị & quyền
3. Phiên truy cập
4. Chính sách
5. Nhật ký
6. Duyệt nội dung
7. Phiên bản

Màn quản trị cũ được giữ trong mã nguồn để rollback, nhưng route Sức khỏe Y tế chuyển sang `HealthControlCenterV2`.

## Quy tắc thu hồi

- Khóa thiết bị → thu hồi mọi session + tắt edit + tắt Calendar.
- Thu hồi một session → Web App đóng nội dung ở heartbeat kế tiếp.
- Thu hồi mọi session của thiết bị → tất cả cửa sổ đang chạy trên credential đó mất phiên.
- `access_enabled = false` → Web App không được tạo/duy trì truy cập mới sau lần kiểm tra policy tiếp theo.

## Gate trước merge

- Sức khỏe Y tế: lint PASS + build PASS.
- Trung tâm Quản trị: build PASS.
- Bơi ếch: lint PASS + build/test PASS.
- Migration `0003_control_plane.sql` áp dụng được trên D1.
- Kiểm tra pending → approved → session.
- Kiểm tra revoke session.
- Kiểm tra block device thu hồi session và quyền tính năng.
- Kiểm tra policy pause/resume.
- Kiểm tra Google Calendar vẫn chỉ mở trên thiết bị được cấp quyền.
- Không có dữ liệu sức khỏe cá nhân trong payload Control Plane.
