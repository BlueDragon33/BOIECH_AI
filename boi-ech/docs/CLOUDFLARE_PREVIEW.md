# Bơi ếch — Cloudflare Preview

## Mục tiêu

Kiểm chứng Account-first V2 trên Cloudflare Free trước khi thay đổi production hiện tại. GitHub là source of truth. Local, preview và production phải dùng tài nguyên dữ liệu tách biệt. Preview này không kích hoạt subscription R2; nghiệm thu ảnh chuyển khoản vẫn là một gate riêng chưa hoàn tất.

## Tài nguyên preview

- Worker: `boi-ech-preview`
- D1: `boi-ech-preview-db`
- GitHub Environment: `boi-ech-preview`
- Workflow: `.github/workflows/deploy-boi-ech-preview.yml`

Không cấu hình R2 trong Account-first Preview. Prepare, scaffold và generated-artifact gate đều chặn R2 bị thêm lại để tránh buộc kích hoạt subscription. Các route ảnh chuyển khoản tiếp tục fail-closed với `PAYMENT_STORAGE_UNAVAILABLE` khi thiếu `BUCKET`; không dùng DB/ảnh Production thay thế, không trả thành công giả và không coi luồng này đã nghiệm thu.

## GitHub Environment cần cấu hình

Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `BOI_ECH_PREVIEW_D1_DATABASE_ID`
- `BOI_ECH_PRODUCTION_D1_DATABASE_ID` — chỉ dùng đối chiếu để chặn nhầm DB Production
- `CONTROL_SERVICE_SECRET` — cùng secret app-scoped mà Application Management preview sẽ dùng cho Bơi ếch

Variables:

- `APPLICATION_MANAGEMENT_PREVIEW_ORIGIN` — bắt buộc, HTTPS origin chính xác của Application Management preview, khác origin Bơi ếch.
- `BOI_ECH_PREVIEW_ORIGIN` — bắt buộc trước triển khai, HTTPS origin của Worker Preview hiện hữu; dùng cho Account-first origin guard và smoke test.

Không đưa giá trị secret/D1 ID thật vào repository.

## Tạo tài nguyên Cloudflare

Cần một D1 riêng tên `boi-ech-preview-db`, khác DB Production và App Preview. Không tạo R2 bucket hoặc nâng gói. Nếu tài khoản Free đã đủ 10 D1, phải giải quyết capacity bằng phương án được Owner duyệt trước; không xóa/tái sử dụng DB đang có binding để vượt gate. Xóa tài khoản người dùng không giải phóng suất D1.

## Chạy preview deploy

GitHub → Actions → `Boi Ech Cloudflare Preview Deploy` → Run workflow → nhập chính xác `DEPLOY_PREVIEW`.

Workflow sẽ:

1. yêu cầu `DEPLOY_PREVIEW` và đủ secret/origin;
2. cài dependency, materialize Wrangler config Preview tạm thời không có R2;
3. đọc inventory để xác nhận đúng tên/UUID D1 Preview trước khi ghi;
4. build bằng Preview bindings và kiểm tra artifact, gồm D1 riêng và không có R2;
5. apply migration chỉ vào `boi-ech-preview-db`;
6. deploy Worker `boi-ech-preview`, cài `CONTROL_SERVICE_SECRET`, kiểm tra artifact rồi deploy lại;
7. kiểm tra HTTP cơ bản tại origin Preview. HTTP trả lời không thay thế nghiệm thu Owner/MFA/đồng bộ.

Source CI lint/typecheck/test/build, backup/migration từ dữ liệu cũ và human review là các điều kiện riêng phải có bằng chứng trước khi cho triển khai. App Preview workflow đang DORMANT vẫn cần phê duyệt trước khi bật; không dùng hướng dẫn này để bỏ qua `if: false` hoặc protection rules.

## E2E gate trước production

- Thiết bị mới đăng ký vào preview và nhận mã `BE-...`.
- Thiết bị xuất hiện ở Application Management preview.
- Duyệt/khóa/thanh toán/chỉnh sửa cá nhân tác động vào D1 preview, không vào production.
- Với Account-first Preview không có R2, `paymentStorageReady=false` là trạng thái dự kiến, không phải bằng chứng phần thanh toán PASS. Nghiệm thu upload/read ảnh chuyển khoản vẫn BLOCKED và cần phương án riêng được duyệt trước full release.
- Tiến độ, bài kiểm tra, offline queue và đồng bộ lại hoạt động.
- Refresh/sync tại Application Management chỉ đọc trạng thái; không tự mutation.
- `GET /api/control/status` bằng service credential trả đúng deployment channel/revision, D1 hoạt động và `paymentStorageReady=false` đúng thực tế của Preview này.

Chỉ sau nghiệm thu thật và reviewer độc lập mới xem xét merge/phát hành tại SHA được Owner duyệt. Production workflow tiếp tục yêu cầu xác nhận thủ công `DEPLOY_PRODUCTION`; không tự mở auto-deploy.

## Control-plane canonical

`BlueDragon33/Application-Management` là Trung tâm quản trị duy nhất. Mã nguồn `quan-ly-hoc-tap/` trong repo BOIECH_AI chỉ còn là lịch sử/migration source và không có workflow deploy riêng.
