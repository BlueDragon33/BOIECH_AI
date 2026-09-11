# Bơi ếch — Cloudflare Preview

## Mục tiêu

Kiểm chứng đầy đủ Bơi ếch trên Cloudflare trước khi thay đổi production hiện tại. GitHub là source of truth. Local, preview và production phải dùng tài nguyên dữ liệu tách biệt.

## Tài nguyên preview

- Worker: `boi-ech-preview`
- D1: `boi-ech-preview-db`
- R2: `boi-ech-preview-payments`
- GitHub Environment: `boi-ech-preview`
- Workflow: `.github/workflows/deploy-boi-ech-preview.yml`

R2 preview là bắt buộc vì luồng ảnh chuyển khoản đọc/ghi binding `BUCKET`; chỉ deploy D1 mà không có R2 sẽ làm chức năng thanh toán thiếu backend.

## GitHub Environment cần cấu hình

Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `BOI_ECH_PREVIEW_D1_DATABASE_ID`
- `CONTROL_SERVICE_SECRET` — cùng secret app-scoped mà Application Management preview sẽ dùng cho Bơi ếch

Variables:

- `APPLICATION_MANAGEMENT_PREVIEW_ORIGIN` — HTTPS origin chính xác của Application Management preview; có thể để trống ở lần bootstrap đầu, nhưng browser Control API sẽ fail-closed cho tới khi cấu hình và redeploy.
- `BOI_ECH_PREVIEW_ORIGIN` — HTTPS origin của Worker preview sau lần deploy đầu tiên; dùng cho smoke test.

Không đưa giá trị secret/D1 ID thật vào repository.

## Tạo tài nguyên Cloudflare

Tạo một D1 mới tên `boi-ech-preview-db` và một R2 bucket mới tên `boi-ech-preview-payments`. D1 ID preview tuyệt đối không được bằng production D1 `boi-ech-db`.

## Chạy preview deploy

GitHub → Actions → `Boi Ech Cloudflare Preview Deploy` → Run workflow → nhập chính xác `DEPLOY_PREVIEW`.

Workflow sẽ:

1. chạy migration regression gate, lint và test;
2. materialize Wrangler config preview tạm thời;
3. apply migration chỉ vào `boi-ech-preview-db`;
4. build bằng preview bindings;
5. kiểm tra artifact không chứa production D1;
6. deploy Worker `boi-ech-preview`;
7. cài/rotate `CONTROL_SERVICE_SECRET`;
8. smoke-test public runtime và Control API nếu đã cấu hình `BOI_ECH_PREVIEW_ORIGIN`.

## E2E gate trước production

- Thiết bị mới đăng ký vào preview và nhận mã `BE-...`.
- Thiết bị xuất hiện ở Application Management preview.
- Duyệt/khóa/thanh toán/chỉnh sửa cá nhân tác động vào D1 preview, không vào production.
- Ảnh chuyển khoản được lưu/đọc từ `boi-ech-preview-payments`.
- Tiến độ, bài kiểm tra, offline queue và đồng bộ lại hoạt động.
- Refresh/sync tại Application Management chỉ đọc trạng thái; không tự mutation.
- `GET /api/control/status` bằng service credential trả đúng deployment channel/revision và `paymentStorageReady=true`.

Chỉ sau khi toàn bộ gate trên pass mới xem xét mở lại deployment production tự động. Trong giai đoạn migration, production workflow yêu cầu xác nhận thủ công `DEPLOY_PRODUCTION`.

## Control-plane canonical

`BlueDragon33/Application-Management` là Trung tâm quản trị duy nhất. Mã nguồn `quan-ly-hoc-tap/` trong repo BOIECH_AI chỉ còn là lịch sử/migration source và không có workflow deploy riêng.
