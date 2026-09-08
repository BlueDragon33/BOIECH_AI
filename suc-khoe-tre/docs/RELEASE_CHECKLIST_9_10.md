# Release checklist — Sức khỏe Y tế 9–10 tuổi

## Thiết bị
- Thiết bị mới xuất hiện ở Trung tâm với mã SK riêng.
- Phân loại desktop / phone / tablet đúng.
- Pending không vào được app.
- Approved vào được app.
- Blocked mất truy cập.
- Khi block, quyền sửa và Google Calendar bị thu hồi.

## Dữ liệu local-first
- Reload trang không mất hồ sơ, số đo, checklist, bữa ăn, vận động, nhật ký và reminders.
- Dữ liệu ngày mới tách khỏi ngày trước.
- Xóa một bản ghi chỉ tác động đúng bản ghi.
- Không có request gửi hồ sơ cá nhân sang Control API.

## Reminder
- One-time hoạt động.
- Daily hoạt động.
- Weekdays hoạt động.
- Weekly hoạt động.
- Browser Notification chỉ báo là hoạt động khi app đang chạy.
- `.ics` tải được và có RRULE đúng khi lặp.
- Google Calendar bị disabled khi `calendar_enabled=0`.
- Google Calendar mở được khi `calendar_enabled=1`.

## Responsive
- Desktop sidebar không che nội dung.
- Phone dùng bottom navigation.
- Form không tràn màn hình.
- Danh sách reminders và timeline xuống hàng đúng.

## CI
- `suc-khoe-tre`: lint PASS.
- `suc-khoe-tre`: build PASS.
- `boi-ech`: lint PASS.
- `boi-ech`: build/test PASS.
- `quan-ly-hoc-tap`: build PASS.
