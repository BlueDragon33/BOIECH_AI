# Multi-child Profile & Youth Privacy — V3

## Mục tiêu

Một thiết bị có thể theo dõi nhiều con nhưng tuyệt đối không trộn timeline, reminder, tài liệu, privacy hoặc export giữa các hồ sơ.

## 1. Tách ba lớp quyền

```text
Site Quản trị
└── Device/App Access
        ↓
Sức khỏe Y tế
└── Profile Registry
        ↓
Profile Authorization
        ↓
Record Visibility
```

- Site Quản trị chỉ quyết định thiết bị có được mở app không.
- Profile Registry quyết định thiết bị/người dùng đang thao tác hồ sơ nào.
- Profile Authorization quyết định vai trò self/caregiver/trusted-helper.
- Record Visibility quyết định standard/sensitive/highly-sensitive có được hiển thị/chỉnh sửa/xuất hay không.

## 2. Multi-child

Mỗi trẻ có `profileId` ổn định.

Mọi record tương lai phải gắn `profileId`:
- growth;
- daily;
- reminders;
- symptoms;
- medication;
- allergies;
- appointments;
- documents;
- wellbeing;
- puberty;
- substance-use;
- transition readiness.

Không dùng “active child” như một biến UI rồi lưu record không có profileId.

## 3. Migration single profile → multi profile

State hiện tại là single-profile baseline. Migration phải:
1. tạo một `profileId` mới cho hồ sơ hiện có;
2. gắn toàn bộ dữ liệu legacy vào profile đó;
3. giữ nguyên storage key legacy để rollback;
4. không tạo hồ sơ trùng khi chạy migration lần hai;
5. backup mới vẫn đọc được backup cũ;
6. regression test timeline/reminder/export không trộn profile.

## 4. Vai trò

- `self`: chính trẻ/vị thành niên tự quản lý;
- `caregiver`: cha/mẹ/người giám hộ;
- `trusted-helper`: người được chia sẻ giới hạn.

Không hard-code tuổi pháp lý để tự động tước/cấp quyền. Quy tắc pháp lý phải tách thành jurisdiction policy.

## 5. Record visibility

- `profile-shared`
- `caregiver-only`
- `youth-private`
- `emergency-card-only`

Highly-sensitive có thể private-by-default khi profile bật private sections.

## 6. Notification privacy

Sensitive/Highly-sensitive notification mặc định nên là generic hoặc redacted, ví dụ:

`Bạn có một nhắc việc sức khỏe.`

thay vì hiển thị tên thuốc, triệu chứng tâm lý hoặc nội dung sinh sản trên lock screen.

## 7. Emergency Card

Emergency Card là dataset tối thiểu riêng:
- tên ưu tiên;
- ngày sinh nếu cần;
- liên hệ khẩn cấp;
- dị ứng nghiêm trọng;
- thuốc quan trọng;
- bệnh nền quan trọng;
- care-plan reference.

Không coi Emergency Card là bản sao toàn hồ sơ.

## 8. Export / sharing

Mặc định export theo `profileId`, không xuất tất cả trẻ cùng một file.

Share package phải có:
- purpose;
- domains được chia sẻ;
- highly-sensitive mặc định excluded;
- thời hạn nếu là link/token;
- người tạo;
- thời điểm tạo.

## 9. Acceptance criteria

- Không record nào trong mô hình mới thiếu profileId.
- Không đổi child selector làm record cũ “chuyển” sang trẻ khác.
- Timeline, reminder, backup, export đều profile-scoped.
- Device approval không cho phép đọc mọi profile.
- Highly-sensitive obey profile privacy.
- Admin Center không nhận profile health content.
