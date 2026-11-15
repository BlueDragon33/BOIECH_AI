# V15 — Kiểm tra video bơi và liên lạc Giảng viên / Học viên

## Nguồn thay đổi và phạm vi
Cập nhật tính năng **đang sử dụng thật** của Bơi Ếch AI, dựa trên yêu cầu Owner ngày 15/11/2026, dưới Blueprint OS 1.3.0. Không tạo app riêng, không thay bố cục Cán bộ quản lý, không tự phát hành.

### 1. Cổng kiểm tra đầu vào video
- Giữ giới hạn gốc: file video `video/*`, 50 MB, 30 giây, xử lý MediaPipe **trên thiết bị**, không chuyển video/ảnh lên server.
- Bổ sung xác nhận của Học viên rằng clip là **thực hành bơi ếch trong nước**. Đây là xác nhận người dùng, **không phải chứng cứ máy đã nhận diện hồ nước**.
- Chạy `inspectSwimmingEvidence` sau lấy mẫu pose và trước **đánh lỗi, chấm điểm, lưu và đồng bộ**. Kiểm tra: đủ pose, thời gian liên tục, độ rõ khớp, biên độ tay/gối, chuyển động tay/chân tương đối thân, trục thân ở góc ngang.
- `reject`/`uncertain`: chỉ áp dụng khi video gần như đứng yên hoặc thiếu dữ liệu tư thế/chuyển động để chấm công bằng; không chấm, không lưu điểm, không đồng bộ. **Thao tác bơi sai, góc thân sai, tay/chân không chuẩn vẫn được nhận vào để chấm điểm thấp** nếu dữ liệu đủ. `plausible`: đủ tín hiệu chuyển động để đánh giá, **không xác nhận chắc chắn video quay dưới nước**; thao tác giả lập trên cạn có thể vượt qua pose gate.
- Điểm kỹ thuật giữ thang nội bộ 0–100 và hiển thị tương đương 0–10; thiếu biên độ tay, chân, nhịp phối hợp hoặc trục thân kém sẽ bị trừ theo tín hiệu pose thay vì chỉ đánh vài lỗi vượt ngưỡng. **Chỉ khi điểm < 50/100 (< 5/10)** hiện câu hỏi “Bạn có đang thực sự học bơi không vậy?” với hướng dẫn xem lỗi và tập lại; điểm từ 5/10 trở lên không hiện câu hỏi. Cảnh báo mang tính động viên sửa kỹ thuật, không suy diễn về động cơ hay khả năng thực tế của học viên.
- Thang điểm dựa trên ngưỡng heuristic chưa được hiệu chỉnh bằng video có nhãn; không coi là chứng chỉ hoặc thang chấm của huấn luyện viên. Đồng bộ kết quả vẫn media-free; metadata không lưu bản ghi video gốc.
- Độ tin cậy pose hiển thị được giới hạn theo tín hiệu hiện có; không tự tuyên bố chính xác 100%. Chưa có tập video thật đã được gắn nhãn độc lập nên **không được báo độ chính xác phân loại hoặc chuẩn chẩn đoán kỹ thuật**.
- Chỉ dùng các phần mềm/phép đo pose hiện có. Bản đề xuất tiếp theo: benchmark có consent với video thật theo góc quay, tốc độ bơi, bể khác nhau; gắn nhãn do Giảng viên phê duyệt, đo false accept/false reject, precision/recall, thống kê tương phản môi trường nước và calibration rồi mới phê duyệt mô hình nhận diện cảnh nâng cao.

### 2. Hai kênh liên lạc
- **Chat trực tiếp:** Học viên có thể mở hội thoại đầu tiên mà không phải chờ Giảng viên gửi can thiệp; Giảng viên phản hồi trong đúng lớp phụ trách.
- **Thư yêu cầu:** Học viên gửi tiêu đề và nội dung; Giảng viên phản hồi gắn đúng ID thư đã gửi. Lịch sử chat và thư hiển thị riêng, cùng nhãn thời gian.
- Xác thực P-256 bằng challenge đã có; D1 `course_activity_events` lưu sự kiện dưới thiết bị Học viên, với `clientEventId` để tránh gửi lặp. Không thêm schema mới, không thay đổi API duyệt tài khoản.
- Server chỉ cho Học viên đọc tin trên thiết bị được xác minh; Giảng viên chỉ được đọc/gửi tới Học viên thuộc lớp/đơn vị đã đăng ký. Không mở tin ngoài lớp. Có giới hạn tin 1.200 ký tự, 60 sự kiện mỗi kênh/một phía trong 24 giờ, trả lỗi khi vượt ngưỡng.
- Hộp thư tự **polling có xác thực** khi tab đang hiển thị: chat/thư ~5,2 giây, inbox lớp ~6,8 giây, hướng dẫn cũ ~8 giây; làm mới khi mở lại tab/trực tuyến, không cần F5. Đây **không phải WebSocket push**; có thể trễ vài giây, ngắt mạng sẽ tạm ngưng và tải lại khi kết nối được.
- Bảo vệ: không gửi video gốc/tệp riêng tư trong chat, chống thông tin gửi trùng, không hiển thị sai kết quả gửi trước khi máy chủ xác nhận. Chưa hỗ trợ đính kèm file, notification hệ điều hành, xác nhận đã đọc đầy đủ hoặc end-to-end encryption; các chức năng đó cần review riêng.

### 3. Kiểm thử/Gate trước release
- Video: no-person, stationary/non-swimming, too-short, low confidence, plausible-motion, score/sync are after admission, playback cancellation.
- Hội thoại: signed role guard, teacher scope (foreign class denied), student opens chat first, request/reply ID matching, duplicate event replay, teacher inbox filter, tab visibility polling.
- Regression: `npm run lint`, `npm test`, build, D1 migration rehearsal và 1.3 Constitution + paired Application-Management QA trên **exact HEAD**.
- Chỉ merge/publish khi cổng QA và Owner nghiệm thu. Bản Production và dữ liệu hiện tại không bị cập nhật bởi PR nháp.

**Lưu ý an toàn:** AI chỉ hỗ trợ huấn luyện viên, không thay thế giám sát an toàn bơi. Không cung cấp kết luận kỹ thuật mạnh khi video không đủ căn cứ hoặc đang bị che khuất.
