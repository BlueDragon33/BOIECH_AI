# Tăng trưởng 9–18 tuổi · WHO Reference 2007

## Phạm vi sản phẩm

Web App Sức khỏe Y tế chủ động theo dõi từ **9 tuổi 0 tháng đến hết 18 tuổi 11 tháng** (`108–227` tháng tuổi hoàn thành). Đây là phạm vi sản phẩm để đi cùng trẻ từ cuối tiểu học đến giai đoạn có thể chuẩn bị vào đại học.

WHO Reference 2007 có phạm vi rộng hơn, từ **5 đến 19 tuổi (`61–228` tháng)**. Ứng dụng không sử dụng toàn bộ phạm vi đó; chỉ dùng các hàng 108–227 phù hợp mục tiêu sản phẩm.

## Nguồn chính thức

- WHO Growth reference data for 5–19 years: https://www.who.int/tools/growth-reference-data-for-5to19-years
- WHO BMI-for-age 5–19 years: https://www.who.int/toolkits/growth-reference-data-for-5to19-years/indicators/bmi-for-age
- WHO computation of centiles and z-scores: https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/computation.pdf

Bảng dữ liệu trong `who-bmi-lms-9-18.ts` lưu L/M/S theo từng tháng và giới tính. CI kiểm tra đủ 120 tháng cho mỗi giới, thứ tự liên tục và một số mốc neo ở đầu/giữa/cuối dải tuổi.

## Cách tính

1. Tính tháng tuổi hoàn thành tại **ngày đo**, không lấy tuổi hiện tại.
2. Chọn bảng theo giới tính đã dùng cho biểu đồ tăng trưởng.
3. Tính BMI từ chiều cao/cân nặng.
4. Tính z-score bằng công thức LMS WHO.
5. Ngoài ±3 SD, áp dụng quy tắc mở rộng tuyến tính theo hướng dẫn tính toán WHO thay vì tiếp tục ngoại suy LMS.

## Ngưỡng BMI-for-age

Theo WHO:

- Gầy nghiêm trọng: `< -3 SD`
- Gầy: `< -2 SD`
- Thừa cân: `> +1 SD`
- Béo phì: `> +2 SD`

Kết quả trong ứng dụng được gọi là **tham chiếu tăng trưởng BMI-for-age**, không phải chẩn đoán bệnh.

## Ranh giới 18 → 19 tuổi

Ứng dụng **không chuyển sang ngưỡng BMI người lớn khi vừa tròn 18 tuổi**. Toàn bộ dải 9–18 vẫn dùng BMI-for-age theo tuổi và giới tính. Khi đạt 19 tuổi (`228` tháng), engine 9–18 dừng đánh giá và yêu cầu một chế độ chuyển tiếp người lớn riêng nếu sau này được xây dựng.

Điều này tránh việc cùng một hồ sơ bị áp hai hệ quy chiếu khác nhau chỉ vì qua sinh nhật 18 tuổi.

## Thiếu dữ liệu

Nếu thiếu ngày sinh, giới tính, ngày đo hoặc số đo hợp lệ, ứng dụng không đoán. Kết quả trả về trạng thái `available: false` cùng lý do cụ thể.

## Giai đoạn nội dung

Phạm vi 9–18 được chia thành bốn lớp nội dung để tổ chức trải nghiệm, không phải phân loại y khoa:

- 9–10: Nền tảng thói quen
- 11–12: Tiền dậy thì
- 13–15: Vị thành niên sớm
- 16–18: Vị thành niên muộn / chuẩn bị đại học

Các mục tiêu dinh dưỡng, vận động, giấc ngủ, sức khỏe tinh thần và tự quản lý sức khỏe phải có nguồn chuyên môn riêng trước khi được bật thành khuyến nghị định lượng.

## Dữ liệu và quyền riêng tư

Số đo, hồ sơ và đánh giá tăng trưởng vẫn thuộc Web App Sức khỏe Y tế/local-first. Trung tâm Quản trị chỉ quản lý thiết bị, phiên, policy và quyền tính năng; không nhận dữ liệu tăng trưởng cá nhân.
