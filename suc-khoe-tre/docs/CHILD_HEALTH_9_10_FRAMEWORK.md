# Sức khỏe Y tế 9–10 tuổi — trạng thái hoàn thiện khung chức năng

## Kiến trúc đã khóa

- Web App `suc-khoe-tre` hoạt động độc lập.
- Thiết bị truy cập bằng khóa riêng, mã `SK-*`, phải được Trung tâm Quản trị cấp quyền.
- Hồ sơ, số đo, checklist, bữa ăn, vận động, chăm sóc, nhật ký và nhắc việc được lưu local-first trên thiết bị; không mặc định gửi về Trung tâm.
- Trung tâm chỉ quản lý thiết bị, quyền truy cập, quyền sửa nội dung, quyền Google Calendar, kiểm duyệt và audit.
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
- Timeline chiều cao, cân nặng, BMI số học không tự phân loại.
- Checklist nhóm thực phẩm, nước và nhật ký bữa ăn.
- Nhật ký vận động theo loại và số phút.
- Giấc ngủ, răng miệng, nghỉ mắt, vệ sinh cá nhân.
- Nhật ký cảm nhận, triệu chứng và ghi chú diễn biến.
- Reminder Engine: một lần, hằng ngày, thứ 2–6, hằng tuần.
- Browser Notification khi Web App đang hoạt động.
- Tải `.ics`.
- Google Calendar chỉ mở khi đúng thiết bị có `calendar_enabled=1`.

## Quyền Google Calendar

Migration `0002_calendar_permission.sql` thêm `calendar_enabled` vào `site_access_devices`.

Control API hỗ trợ:
- `enable-calendar`
- `disable-calendar`

Khi thiết bị bị khóa, `edit_enabled` và `calendar_enabled` đều bị thu hồi.

## Giới hạn có chủ ý

- Browser Notification không được mô tả là nhắc nền khi Web App đã đóng. Khi cần nhắc đáng tin cậy lúc app đóng, dùng `.ics` hoặc Google Calendar.
- Chưa đồng bộ hồ sơ sức khỏe cá nhân lên server; baseline hiện tại ưu tiên local-first.
- Chưa thêm percentile tăng trưởng hoặc phân loại BMI trẻ; phần này phải dùng nguồn chuẩn và qua duyệt nội dung riêng.

## Gate trước merge

1. Sức khỏe Y tế: lint + build.
2. Bơi ếch: lint + build/test.
3. Trung tâm Quản trị: build.
4. Kiểm tra migration D1.
5. Kiểm tra pending/approved/blocked.
6. Kiểm tra Calendar khóa/mở đúng quyền thiết bị.
7. Kiểm tra responsive desktop/phone/tablet.
8. Chỉ merge `main` khi toàn bộ gate PASS.
