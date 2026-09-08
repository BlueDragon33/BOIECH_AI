# Sức khỏe Y tế 9–10 tuổi — Framework baseline

## Mục tiêu

Bộ khung này thay cho cách tổ chức sức khỏe tổng quát trước đây. Đối tượng trung tâm là trẻ 9–10 tuổi. Nội dung chính xoay quanh tăng trưởng, dinh dưỡng, vận động, giấc ngủ, vệ sinh, răng miệng, mắt & học tập, sức khỏe học đường, checklist và nhật ký.

## Ranh giới bắt buộc

- `suc-khoe-tre` là Web App độc lập.
- Không nhúng Site Quản trị vào runtime, router hoặc UI của Sức khỏe Y tế.
- Không tạo `/admin` trong Sức khỏe Y tế.
- Site Quản trị chỉ quản lý thiết bị, quyền truy cập, policy, feature permission, phiên, audit và quy trình duyệt nội dung.
- Hồ sơ sức khỏe cá nhân không mặc định được đưa sang Site Quản trị.
- Sức khỏe Y tế không dùng runtime/API/database của Bơi ếch.
- Phương thức quản trị lấy Bơi ếch làm mẫu: Web App độc lập + thiết bị được Trung tâm cấp/khóa/thu hồi quyền từ xa.

## Điều hướng cấp 1

1. Hôm nay
2. Tăng trưởng
3. Dinh dưỡng
4. Vận động
5. Chăm sóc
6. Nhật ký
7. Hồ sơ

Không đưa hàng chục module ngang cấp vào menu chính.

## A–Z

- **A — App Shell:** desktop sidebar, mobile bottom navigation, trạng thái kết nối/thiết bị.
- **B — Hôm nay:** checklist, tiến độ, việc tiếp theo, tóm tắt nhanh.
- **C — Hồ sơ trẻ:** tên, ngày sinh, tuổi, giới tính, số đo và ghi chú cần thiết.
- **D — Tăng trưởng:** chiều cao, cân nặng, BMI theo tuổi/giới tính, xu hướng.
- **E — Mốc tăng trưởng:** lưu từng lần đo theo ngày và timeline 9–10 tuổi.
- **F — Dinh dưỡng:** nhóm thực phẩm, bữa ăn, nước, checklist, nhật ký, nhắc.
- **G — Nhóm thực phẩm:** đạm, rau, trái cây, sữa/tương đương, ngũ cốc/tinh bột, nước.
- **H — Checklist dinh dưỡng:** reset theo ngày nhưng giữ lịch sử.
- **I — Nhật ký dinh dưỡng:** sáng, trưa, phụ, tối; món, nhóm thực phẩm, mức ăn, ghi chú.
- **J — Nước:** ghi nhanh, lịch sử, mục tiêu cấu hình theo hồ sơ/chính sách.
- **K — Vận động:** đi bộ, chạy, đạp xe, bơi, bóng đá, nhảy dây, thể dục và hoạt động khác.
- **L — Checklist vận động:** thói quen vận động, ngoài trời, ngồi lâu và thư giãn.
- **M — Giấc ngủ:** giờ ngủ, giờ dậy, thời lượng, checklist trước ngủ.
- **N — Chăm sóc cá nhân:** rửa tay, tắm, thay quần áo, tóc và thói quen vệ sinh.
- **O — Răng miệng:** đánh răng sáng/tối, đau răng, thay răng, lịch nha khoa.
- **P — Mắt & học tập:** mỏi mắt, nhìn mờ, đau đầu khi học, màn hình và nghỉ mắt.
- **Q — Sức khỏe học đường:** mắt, răng, tư thế, cặp sách, vận động, thói quen học tập.
- **R — Nhật ký sức khỏe:** cảm nhận hôm nay, triệu chứng, nhiệt độ/ghi chú khi cần.
- **S — Theo dõi triệu chứng:** theo dõi diễn biến, không tự chẩn đoán, không tự kê đơn.
- **T — Timeline sức khỏe:** tăng trưởng, checklist, triệu chứng, khám và sự kiện quan trọng.
- **U — Reminder Engine:** một engine chung cho dinh dưỡng, nước, vận động, răng, ngủ, đo và lịch khám.
- **V — Nhắc lặp:** một lần, hằng ngày, theo ngày trong tuần, hằng tuần, hằng tháng.
- **W — Notification & Calendar:** browser notification, `.ics`, Google Calendar theo quyền thiết bị.
- **X — PWA / Offline:** checklist, nhật ký và dữ liệu đã cache; đồng bộ khi có mạng.
- **Y — Quản lý từ Site Quản trị:** device registry, access, feature permission, policy, session, audit, review.
- **Z — Kiến trúc phát hành:** runtime riêng, database nghiệp vụ riêng, Control API tối thiểu, test gate trước merge.

## Những phần không thuộc baseline 9–10 tuổi

Không đưa lên điều hướng chính: thai kỳ, sau sinh, người cao tuổi, bệnh mạn người lớn, calorie tracker giảm cân, gym, thực phẩm bổ sung như module lớn, bệnh viện/bác sĩ như module chính, đường huyết/SpO2/huyết áp mặc định trên dashboard trẻ khỏe mạnh.

## Trạng thái triển khai của commit framework

Commit framework chỉ tái cấu trúc App Shell và các màn hình cấp 1. Các nút `Thiết kế sâu sau` là chủ ý: chưa triển khai nghiệp vụ sâu, database schema, thuật toán đánh giá tăng trưởng, reminder persistence hoặc Google Calendar trong lượt này.

Khi triển khai sâu phải giữ gate:

1. lint;
2. build;
3. kiểm thử device access;
4. kiểm thử responsive;
5. kiểm thử ranh giới Sức khỏe Y tế ↔ Site Quản trị;
6. chỉ merge `main` sau khi gate pass.
