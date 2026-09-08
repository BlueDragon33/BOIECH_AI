# Release checklist — Sức khỏe Y tế 9–18 tuổi V3

## 1. Thiết bị & Control Plane
- Thiết bị mới xuất hiện ở Trung tâm với mã SK riêng.
- Phân loại desktop / phone / tablet đúng.
- Pending không vào được app.
- Approved vào được app.
- Blocked/revoked mất truy cập.
- Thu hồi phiên làm app đóng quyền ở heartbeat kế tiếp.
- Policy tạm dừng ứng dụng có hiệu lực.
- Khi block, quyền sửa và Google Calendar bị thu hồi.
- Không có hồ sơ sức khỏe cá nhân trong payload audit/control.
- Device approval không được coi là quyền đọc từng profile.

## 2. Phạm vi tuổi
- 108–227 tháng được xem là phạm vi sản phẩm.
- 9–10 → Nền tảng thói quen.
- 11–12 → Tiền dậy thì.
- 13–15 → Vị thành niên sớm.
- 16–18 → Vị thành niên muộn / chuẩn bị đại học.
- Ngoài phạm vi không tự áp dụng khuyến nghị 9–18.
- 18 tuổi vẫn dùng BMI-for-age trong phạm vi đã khóa; không tự chuyển sang ngưỡng BMI người lớn.

## 3. Framework catalog V3
- Có đúng 22 miền chức năng.
- Mỗi miền có navArea, stage, privacy class và capabilities.
- Miền rất nhạy cảm có guardrail.
- Có đủ 6 miền bổ sung V3: vitals/screening, injury/sports, school function, chronic/care plan, substance use, family/social protective context.
- Transition to adult care chỉ dành cho stage 16–18.
- 7 điều hướng chính không bị phình thành menu theo từng module nhỏ.

## 4. Tracking architecture
- `health-tracking-catalog.ts` tồn tại và có cadence/source/importance/privacy.
- Không có overall health score.
- Guideline-driven item yêu cầu jurisdiction/version.
- Daily tracking không ép trẻ khỏe mạnh đo chỉ số y tế hằng ngày.
- Symptoms/injuries dùng episode model.
- Reminder và Due Engine được coi là hai khái niệm khác nhau.
- Data Completeness không được diễn giải thành sức khỏe tốt/xấu.
- Attention Queue giới hạn ưu tiên, tránh alert fatigue.

## 5. Tăng trưởng
- WHO validation PASS cho 108–227 tháng, đủ 120 dòng mỗi giới.
- Tuổi được tính tại đúng ngày đo.
- BMI-for-age dùng đúng giới tính và tháng tuổi.
- Số đo lịch sử không bị đánh giá bằng tuổi hiện tại.
- Thiếu ngày sinh/giới tính/số đo hợp lệ → không tự xếp loại.

## 6. Record contracts / provenance
- Có contract cho vitals, screening, clinical tests.
- Có condition/problem list, family history, procedure/hospitalization và care plan.
- Có medication list + administration log + allergy.
- Có vaccination/preventive/appointment/document.
- Có symptom episode + injury episode.
- Có school function, wellbeing, substance use, social/protective context.
- Record quan trọng hỗ trợ source / verification / recordedByProfileId.
- Không tự coi self-entered data là clinician-confirmed.

## 7. Dữ liệu local-first & secure storage
- Reload không mất dữ liệu đã triển khai.
- Migration từ key 9–10 cũ không phá hủy dữ liệu.
- Backup 9–18 đọc được backup 9–10 legacy.
- Dữ liệu ngày mới tách khỏi ngày trước.
- Xóa một bản ghi chỉ tác động đúng bản ghi.
- Không có request gửi hồ sơ, thuốc, tâm lý, dậy thì hoặc tài liệu y tế sang Control API.
- Không kích hoạt persistence Highly Sensitive mới trên plaintext localStorage nếu chưa có privacy/security review.
- Sensitive notification mặc định phải redacted/generic.

## 8. Profile privacy / proxy
- `deviceApprovalIsNotProfileAuthorization=true`.
- Có vai trò self / caregiver / trusted-helper ở cấp hồ sơ.
- Có visibility profile-shared / caregiver-only / youth-private / emergency-card-only.
- Không hard-code tuổi đồng ý pháp lý.
- Highly-sensitive có thể yêu cầu unlock riêng.
- Export/share ra ngoài phải explicit và có scope.
- Emergency card là dataset tối thiểu riêng, không phải toàn hồ sơ.

## 9. Evidence governance
- Evidence Registry có jurisdiction.
- Evidence Registry có reviewedAt và reviewDueAt.
- WHO Growth/GAMA/Adolescent Health có trong registry.
- Nguồn Việt Nam cho school health và immunization có trong registry.
- AAP/Bright Futures chỉ là nguồn đối chiếu quốc tế, không làm lịch mặc định Việt Nam.
- Rule chuyên môn phải trỏ tới evidence/version trước khi bật alert.

## 10. Reminder & Calendar
- One-time hoạt động.
- Daily hoạt động.
- Weekdays hoạt động.
- Weekly hoạt động.
- Browser Notification xử lý granted/denied/unsupported.
- `.ics` tải được và có recurrence đúng.
- Google Calendar bị khóa khi thiết bị chưa được cấp quyền.
- Google Calendar chỉ mở khi quyền thiết bị hợp lệ và người dùng chủ động thao tác.

## 11. Riêng tư
- Nội dung standard/sensitive/highly-sensitive được gắn đúng class.
- Dậy thì, sức khỏe tinh thần, substance use, sinh sản, thuốc/dị ứng, bệnh nền/care plan, clinical results và tài liệu y tế không xuất hiện công khai mặc định.
- Site Quản trị chỉ thấy metadata vận hành, không thấy nội dung sức khỏe cá nhân.
- Không có `/admin` hoặc iframe quản trị trong Web App.

## 12. Responsive & accessibility
- Desktop sidebar không che nội dung.
- Phone dùng bottom navigation.
- Framework map hoạt động desktop/mobile.
- Form không tràn màn hình.
- Trạng thái focus/disabled/selected nhìn rõ.
- Nội dung nhạy cảm không bị đưa vào thông báo lock-screen mặc định.

## 13. CI bắt buộc
- `npm run validate:growth` PASS.
- `npm run validate:framework` PASS.
- `suc-khoe-tre`: lint PASS.
- `suc-khoe-tre`: build PASS.
- `boi-ech`: lint PASS.
- `boi-ech`: build/test PASS.
- `quan-ly-hoc-tap`: build PASS.
- Chỉ merge `main` khi toàn bộ gate PASS.

## 14. Production
- Dedicated Child Health Worker deploy PASS.
- D1 migrations PASS.
- Device Gate hoạt động trên production.
- Control Center đọc đúng trạng thái runtime.
- Không có regression làm Bơi ếch hoặc Trung tâm Quản trị lỗi.
