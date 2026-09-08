# Sức khỏe Y tế 9–18 tuổi — Bộ khung A–Z V3

## 1. Phạm vi sản phẩm

Sức khỏe Y tế là Web App độc lập theo dõi và hỗ trợ hình thành năng lực tự chăm sóc sức khỏe từ 9 tuổi đến hết 18 tuổi 11 tháng.

Ứng dụng không phải HIS/EMR bệnh viện, không tự chẩn đoán, không tự kê đơn và không thay thế bác sĩ/cấp cứu.

Control Plane đã khóa:
- Site Quản trị quản lý thiết bị, quyền app, phiên, policy, audit, quyền Calendar và quy trình duyệt nội dung.
- Device approval không tương đương quyền đọc từng hồ sơ sức khỏe.
- Hồ sơ sức khỏe cá nhân không mặc định được gửi sang Site Quản trị.
- Không nhúng UI/runtime Site Quản trị vào Web App.
- Không dùng runtime/API/database nghiệp vụ của Bơi ếch.

## 2. Điều hướng cấp 1 — giữ gọn 7 khu vực

1. **Hôm nay** — việc cần làm, due queue, checklist, reminder, tổng hợp nhanh.
2. **Tăng trưởng** — số đo, WHO BMI-for-age, timeline phát triển.
3. **Dinh dưỡng** — nhóm thực phẩm, bữa ăn, nước, thói quen ăn uống.
4. **Vận động** — hoạt động thể lực, chấn thương/thể thao, lịch sử.
5. **Chăm sóc** — ngủ, dậy thì, răng/da/vệ sinh, mắt/tai/tư thế, sức khỏe số, an toàn, quan hệ & ranh giới.
6. **Nhật ký** — cảm xúc, symptom episodes, học tập/chức năng, substance-use/private check-ins, timeline sự kiện.
7. **Hồ sơ** — bệnh nền/tiền sử, thuốc/dị ứng, dấu hiệu sinh tồn/sàng lọc, phòng ngừa/tiêm chủng, lịch khám/tài liệu, privacy, backup, chuyển tiếp tuổi trưởng thành.

Không tạo 22 tab cấp 1.

## 3. Bốn giai đoạn phát triển

### 9–10 tuổi — Nền tảng thói quen
Ăn uống, nước, vận động, ngủ, răng miệng, vệ sinh, mắt/tư thế, an toàn, chức năng học đường và chuẩn bị kiến thức thay đổi cơ thể.

### 11–12 tuổi — Tiền dậy thì
Thay đổi cơ thể, vệ sinh tuổi dậy thì, dinh dưỡng tăng trưởng, ngủ, cảm xúc, an toàn cá nhân, chức năng học tập, giáo dục ranh giới cá nhân phù hợp tuổi.

### 13–15 tuổi — Vị thành niên sớm
Tăng trưởng tuổi dậy thì, sức khỏe tinh thần, quan hệ xã hội, sức khỏe số, dinh dưỡng/hình ảnh cơ thể, substance-use prevention, sức khỏe sinh sản phù hợp tuổi và tăng dần năng lực tự quản lý.

### 16–18 tuổi — Vị thành niên muộn / chuẩn bị đại học
Tự quản lý hồ sơ, thuốc/dị ứng, lịch khám, tài liệu, emergency card, stress học tập, giấc ngủ, sức khỏe sinh sản, privacy choices, chuẩn bị sống xa gia đình và chuyển tiếp sang chăm sóc người lớn.

## 4. 22 miền chức năng

1. Tăng trưởng & phát triển thể chất.
2. Dấu hiệu sinh tồn, sàng lọc & kết quả kiểm tra.
3. Dinh dưỡng & nước.
4. Vận động & thể lực.
5. Chấn thương, thể thao & cơ xương khớp.
6. Giấc ngủ & phục hồi.
7. Dậy thì & thay đổi cơ thể.
8. Sức khỏe tinh thần & cảm xúc.
9. Học tập, chú ý & chức năng học đường.
10. Răng miệng, da & vệ sinh cá nhân.
11. Mắt, tai, tư thế & sức khỏe học đường.
12. Phòng ngừa, khám định kỳ & tiêm chủng.
13. Triệu chứng, bệnh cấp & sơ cứu.
14. Bệnh nền, tiền sử & kế hoạch chăm sóc.
15. Thuốc, dị ứng & thông tin cần nhớ.
16. Sức khỏe số & thói quen màn hình.
17. An toàn & phòng tránh nguy cơ.
18. Thuốc lá/vape, rượu bia, chất gây nghiện & hành vi nguy cơ.
19. Quan hệ, ranh giới cá nhân & sức khỏe sinh sản.
20. Gia đình, môi trường sống & yếu tố bảo vệ.
21. Hồ sơ, lịch hẹn & tài liệu y tế.
22. Tự quản lý sức khỏe & chuyển tiếp tuổi trưởng thành.

Nguồn sự thật: `health-domain-catalog.ts`.

## 5. A–Z kiến trúc

### A — Access Gate
Thiết bị phải được Site Quản trị cấp quyền. Gate chỉ mở app, không thay thế profile authorization.

### B — Backup
Sao lưu có schema/version; dữ liệu rất nhạy cảm cần chiến lược encryption trước khi persistence production.

### C — Calendar
Reminder Engine → browser notification → `.ics` → Google Calendar. Calendar cần cả quyền thiết bị và OAuth của người dùng.

### D — Daily Engine
Một nguồn dữ liệu theo ngày cho checklist, bữa ăn, nước, vận động, ngủ và thói quen. Triệu chứng/chấn thương không ép vào daily note mà ưu tiên Episode Engine.

### E — Evidence Registry
Mọi ngưỡng/chỉ tiêu/alert chuyên môn phải có source, jurisdiction, version, reviewedAt và reviewDueAt.

### F — Framework Catalog
Danh mục chức năng tập trung, không hard-code rải rác.

### G — Growth Engine
Tuổi tại ngày đo → giới tính → WHO LMS → BMI-for-age/z-score. Không dùng tuổi hiện tại cho số đo lịch sử.

### H — Health Profile
Ngày sinh, giới tính cho growth reference, tiền sử, bệnh nền, dị ứng, thuốc, care plan, emergency information và quyền hồ sơ.

### I — Indexed Timeline
Một timeline tổng hợp số đo, episode, thuốc, lịch khám, vaccine, tài liệu và sự kiện quan trọng; không trộn với admin audit.

### J — Journal
Nhật ký cảm xúc/ghi chú/chức năng; private-by-default khi thuộc highly-sensitive domain.

### K — Knowledge Layers
Nội dung giáo dục chia theo 4 giai đoạn tuổi; cập nhật qua quy trình kiểm duyệt nhưng runtime app độc lập.

### L — Local-first / Health-owned storage
Dữ liệu sức khỏe thuộc Sức khỏe Y tế. Highly-sensitive không nên tiếp tục phụ thuộc plaintext localStorage khi triển khai sâu; cần secure vault/storage layer.

### M — Medication, Allergy & Care Plan
Danh sách thuốc, nhật ký dùng/bỏ lỡ, dị ứng, problem list và care plan. Không tự chọn thuốc/liều/chẩn đoán.

### N — Notification
Xử lý granted/denied/unsupported; notification nhạy cảm phải redacted/generic theo privacy policy.

### O — Offline/PWA
Cho phép shell và dữ liệu phù hợp offline nhưng không bypass revoke vô hạn và không cache plaintext nhạy cảm ngoài policy.

### P — Privacy / Proxy / Profile Authorization
Tách quyền thiết bị khỏi quyền hồ sơ. Hỗ trợ caregiver/self/trusted helper, visibility theo record và chế độ private section; không hard-code tuổi đồng ý pháp lý.

### Q — Quality & Data Quality Gates
Lint, build, WHO validation, framework validation, provenance, privacy boundary, responsive/accessibility, device/profile access regression trước merge.

### R — Reminder + Due Engine
Reminder = người dùng đặt giờ. Due Engine = việc đến hạn theo tuổi/guideline/quốc gia/hồ sơ/care plan. Không trộn hai khái niệm.

### S — Safety / Screening
Không tự chẩn đoán, kê đơn hay suy diễn xét nghiệm. Screening adapter phải có age range, validation, language/licensing và follow-up path.

### T — Tracking / Trend / Transition
Tracking Catalog quy định cadence; Trend Engine ưu tiên xu hướng; 16–18 có transition readiness nhưng không tự chuyển sang adult mode.

### U — User Autonomy
Tuổi lớn dần chuyển từ caregiver-managed sang shared/self-management theo privacy policy, không phá dữ liệu cũ.

### V — Vaccination / Preventive Care
Rule phải versioned và jurisdiction-aware. Không dùng lịch nước khác làm mặc định cho hồ sơ Việt Nam.

### W — Wellbeing / Protective Factors
Cảm xúc, stress, sleep, school function, social support, trusted adult và barriers được theo dõi tối thiểu, tự nguyện, không tạo social score.

### X — eXport / Explicit Share Package
JSON baseline; sau này PDF/CSV/FHIR adapter nếu cần. Share package phải chọn mục đích, phạm vi, thời hạn và mặc định loại highly-sensitive.

### Y — Youth-specific / Youth-private
Không tái sử dụng nguyên nội dung người lớn; dậy thì/tâm lý/substance use/reproductive health có chế độ xem riêng tư và guardrail riêng.

### Z — Zero Admin Embedding / Zero Overall Health Score
Không `/admin`, không iframe Admin, không shared router quản trị. Không tạo một “điểm sức khỏe tổng” gây hiểu sai.

## 6. Các engine dùng chung sau audit

```text
Profile / Age Stage / Profile Privacy
        │
        ├── Growth Engine
        ├── Daily Engine
        ├── Episode Engine
        ├── Journal Engine
        ├── Reminder Engine
        ├── Due Engine
        ├── Tracking Catalog
        ├── Trend Engine
        ├── Timeline Engine
        ├── Data Completeness Engine
        ├── Attention Queue
        ├── Evidence Registry
        └── Provenance / Data Quality
```

Không tạo scheduler/checklist/timeline riêng cho từng module nếu engine chung xử lý được.

## 7. Cadence — theo dõi sát nhưng không overtracking

- **Daily:** thói quen, dinh dưỡng/nước khi cần, vận động, ngủ, thuốc theo schedule.
- **Weekly summary:** wellbeing nhẹ, screen habit, school function, xu hướng lifestyle.
- **Scheduled:** growth measurement, emergency card review, transition readiness.
- **Guideline-driven:** preventive visit, vaccine, BP/pulse, vision/hearing, validated screening.
- **Event-driven:** symptoms, injury, allergy reaction, menstrual events, clinic visit, hospitalization, bullying/safety event.
- **On-change:** conditions, allergies, care plan, emergency contact.
- **Clinician-directed:** medication regimen and condition-specific monitoring.

Nguồn sự thật: `health-tracking-catalog.ts`.

## 8. Mức riêng tư

### Standard
Vận động, nước, checklist thói quen, ngủ ở mức thói quen.

### Sensitive
Tăng trưởng, triệu chứng, chấn thương, school function, preventive care, safety.

### Highly-sensitive
Mental health, puberty/menstrual, substance use, reproductive health, medication/allergy, conditions/care plans, clinical results/documents, social context, health passport.

Highly-sensitive phải có guardrail và profile privacy policy.

## 9. Nguồn dữ liệu / provenance

Record quan trọng phải phân biệt:
- self;
- caregiver;
- school record;
- clinician document;
- device;
- import.

Kèm verification: unverified / documented / clinician-confirmed khi phù hợp.

## 10. Lộ trình triển khai sâu sau Audit V3

### P0 nền tảng
1. Profile Privacy/Proxy Engine.
2. Secure sensitive storage design.
3. Tracking Catalog integration.
4. Episode Engine.
5. Due Engine contract.
6. Data Completeness + Attention Queue.
7. Provenance/Data Quality.
8. Evidence versioning/jurisdiction.

### P1 clinical-record foundation
1. Vital/sign screening records.
2. Chronic conditions/care plans.
3. Medication administration/allergy reaction.
4. Preventive/vaccine records.
5. Injury/sports episodes.
6. School-health import.

### P2 deep adolescent modules
1. Nutrition/body-image safety.
2. Sleep.
3. Puberty/menstrual.
4. Mental wellbeing + validated adapters.
5. Substance-use adapter.
6. Relationships/reproductive health.
7. Family/social protective context.

### P3 transition/interoperability
1. Health passport 16–18.
2. Explicit share packages.
3. Encrypted Health-backend sync.
4. Multi-device conflict resolution.
5. PDF/CSV/FHIR adapter nếu thực sự cần.

Mỗi lượt stop-on-error, có test evidence, không merge main khi gate chưa pass.

## 11. Acceptance criteria V3

- 7 navigation chính.
- 22 domains có stage/privacy/capability/guardrail phù hợp.
- 4 age stages rõ ràng.
- Tracking Catalog định nghĩa cadence và source.
- Growth WHO 108–227 tháng vẫn pass.
- Có record contracts cho vitals/screening/tests/conditions/care plans/injuries/medication adherence/vaccine/symptom episodes/school function/substance/social context.
- Device Gate tách Profile Authorization.
- Preventive rules jurisdiction-aware.
- Highly-sensitive private-aware và không gửi Admin.
- Có thiết kế Due/Completeness/Attention/Trend/Episode.
- Không overall health score.
- Không overtracking trẻ khỏe mạnh.
- CI pass trước merge/deploy.
