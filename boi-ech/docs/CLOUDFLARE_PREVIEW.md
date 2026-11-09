# Bơi ếch — Cloudflare Preview

## Mục tiêu

Kiểm chứng Account-first V2 trên Cloudflare Free trước khi thay đổi production hiện tại. GitHub là source of truth. Local, preview và production phải dùng tài nguyên dữ liệu tách biệt. Preview này không kích hoạt subscription R2; nghiệm thu ảnh chuyển khoản vẫn là một gate riêng chưa hoàn tất.

## Tài nguyên preview

- Worker: `boi-ech-preview`
- D1: `boi-ech-preview-db`, hoặc đúng `bauman-control-preview-db` đã được Owner cho dùng tạm ngày 08/11/2026; UUID được khóa trong `scripts/preview-d1-policy.mjs`. Dùng sổ `boi_ech_preview_migrations` riêng, giữ nguyên bảng Bauman.
- Worker quản trị: `application-management-preview`, D1 `application-management-preview-db` hiện hữu.
- GitHub Environment: `boi-ech-preview`
- Workflow: `.github/workflows/deploy-boi-ech-preview.yml`

Không cấu hình R2 trong Account-first Preview. Prepare, scaffold và generated-artifact gate đều chặn R2 bị thêm lại để tránh buộc kích hoạt subscription. Các route ảnh chuyển khoản tiếp tục fail-closed với `PAYMENT_STORAGE_UNAVAILABLE` khi thiếu `BUCKET`; không dùng DB/ảnh Production thay thế, không trả thành công giả và không coi luồng này đã nghiệm thu.

## GitHub Environment cần cấu hình

Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Variables:

- `BOI_ECH_PREVIEW_D1_DATABASE_NAME`, `BOI_ECH_PREVIEW_D1_DATABASE_ID`
- `BOI_ECH_PRODUCTION_D1_DATABASE_ID` — chỉ dùng đối chiếu để chặn nhầm DB Production
- `APPLICATION_MANAGEMENT_PREVIEW_D1_DATABASE_ID`, `APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID`
- `CONTROL_OWNER_EMAILS` — đúng tài khoản Chủ hệ thống đang dùng, không dùng email mẫu.
- `APPLICATION_MANAGEMENT_PREVIEW_ORIGIN` — bắt buộc, HTTPS origin chính xác của Application Management preview, khác origin Bơi ếch.
- `BOI_ECH_PREVIEW_ORIGIN` — bắt buộc trước triển khai, HTTPS origin của Worker Preview hiện hữu; dùng cho Account-first origin guard và smoke test.

Không đưa secret hoặc email Owner vào repository. UUID D1 là metadata nhận diện tài nguyên, không thay cho credential.

## Tạo tài nguyên Cloudflare

Cần D1 khác Production và App Preview. Tài khoản Free đã đủ 10 D1; Owner đã cho dùng tạm Bauman Preview sau khi sao lưu. Worker Bauman Preview phải có cả hai URL bị tắt và không còn binding D1; provider preflight kiểm tra lại trước ghi SQL. Không xóa database, không tạo R2 bucket hoặc nâng gói. Xóa tài khoản người dùng không giải phóng suất D1.

## Chạy preview deploy

GitHub → Actions → `Boi Ech Cloudflare Preview Deploy` → chọn đúng nhánh candidate đã kiểm thử → Run workflow → nhập `DEPLOY_PREVIEW` và `INSTALL_PREVIEW_BRIDGE`, sau đó duyệt Environment được bảo vệ. Lượt chạy này triển khai cả hai Preview; không chạy workflow Production.

Workflow sẽ:

1. yêu cầu hai xác nhận, đủ credential/metadata/origins và duyệt Environment;
2. checkout App tại commit cố định trong workflow, chạy full regression của cả hai dự án;
3. materialize config, xác nhận tên/UUID D1 và bảo vệ truy cập App hiện có;
4. build và kiểm tra cả hai artifact trước mọi ghi SQL;
5. apply migration chỉ vào hai D1 Preview, dùng sổ migration riêng cho D1 dùng tạm;
6. deploy hai Worker Preview, giữ nguyên secret truy cập và khóa mã hóa kho App;
7. sinh một khóa bridge ngẫu nhiên, cài chỉ vào hai Worker Preview, không in/lưu khóa trong artifact; đọc lại channel/SHA/binding, gọi Bơi Ếch Control status thật, kiểm tra App trả 401 cho truy cập JSON chưa xác thực.

Source tests/build, backup, code review và duyệt Environment vẫn bắt buộc. Workflow App riêng tiếp tục DORMANT; yêu cầu triển khai mới nhất của Owner được thực hiện qua gói hai Preview có commit App cố định và một cổng duyệt. HTTP/metadata PASS không thay thế nghiệm thu Owner/MFA/đồng bộ. Nếu lỗi giữa chừng, hai Preview có thể khác phiên bản; lượt chạy phải báo lỗi và xử lý tiếp, không suy ra Production đạt.

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
