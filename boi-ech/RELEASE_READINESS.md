# Bơi ếch — Release Readiness

Trạng thái này dùng để khóa chất lượng kỹ thuật trước khi cân nhắc triển khai production. Production **không tự động deploy**; workflow production chỉ chạy thủ công và yêu cầu chuỗi xác nhận rõ ràng.

## Các năng lực đã khép kín

- Học viên: lộ trình 8 bài, tiến độ, kiểm tra, Frog AI, Learner Model, bài luyện thích ứng và phân tích video local-first.
- Giảng viên: giám sát cùng lớp, nhận xét, giao bài, review AI, Learning Analytics trước/sau, Smart Intervention có human review, phản hồi hai chiều và lịch nhiệm vụ có hạn/trạng thái.
- Dữ liệu media: video/ảnh gốc không được đưa vào các API giám sát, nhắn tin hay lịch nhiệm vụ.
- Quyền: các thao tác Học viên/Giảng viên có dữ liệu server đều đi qua xác thực thiết bị; dữ liệu Giảng viên được giới hạn theo lớp phụ trách.
- Schema thiết bị: Drizzle schema, migration phân loại thiết bị và bootstrap database local/fresh phải giữ cùng bốn cột `device_type/platform/browser/user_agent`; bootstrap tự sửa database local cũ trước khi ghi metadata.
- Event nhiệm vụ: thay đổi trạng thái Học viên bỏ qua trạng thái trùng và bị giới hạn số lần đổi trên mỗi assignment để tránh log/event tăng vô hạn.
- Deploy: preview và production đều là workflow có chủ đích; production không chạy theo push.

## Gate bắt buộc

Từ thư mục `boi-ech/`:

```bash
npm ci
npm run validate:cloudflare-preview
npm run validate:release
npm run lint
npm test
```

PR thay đổi Bơi ếch phải qua validation và Cloudflare preview CI. Lệnh `validate:release` chặn các regression quan trọng như bật deploy production theo push, bỏ xác thực thiết bị, bỏ scope cùng lớp, tái xuất hiện placeholder nghiệp vụ đã thay bằng backend thật, hoặc đưa media gốc vào luồng giám sát.

## Production hold

Mọi thay đổi trong chuỗi phát triển hiện tại chỉ được merge vào GitHub. Không chạy workflow production cho đến khi chủ dự án chủ động quyết định triển khai.
