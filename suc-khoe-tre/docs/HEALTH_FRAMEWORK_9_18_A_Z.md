# Sức khỏe Y tế 9–18 tuổi — Bộ khung A–Z

## 1. Phạm vi sản phẩm

Sức khỏe Y tế là Web App độc lập theo dõi và hỗ trợ hình thành năng lực tự chăm sóc sức khỏe từ 9 tuổi đến hết 18 tuổi 11 tháng.

Ứng dụng không phải HIS/EMR bệnh viện, không tự chẩn đoán, không tự kê đơn và không thay thế bác sĩ/cấp cứu.

Control Plane đã khóa:

- Site Quản trị quản lý thiết bị, quyền, phiên, policy, audit, quyền Calendar và quy trình duyệt nội dung.
- Hồ sơ sức khỏe cá nhân không mặc định được gửi sang Site Quản trị.
- Không nhúng UI/runtime Site Quản trị vào Web App.
- Không dùng runtime/API/database nghiệp vụ của Bơi ếch.

## 2. Điều hướng cấp 1 — giữ gọn 7 khu vực

1. **Hôm nay** — việc cần làm, checklist, nhắc việc, tổng hợp nhanh.
2. **Tăng trưởng** — số đo, WHO BMI-for-age, timeline phát triển.
3. **Dinh dưỡng** — nhóm thực phẩm, bữa ăn, nước, nhật ký.
4. **Vận động** — hoạt động thể lực, thời lượng, lịch sử.
5. **Chăm sóc** — ngủ, dậy thì, răng/da/vệ sinh, mắt/tai/tư thế, sức khỏe số, an toàn, quan hệ & ranh giới cá nhân.
6. **Nhật ký** — cảm xúc, triệu chứng, diễn biến, timeline sự kiện.
7. **Hồ sơ** — hồ sơ cá nhân, thuốc/dị ứng, phòng ngừa/tiêm chủng, lịch khám/tài liệu, reminder/calendar, sao lưu, chuyển tiếp tuổi trưởng thành.

Không tạo thêm 10–20 tab cấp 1 cho từng chủ đề.

## 3. Bốn giai đoạn phát triển

### 9–10 tuổi — Nền tảng thói quen
- ăn uống;
- nước;
- vận động;
- ngủ;
- răng miệng;
- vệ sinh;
- mắt/tư thế;
- an toàn;
- chuẩn bị kiến thức thay đổi cơ thể.

### 11–12 tuổi — Tiền dậy thì
- thay đổi cơ thể;
- vệ sinh tuổi dậy thì;
- dinh dưỡng tăng trưởng;
- ngủ;
- cảm xúc;
- an toàn cá nhân;
- bắt đầu giáo dục ranh giới cá nhân và sức khỏe sinh sản phù hợp tuổi.

### 13–15 tuổi — Vị thành niên sớm
- tăng trưởng tuổi dậy thì;
- sức khỏe tinh thần;
- quan hệ xã hội;
- sức khỏe số;
- dinh dưỡng và hình ảnh cơ thể;
- chất gây nghiện/phòng tránh nguy cơ;
- sức khỏe sinh sản và đồng thuận ở mức giáo dục phù hợp tuổi;
- tăng dần năng lực tự quản lý.

### 16–18 tuổi — Vị thành niên muộn / chuẩn bị đại học
- tự quản lý hồ sơ sức khỏe;
- tự biết thuốc/dị ứng đang có;
- tự đặt/ghi lịch khám;
- sức khỏe tinh thần và stress học tập;
- giấc ngủ;
- quản lý tài liệu;
- thông tin khẩn cấp;
- sức khỏe sinh sản, mối quan hệ an toàn và đồng thuận;
- chuẩn bị sống xa gia đình;
- chuyển tiếp có kiểm soát sang chế độ sức khỏe người lớn sau phạm vi sản phẩm.

## 4. 16 miền chức năng đầy đủ

1. Tăng trưởng & phát triển thể chất.
2. Dinh dưỡng & nước.
3. Vận động & thể lực.
4. Giấc ngủ & phục hồi.
5. Dậy thì & thay đổi cơ thể.
6. Sức khỏe tinh thần & cảm xúc.
7. Răng miệng, da & vệ sinh cá nhân.
8. Mắt, tai, tư thế & sức khỏe học đường.
9. Phòng ngừa, khám định kỳ & tiêm chủng.
10. Triệu chứng, bệnh cấp & sơ cứu.
11. Thuốc, dị ứng & thông tin cần nhớ.
12. Sức khỏe số & thói quen màn hình.
13. An toàn & phòng tránh nguy cơ.
14. Quan hệ, ranh giới cá nhân & sức khỏe sinh sản.
15. Hồ sơ, lịch hẹn & tài liệu y tế.
16. Tự quản lý sức khỏe & chuyển tiếp tuổi trưởng thành.

Nguồn sự thật trong code: `health-domain-catalog.ts`.

## 5. A–Z kiến trúc

### A — Access Gate
Thiết bị phải được Site Quản trị cấp quyền. Không hiển thị hồ sơ sức khỏe trước khi gate hợp lệ.

### B — Backup
Sao lưu JSON local-first, có version schema, tương thích ngược. Không gửi backup về Site Quản trị.

### C — Calendar
Reminder Engine → browser notification → `.ics` → Google Calendar. Google Calendar cần cả quyền thiết bị và OAuth của người dùng.

### D — Daily Engine
Một nguồn dữ liệu theo ngày cho checklist, bữa ăn, nước, vận động, ngủ, cảm xúc, triệu chứng và chăm sóc.

### E — Evidence Registry
Mọi ngưỡng/chỉ tiêu chuyên môn phải chỉ rõ nguồn, phiên bản, phạm vi tuổi và ngày rà soát.

### F — Framework Catalog
Danh mục chức năng tập trung, không hard-code rải rác vào từng component.

### G — Growth Engine
Tuổi tại ngày đo → giới tính → WHO LMS → BMI-for-age/z-score. Không lấy tuổi hiện tại cho số đo lịch sử.

### H — Health Profile
Ngày sinh, giới tính cần cho chuẩn tăng trưởng, thông tin cơ bản và ghi chú do người dùng chọn lưu.

### I — Indexed Timeline
Một timeline có thể tổng hợp số đo, triệu chứng, lịch khám và sự kiện quan trọng mà không trộn audit quản trị.

### J — Journal
Nhật ký cảm xúc/triệu chứng/ghi chú. Không chuyển nhật ký thành công cụ chẩn đoán.

### K — Knowledge Layers
Nội dung giáo dục chia theo 4 giai đoạn tuổi; có thể cập nhật qua quy trình kiểm duyệt nhưng runtime app vẫn độc lập.

### L — Local-first
Dữ liệu sức khỏe cá nhân lưu ở miền dữ liệu Sức khỏe Y tế/local storage theo thiết kế hiện tại; Control Plane không sở hữu dữ liệu này.

### M — Medication & Allergy
Danh sách thuốc, lịch nhắc, dị ứng, thông tin cần nhớ. Không tự chọn thuốc hoặc liều.

### N — Notification
Browser notification chỉ là một kênh. Phải xử lý trạng thái denied/unsupported và không giả định trình duyệt luôn nhắc khi app đóng.

### O — Offline/PWA
Cho phép shell, checklist, nhật ký và dữ liệu local hoạt động khi phù hợp. Offline không được tạo đường bypass cấp quyền vô hạn.

### P — Privacy Classes
Mỗi miền được gắn `standard`, `sensitive` hoặc `highly-sensitive`. Nội dung rất nhạy cảm không xuất hiện trên dashboard công khai mặc định.

### Q — Quality Gates
Lint, build, WHO validation, responsive, accessibility cơ bản, device-access regression và privacy boundary trước merge.

### R — Reminder Engine
Một engine dùng chung cho nước, ăn uống, vận động, ngủ, răng, thuốc, lịch khám và việc cá nhân; tránh mỗi module tự tạo scheduler riêng.

### S — Safety
Không tự chẩn đoán, không tự kê đơn, không tạo kết luận y khoa từ dữ liệu không đủ. Dấu hiệu nguy hiểm phải dẫn tới tìm trợ giúp phù hợp.

### T — Transition to Adult Care
16–18 tuổi có lớp chuẩn bị tự quản lý. Không tự động chuyển sang chuẩn người lớn hoặc chuyển dữ liệu cho bên khác.

### U — User Autonomy
Tuổi lớn dần thì giao diện chuyển từ “phụ huynh ghi giúp” sang “trẻ/vị thành niên tự quản lý” nhưng không phá dữ liệu cũ.

### V — Vaccination / Preventive Care
Lịch phòng ngừa là module riêng trong Hồ sơ. Chỉ bật khuyến nghị cụ thể khi có nguồn chuẩn phù hợp quốc gia/hồ sơ.

### W — Wellbeing
Cảm xúc, stress, giấc ngủ, quan hệ xã hội và sức khỏe số cùng dùng nền nhật ký/nhắc việc chung nhưng có riêng tư cao hơn.

### X — eXport
Thiết kế đường xuất dữ liệu do người dùng sở hữu: JSON baseline, sau này CSV/PDF có thể thêm bằng adapter, không phụ thuộc Site Quản trị.

### Y — Youth-specific Content
Không tái sử dụng nguyên xi nội dung người lớn cho trẻ/vị thành niên. Dinh dưỡng, BMI, tâm lý, dậy thì và an toàn phải theo lứa tuổi.

### Z — Zero Admin Embedding
Không `/admin` trong Sức khỏe Y tế, không iframe Site Quản trị, không shared router quản trị. Chỉ giao tiếp Control API tối thiểu.

## 6. Mô hình engine dùng chung

```text
Profile / Age Stage
        │
        ├── Growth Engine
        ├── Daily Engine
        ├── Journal Engine
        ├── Reminder Engine
        ├── Timeline Engine
        ├── Evidence Registry
        └── Privacy Policy
```

Không xây checklist riêng cho dinh dưỡng, một checklist khác cho răng, một scheduler khác cho thuốc nếu có thể dùng engine chung.

## 7. Mức riêng tư

### Standard
- vận động;
- nước;
- nhóm thực phẩm;
- checklist thói quen;
- ngủ ở mức thói quen.

### Sensitive
- tăng trưởng;
- triệu chứng;
- an toàn/bắt nạt;
- lịch khám;
- phòng ngừa.

### Highly-sensitive
- sức khỏe tinh thần;
- dậy thì;
- chu kỳ kinh nguyệt;
- sức khỏe sinh sản;
- thuốc/dị ứng;
- tài liệu y tế;
- health passport.

Site Quản trị không mặc định nhận bất kỳ nhóm dữ liệu sức khỏe nào ở trên.

## 8. Lộ trình triển khai sâu sau khi bộ khung khóa

1. Tăng trưởng — hoàn thiện biểu đồ và evidence UI.
2. Dinh dưỡng theo giai đoạn tuổi.
3. Vận động theo giai đoạn tuổi.
4. Giấc ngủ.
5. Dậy thì & vệ sinh tuổi dậy thì.
6. Sức khỏe tinh thần/cảm xúc.
7. Mắt/răng/da/học đường/sức khỏe số.
8. Phòng ngừa & lịch tiêm/khám.
9. Thuốc/dị ứng.
10. Sức khỏe sinh sản/ranh giới cá nhân theo tuổi.
11. Safety/first aid.
12. Health passport & chuyển tiếp 16–18.
13. Timeline tổng hợp.
14. Export nâng cao.
15. PWA/offline hardening.
16. Full regression & release gate.

Mỗi lượt phải stop-on-error, có bằng chứng test và không merge main khi gate chưa pass.

## 9. Acceptance criteria cho bộ khung

- 7 điều hướng chính, không tăng vô tội vạ.
- 16 miền chức năng được định nghĩa tập trung.
- 4 giai đoạn 9–18 có phạm vi rõ.
- Mỗi miền có phạm vi tuổi, privacy class, capability và guardrail.
- Tăng trưởng WHO hoạt động 108–227 tháng.
- Legacy 9–10 được migrate không phá hủy.
- Admin boundary không thay đổi.
- Google Calendar vẫn gate theo thiết bị.
- Không có module người lớn/giảm cân/gym chèn sai phạm vi.
- Có đường chuyển tiếp 16–18 nhưng chưa tự động sang adult mode.
- CI pass trước merge/deploy.
