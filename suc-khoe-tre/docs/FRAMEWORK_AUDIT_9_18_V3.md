# Sức khỏe Y tế 9–18 tuổi — Audit toàn bộ khung V3

Ngày rà soát: 2026-09-08

## 1. Kết luận audit

Khung V2 đã bao phủ tốt các chủ đề lớn nhưng chưa đủ để **theo dõi sát, không bỏ sót và tạo hiệu quả lâu dài**. Khoảng trống chính không còn là thiếu menu mà là thiếu các lớp vận hành theo dõi:

1. thiếu dấu hiệu sinh tồn/kết quả sàng lọc và xét nghiệm có nguồn;
2. thiếu bệnh nền, tiền sử và care plan;
3. thiếu chấn thương/thể thao/cơ xương;
4. thiếu chức năng học tập, chú ý và hỗ trợ học đường;
5. chất gây nghiện đang bị gộp quá sâu trong Safety;
6. thiếu yếu tố gia đình/xã hội/yếu tố bảo vệ;
7. symptom tracking mới thiên về daily note, chưa phải episode;
8. chưa có tracking cadence/catalog chung;
9. chưa có data completeness / due engine / attention queue;
10. chưa có profile-level privacy/consent/proxy model giữa phụ huynh và trẻ lớn;
11. localStorage chỉ phù hợp baseline, chưa đủ cho dữ liệu rất nhạy cảm hoặc theo dõi đa thiết bị;
12. evidence registry mới mạnh ở tăng trưởng, chưa đủ nguồn cho preventive/adolescent health;
13. chưa có provenance/verification thống nhất cho dữ liệu tự nhập, trường học và cơ sở y tế;
14. chưa có cơ chế tránh alert fatigue và tránh tạo “điểm sức khỏe” gây hiểu sai.

## 2. Khung chức năng sau audit

Giữ 7 navigation chính nhưng catalog tăng từ 16 lên 22 miền:

1. Tăng trưởng & phát triển thể chất
2. Dấu hiệu sinh tồn, sàng lọc & kết quả kiểm tra
3. Dinh dưỡng & nước
4. Vận động & thể lực
5. Chấn thương, thể thao & cơ xương khớp
6. Giấc ngủ & phục hồi
7. Dậy thì & thay đổi cơ thể
8. Sức khỏe tinh thần & cảm xúc
9. Học tập, chú ý & chức năng học đường
10. Răng miệng, da & vệ sinh cá nhân
11. Mắt, tai, tư thế & sức khỏe học đường
12. Phòng ngừa, khám định kỳ & tiêm chủng
13. Triệu chứng, bệnh cấp & sơ cứu
14. Bệnh nền, tiền sử & kế hoạch chăm sóc
15. Thuốc, dị ứng & thông tin cần nhớ
16. Sức khỏe số & thói quen màn hình
17. An toàn & phòng tránh nguy cơ
18. Thuốc lá/vape, rượu bia, chất gây nghiện & hành vi nguy cơ
19. Quan hệ, ranh giới cá nhân & sức khỏe sinh sản
20. Gia đình, môi trường sống & yếu tố bảo vệ
21. Hồ sơ, lịch hẹn & tài liệu y tế
22. Tự quản lý sức khỏe & chuyển tiếp tuổi trưởng thành

Nguồn sự thật: `health-domain-catalog.ts`.

## 3. Lớp theo dõi cần có để “theo dõi sát”

### 3.1 Tracking Catalog

Mỗi dữ liệu phải biết:
- thuộc domain nào;
- áp dụng giai đoạn tuổi nào;
- cadence: daily / weekly-summary / scheduled / guideline-driven / event-driven / on-change / clinician-directed;
- nguồn: self / caregiver / school / clinic / device / import;
- mức quan trọng;
- mức riêng tư;
- alert có cần evidence không.

Nguồn sự thật: `health-tracking-catalog.ts`.

### 3.2 Trend Engine

Không đánh giá dựa một điểm nếu bài toán cần xu hướng.

Trend cần hỗ trợ:
- 7 ngày;
- 30 ngày;
- 3 tháng;
- 6 tháng;
- 1 năm;
- toàn lịch sử.

Không tạo một “Health Score” chung.

### 3.3 Episode Engine

Các dữ liệu sau phải chuyển từ note rời rạc sang episode:
- sốt/ho/đau bụng/đau đầu;
- chấn thương;
- dị ứng/phản ứng;
- đợt bệnh nền;
- vấn đề tâm lý cần theo dõi;
- sự kiện bắt nạt/bạo lực khi người dùng muốn ghi.

Episode phải có start, diễn biến, end/outcome, action taken và provenance.

### 3.4 Due Engine

Reminder != Due Engine.

Reminder chỉ báo giờ/ngày do người dùng đặt.
Due Engine xác định “việc chăm sóc nào đến hạn” từ:
- tuổi;
- guideline version;
- quốc gia;
- hồ sơ đã hoàn thành;
- vaccine dose history;
- care plan;
- clinician-directed follow-up.

Không hard-code lịch Mỹ cho hồ sơ Việt Nam.

### 3.5 Data Completeness

Hiển thị “độ đầy đủ dữ liệu”, không phải “điểm sức khỏe”.

Ví dụ:
- hồ sơ cơ bản còn thiếu ngày sinh;
- chưa có số đo gần đây;
- dị ứng chưa xác nhận;
- lịch tiêm chưa nhập;
- care plan sắp cần review;
- tài liệu khám gần nhất chưa gắn vào appointment.

Không đánh đồng thiếu dữ liệu với sức khỏe kém.

### 3.6 Attention Queue

Trang Hôm nay nên có một hàng đợi ngắn:
1. Việc đến hạn
2. Dữ liệu cần bổ sung
3. Xu hướng cần xem lại
4. Episode đang mở
5. Lịch hẹn/thuốc sắp tới
6. Cảnh báo có evidence

Không hiển thị 20 cảnh báo đồng thời.

## 4. Cadence hiệu quả — không overtracking

### Daily
- checklist thói quen;
- bữa ăn/nhóm thực phẩm khi gia đình muốn theo dõi;
- nước;
- vận động;
- ngủ;
- thuốc theo schedule nếu đang dùng.

### Weekly summary
- cảm xúc/stress nhẹ;
- screen habit;
- school function;
- tổng hợp dinh dưỡng/vận động/ngủ.

### Scheduled
- chiều cao/cân nặng;
- transition readiness 16–18;
- review emergency card;
- review care plan nếu đã có.

### Guideline-driven
- khám dự phòng;
- tiêm chủng;
- huyết áp/nhịp tim;
- thị lực/thính lực;
- validated screening;
- các xét nghiệm/sàng lọc khác.

### Event-driven
- triệu chứng;
- chấn thương;
- dị ứng/phản ứng;
- chu kỳ kinh;
- khám bệnh;
- nhập viện;
- thay đổi thuốc;
- sự kiện an toàn/bắt nạt khi cần.

### On-change
- tiền sử;
- bệnh nền;
- dị ứng;
- emergency contact;
- người lớn tin cậy.

Nguyên tắc: không bắt trẻ khỏe mạnh phải đo mọi chỉ số mỗi ngày.

## 5. Những dữ liệu cần thêm để không bỏ sót

### Hồ sơ sức khỏe nền
- ngày sinh;
- giới tính cần cho growth reference;
- bệnh nền đã biết;
- tiền sử phẫu thuật/nhập viện;
- dị ứng;
- thuốc đang dùng;
- care plan;
- kính/trợ thính/thiết bị hỗ trợ;
- family history chọn lọc khi có ý nghĩa;
- emergency contact.

### Khám học đường / preventive
- chiều cao;
- cân nặng;
- huyết áp;
- nhịp tim;
- thị lực;
- thính lực khi có;
- răng miệng;
- vaccine record;
- abnormal findings;
- referral/follow-up.

### Chức năng hằng ngày
- ngủ;
- dinh dưỡng;
- vận động;
- màn hình;
- cảm xúc;
- học tập/tập trung;
- triệu chứng;
- hoạt động bị hạn chế vì sức khỏe.

### Vị thành niên
- dậy thì;
- menstrual health khi phù hợp;
- body image/eating concerns;
- mental wellbeing;
- safety/bullying;
- substance use;
- relationships/reproductive health;
- trusted adult/support network;
- privacy/autonomy.

### 16–18 / chuẩn bị đại học
- biết thuốc/dị ứng;
- biết bệnh nền và tiền sử quan trọng;
- tự đặt lịch;
- tự quản reminders;
- emergency card;
- health passport;
- biết nơi khám thường quy/cấp cứu;
- quản lý tài liệu;
- hiểu lựa chọn riêng tư/chia sẻ;
- chuẩn bị sống xa gia đình.

## 6. Privacy / ownership là P0

Device approval không tương đương profile authorization.

Phải tách:

```text
Admin Device Gate
        ↓
Thiết bị được mở Sức khỏe Y tế
        ↓
Profile Access Policy
        ↓
Caregiver / Self / Trusted helper
        ↓
Standard / Sensitive / Highly-sensitive records
```

Các miền private-by-default:
- tâm lý;
- dậy thì;
- chu kỳ kinh;
- chất gây nghiện;
- sức khỏe sinh sản;
- tài liệu y tế;
- health passport;
- yếu tố gia đình/xã hội nhạy cảm.

Không hard-code tuổi đồng ý pháp lý. Cần `jurisdictionPolicyId` khi triển khai quyền thực tế.

## 7. Security gap cần xử lý trước dữ liệu rất nhạy cảm

Hiện baseline dùng localStorage. Trước khi persistence cho Highly Sensitive cần:

1. chuyển dữ liệu nhạy cảm sang encrypted vault/IndexedDB hoặc lớp storage an toàn tương đương;
2. app auto-lock;
3. generic/redacted notification;
4. không cache plaintext nhạy cảm trong service worker ngoài policy;
5. explicit export/share package;
6. health-data change history;
7. backup encryption hoặc cảnh báo rõ;
8. multi-device sync nếu bật phải đi qua Health backend riêng, không qua Admin Center;
9. sync phải có conflict resolution và provenance;
10. revoke thiết bị không đồng nghĩa xóa dữ liệu của profile ở backend sức khỏe.

## 8. Provenance / data quality

Mỗi record quan trọng phải có:
- createdAt / updatedAt;
- source;
- sourceLabel;
- verification;
- người nhập;
- đơn vị đo;
- ngày đo;
- document link nếu có;
- rule/evidence version nếu có interpretation.

Nguồn cần phân biệt:
- self;
- caregiver;
- school record;
- clinician document;
- device;
- import.

## 9. Evidence governance

Evidence Registry phải quản lý:
- organization;
- title;
- scope;
- jurisdiction;
- reference year;
- reviewedAt;
- reviewDueAt;
- implementation version.

Nguồn framework hiện dùng để audit:
- WHO Growth Reference 5–19;
- WHO Adolescent Health;
- WHO/GAMA adolescent indicators;
- WHO adolescent mental health;
- AAP Bright Futures Periodicity Schedule như nguồn đối chiếu quốc tế, không làm mặc định Việt Nam;
- Bộ Y tế Việt Nam: theo dõi sức khỏe học sinh;
- Bộ Y tế Việt Nam: kế hoạch tiêm chủng mở rộng 2026–2028.

## 10. Hiệu quả UX

### Không làm
- 22 tab chính;
- một dashboard chứa toàn bộ hồ sơ;
- health score duy nhất;
- cảnh báo đỏ cho mọi sai lệch nhỏ;
- yêu cầu ghi quá nhiều hằng ngày;
- hiển thị dữ liệu dậy thì/tâm lý trên màn hình chung;
- duplicate checklist/reminder engines.

### Nên làm
- 7 navigation chính;
- progressive disclosure;
- Today = 3–5 việc quan trọng nhất;
- Quick Add;
- timeline;
- trend cards;
- due queue;
- missing-data queue;
- episode status;
- age-stage personalization;
- sensitive sections hidden/locked;
- weekly/monthly summary;
- one-tap “chuẩn bị đi khám”.

## 11. Priority sau audit

### P0 — phải làm trước khi mở sâu Highly Sensitive
1. Profile Privacy/Proxy Engine
2. Tracking Catalog + cadence
3. Data provenance
4. Episode model
5. Due Engine contract
6. Data completeness model
7. Evidence versioning
8. encrypted sensitive storage design

### P1 — tăng hiệu quả theo dõi
1. Vital/sign screening records
2. Chronic conditions & care plans
3. School health import
4. injury/sports episodes
5. medication administration log
6. preventive/vaccine records
7. Attention Queue
8. trend summaries

### P2 — vị thành niên sâu
1. validated mental-health screening adapter
2. substance-use screening adapter
3. puberty/menstrual module
4. relationships/reproductive health education
5. family/social protective context
6. transition readiness 16–18

### P3 — interoperability
1. encrypted Health backend sync
2. multi-device profile sync
3. explicit share packages
4. PDF/CSV/FHIR-compatible export adapters nếu thực sự cần
5. import school/clinic records có provenance

## 12. Acceptance criteria V3

Khung chỉ coi là “không bỏ sót” khi:
- 22 domains có owner/nav/stage/privacy/guardrail;
- mọi nhóm dữ liệu quan trọng có record contract;
- có tracking cadence catalog;
- có episode model;
- có due/completeness/attention architecture;
- device gate tách khỏi profile authorization;
- highly-sensitive có privacy model;
- evidence có jurisdiction/version/review date;
- preventive rules không hard-code sai quốc gia;
- không có overall health score;
- không overtracking;
- Admin Center không nhận health records;
- CI validator bắt được thiếu domain/stage/privacy/guardrail.
