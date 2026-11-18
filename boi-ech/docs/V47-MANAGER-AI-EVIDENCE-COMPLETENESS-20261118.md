# V47 — AI Điều hành: trung thực về độ đầy đủ bằng chứng

Scope: chỉ nhánh phát triển, rules-only, Cloudflare-only, ZERO-SPEND; không merge, không remote D1/bridge, không tác động Production, không bật paid provider.

## Mục tiêu
- Hỏi đáp không được suy ra không có vấn đề khi báo cáo bị cắt bớt cảnh báo ở top N.
- Quét trùng lịch nêu rõ số buổi có ngày giờ không hợp lệ và đánh dấu phạm vi kiểm tra chưa đủ.
- Mô phỏng phòng chuyển từ không trùng sang cần rà soát khi có buổi hợp lệ về trạng thái nhưng sai thời gian.
- Thông báo tại các điểm vào AI quản lý không được bảo đảm an toàn giả khi nguồn bị cắt.

## Giới hạn
- Chỉ đọc, xác định, dẫn nguồn; không tự cấp quyền, phân công, sửa lịch, gửi dữ liệu cho mô hình tạo sinh, dùng dịch vụ trả phí.
- Không tuyên bố độ chính xác thống kê hoặc bao phủ dữ liệu chưa tải; phải có xác thực vai trò, D1, reviewer A/B và nghiệm thu Preview trước phát hành.

## Sơ đồ phát hành
- PR #199 chỉ chứa V41 phần manager trên main: đã PASS CI nhưng chưa có signed manager E2E và reviewer A/B độc lập.
- V47 dựa vào V46 Draft PR #198, không tự được phát hành cùng #199.
- Nếu muốn phát hành V47 thành phần: phải tách lại từ main, audit khác biệt, kiểm thử exact SHA và áp dụng cổng Constitution 1.3.

## QA theo tầng
1. Unit negative tests: hidden category, partial answer, invalid timestamp, cancelled invalid records, no mutation.
2. TypeScript/lint/build + paired App read-only CI + Constitution exact HEAD.
3. Signed manager role and Preview D1 negative tests; independent A/B with source paths and proof.
4. Chỉ khi Owner xác nhận và cổng bắt buộc PASS: Cloudflare-only release theo SHA, kiểm tra live revision và rollback.

No fake PASS. No background deploy.