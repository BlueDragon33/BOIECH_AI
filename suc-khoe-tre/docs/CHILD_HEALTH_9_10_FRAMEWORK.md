# Sức khỏe Y tế 9–10 tuổi — trạng thái hoàn thiện khung chức năng

## Kiến trúc đã khóa

- Web App `suc-khoe-tre` hoạt động độc lập.
- Thiết bị truy cập bằng khóa riêng, mã `SK-*`, phải được Trung tâm Quản trị cấp quyền.
- Hồ sơ, số đo, checklist, bữa ăn, vận động, chăm sóc, nhật ký và nhắc việc được lưu local-first trên thiết bị; không mặc định gửi về Trung tâm.
- Trung tâm chỉ quản lý thiết bị, quyền truy cập, tên gợi nhớ/phân loại, quyền sửa nội dung, quyền Google Calendar, kiểm duyệt và audit.
- Không dùng runtime/API/database nghiệp vụ của Bơi ếch.

## Điều hướng cấp 1

1. Hôm nay
2. Tăng trưởng
3. Dinh dưỡng
4. Vận động
5. Chăm sóc
6. Nhật ký
7. Hồ sơ & nhắc việc

## Chức năng đã có

- Checklist hằng ngày và tiến độ.
- Chọn ngày trước/hôm nay để xem và bổ sung dữ liệu lịch sử.
- Dải tổng hợp 7 ngày cho checklist, nước và vận động.
- Timeline chiều cao, cân nặng, BMI số học không tự phân loại.
- Checklist nhóm thực phẩm, nước và nhật ký bữa ăn.
- Nhật ký vận động theo loại và số phút.
- Giấc ngủ, răng miệng, nghỉ mắt, vệ sinh cá nhân.
- Nhật ký cảm nhận, triệu chứng và ghi chú diễn biến.
- Hiển thị tuổi tính từ ngày sinh và cảnh báo khi hồ sơ ngoài trọng tâm 9–10 tuổi, nhưng không khóa ghi dữ liệu.
- Reminder Engine: một lần, hằng ngày, thứ 2–6, hằng tuần.
- Browser Notification khi Web App đang hoạt động.
- Tải `.ics`.
- Google Calendar chỉ mở khi đúng thiết bị có `calendar_enabled=1`.
- Xuất/khôi phục bản sao JSON của dữ liệu local-first ngay trên thiết bị.

## Quản lý thiết bị từ Trung tâm

- Tự nhận diện desktop / phone / tablet/iPad.
- Tìm kiếm theo tên gợi nhớ, mã SK, nền tảng hoặc trình duyệt.
- Bộ lọc thiết bị chưa đặt tên để quản trị viên dễ phân loại.
- Đặt tên gợi nhớ cho từng thiết bị mà không cần nhận hồ sơ sức khỏe cá nhân.
- Quyền truy cập, quyền sửa và quyền Google Calendar tách riêng.

## Quyền Google Calendar

Migration `0002_calendar_permission.sql` thêm `calendar_enabled` vào `site_access_devices`.

Control API hỗ trợ:
- `enable-calendar`
- `disable-calendar`

Khi thiết bị bị khóa, `edit_enabled` và `calendar_enabled` đều bị thu hồi.

## Sao lưu local-first

Bản sao JSON dùng envelope `suc-khoe-y-te-9-10-backup-v1`. Khi khôi phục, dữ liệu được chuẩn hóa và giới hạn kích thước/trường hợp lệ trước khi đưa vào state cục bộ. Tệp sao lưu có thể chứa dữ liệu cá nhân nên chỉ được tạo/đọc theo thao tác trực tiếp của người dùng; không đi qua Control API.

## Giới hạn có chủ ý

- Browser Notification không được mô tả là nhắc nền khi Web App đã đóng. Khi cần nhắc đáng tin cậy lúc app đóng, dùng `.ics` hoặc Google Calendar.
- Chưa đồng bộ hồ sơ sức khỏe cá nhân lên server; baseline hiện tại ưu tiên local-first.
- Chưa thêm percentile tăng trưởng hoặc phân loại BMI trẻ; phần này phải dùng nguồn chuẩn và qua duyệt nội dung riêng.

## Gate trước merge

1. Sức khỏe Y tế: lint + build.
2. Bơi ếch: lint + build/test.
3. Trung tâm Quản trị: build.
4. Kiểm tra lịch sử ngày và backup/restore.
5. Kiểm tra pending/approved/blocked.
6. Kiểm tra Calendar khóa/mở đúng quyền thiết bị.
7. Kiểm tra tìm kiếm/đặt tên/phân loại thiết bị.
8. Kiểm tra responsive desktop/phone/tablet.
9. Chỉ merge `main` khi toàn bộ gate PASS.
