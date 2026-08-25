# Kế hoạch sẵn sàng cho Firebase

## Trạng thái hiện tại

`BOIECH_AI` là ứng dụng full-stack, không phải website HTML tĩnh. Bản đang chạy có:

- giao diện và API Vinext chạy trong Cloudflare Worker;
- dữ liệu quan hệ, nhật ký, phiên học và phiên bản nội dung trong D1;
- ảnh chuyển khoản trong R2;
- khóa ký thiết bị lưu trong trình duyệt, mọi thao tác quan trọng được kiểm tra lại tại máy chủ;
- IndexedDB và service worker cho học offline, sau đó đồng bộ khi có mạng.

Vì vậy không được trỏ Firebase Hosting trực tiếp vào thư mục `public/` hoặc kết
quả giao diện. Làm như vậy chỉ hiển thị được một phần trang và sẽ làm hỏng đăng
ký, chấm bài 8/10, tiến độ, chứng chỉ, AI, thanh toán và duyệt nội dung.

## Kiến trúc Firebase đề xuất

Phương án ưu tiên cho giai đoạn chuyển đổi:

1. Chuyển Vinext về Next.js chuẩn và triển khai bằng Firebase App Hosting; hoặc
   giữ một backend container rồi dùng Firebase Hosting chuyển tiếp `/api/**`
   tới Cloud Run.
2. Thay D1 bằng lớp truy cập Cloud Firestore phía máy chủ. Không cho client ghi
   trực tiếp vào hồ sơ, điểm, quyền, thanh toán, phiên bản nội dung hay chứng chỉ.
3. Thay R2 bằng Cloud Storage for Firebase; ảnh chuyển khoản tiếp tục chỉ được
   đọc qua API có kiểm tra vai trò quản trị.
4. Giữ nguyên nguyên tắc khóa ký thiết bị và chống phát lại; có thể bổ sung
   Firebase App Check sau khi backend Firebase ổn định.
5. Duy trì IndexedDB/service worker cho học offline. Firestore offline không thay
   thế hàng đợi ký và idempotency hiện có của bài kiểm tra, tiến độ và thời gian học.

Tài liệu nền tảng chính thức:

- Firebase App Hosting và Next.js: <https://firebase.google.com/docs/app-hosting>
- Firebase Hosting kết hợp Cloud Run/Functions: <https://firebase.google.com/docs/hosting/serverless-overview>
- Mô hình dữ liệu Firestore: <https://firebase.google.com/docs/firestore/data-model>
- Cloud Storage for Firebase: <https://firebase.google.com/docs/storage>

## Ánh xạ dữ liệu dự kiến

| D1 hiện tại | Firebase đích | Ghi chú kiểm soát |
| --- | --- | --- |
| `device_access` | `learningDevices/{deviceId}` | Server-only cho trạng thái, nhóm, hạn dùng và thanh toán |
| `device_profiles` | `learningProfiles/{deviceId}` | Điểm và tiến độ chỉ cập nhật qua API |
| `course_activity_events` | `learningDevices/{deviceId}/activity/{eventId}` | Giữ `clientEventId` để chống ghi trùng khi đồng bộ offline |
| `course_content_versions` | `courseVersions/{versionId}` | Giữ luồng xin sửa → duyệt → xuất bản và lịch sử bất biến |
| `course_certificates` | `certificates/{verificationCode}` | Tách dữ liệu công khai khỏi dữ liệu cá nhân |
| `course_audit_log` | `auditLogs/{eventId}` | Chỉ ghi từ máy chủ, không cho sửa/xóa từ client |
| R2 `payment-proofs/*` | Cloud Storage `payment-proofs/*` | Không cấp URL công khai lâu dài |

## Các cổng kiểm soát trước khi chuyển dữ liệu thật

- Chọn chính xác Firebase Project ID và vùng gần người dùng Việt Nam.
- Tạo môi trường staging riêng; không thử migration trực tiếp trên dữ liệu thật.
- Viết bộ adapter Firestore/Storage và chạy lại toàn bộ kiểm thử hợp đồng.
- Xuất D1, chuyển đổi theo ánh xạ, đối chiếu số bản ghi và checksum.
- Chạy song song có kiểm soát, không tạo vòng lặp ghi hai chiều.
- Kiểm tra quyền quản trị, xóa/tạo lại thiết bị, thanh toán, chứng chỉ, học
  offline và quy trình xuất bản trước khi đổi tên miền.
- Có bản sao lưu và kế hoạch quay lại bản Cloudflare cho tới khi nghiệm thu xong.

## Những gì đã chuẩn bị trong bản nguồn này

- tên repo và tài liệu kiến trúc đã được chuẩn hóa thành `BOIECH_AI`;
- kiểu Cloudflare được khai báo rõ để TypeScript kiểm tra toàn bộ source;
- giới hạn tự động 60 ngày/20 thiết bị nằm ở máy chủ và có migration dữ liệu;
- luồng offline, idempotency, xác thực thiết bị và ranh giới quyền được giữ nguyên
  để có thể kiểm thử lại trên adapter Firebase.

Chỉ tạo `firebase.json`, `.firebaserc` hoặc kết nối dự án thật sau khi đã chọn
phương án App Hosting hay Hosting + Cloud Run. Việc trì hoãn các file này là có
chủ đích để không vô tình triển khai một bản giao diện thiếu backend.
