# V42 — Video coaching → Giảng viên; allocation recommendations → Cán bộ quản lý

Status: **stacked Draft PR #188, source-only**. Base: Draft PR #186 / #185. Blueprint OS 1.3.0. GitHub = source of truth, Cloudflare Preview only after exact-HEAD QA. No Production published from this branch.

## Data flow and source authority
1. Học viên hoàn thành **phân tích video** ở thiết bị; nội dung được đồng bộ chỉ là sự kiện `course_activity_events.video_ai_analysis` với số liệu/khuyến nghị, **không phải video/ảnh gốc**.
2. API `/api/teacher/overview` **đã có** xác thực thiết bị và kiểm tra vai trò Giảng viên, lọc đúng danh sách lớp được phân công trước khi đọc kết quả. V42 dùng lại API này, không nâng quyền.
3. `prioritizeTeacherVideo` xử lý tóm tắt được phép đọc. Khi thiếu video, ghi hình yếu hoặc độ tin cậy chưa đủ, đề xuất quay lại thay vì khẳng định lỗi kỹ thuật. Nếu lỗi đủ bằng chứng, xếp ưu tiên và soạn **bản nháp** bài luyện từ chính dữ liệu lỗi/tham chiếu trong phân tích.
4. Giảng viên mở xem nguyên nhân và bằng chứng, sửa bản nháp, gửi qua **luồng action ký số đã có**. Không có gửi tự động, không spam, không đọc video gốc từ bảng quản trị. Sau phản hồi, công cụ learning analytics hiện hữu theo dõi tín hiệu trước/sau, không suy ra quan hệ nhân quả.
5. Refresh khi Giảng viên đang dùng app: mỗi **180 giây** và khi tab trở lại chế độ hiển thị. Không giả định push realtime, không chạy nền. Bản cũ/không có dữ liệu vẫn được ghi là chưa xác minh.

## Manager allocation review
- Nguồn hiện được phép dùng: `TrainingBoard` trong `/api/training-management`: `resources` (capacity/learnerCount/teacherCount/requiredTeachers), `people` (role/registered/status/expired/className), `sessions` (teacher/assistant/class/room/time/status), `teacherClassTerms`, `observedAt`.
- Giảng viên: ưu tiên lớp thiếu người; ứng viên phải có tài khoản hợp lệ, chưa phân vào lớp đó, không có phiên đang tải bị trùng giờ; sắp theo **số lớp đang quản lý** và tên. Không biết năng lực, chứng chỉ, lịch trực ngoài hệ thống hoặc giờ rảnh ngoài cửa sổ đã tải.
- Học viên: chỉ đề xuất học viên chưa khớp lớp hoạt động với tối đa **2 lớp hoạt động còn chỗ và đủ giảng viên cấu hình**, theo tỷ lệ lấp đầy. Sức chứa cấu hình **không thay thế** tiêu chuẩn an toàn bể và tỷ lệ học viên/giảng viên khi thực hành.
- Cán bộ thấy mức ưu tiên, lý do, bộ đếm, ID nguồn, mốc dữ liệu và giới hạn. Chọn phương án sẽ mở **hộp thoại phân công đang dùng với lớp chọn sẵn**; chỉ khi bấm **Lưu phân công** mới gọi `assign-person`, giữ kiểm tra server và xung đột phiên bản. Không tạo quyết định ngầm.
- Card AI hiện ở Trang chủ và các tab liên quan để thông báo số đề xuất mới từ snapshot hiện hành.

## Profile admission — **CHƯA CÓ NGUỒN ĐƯỢC CẤP PHÉP** (future phase)
Muốn quản lý hầu như không cần chọn thủ công, cần nguồn **được xác nhận** từ hồ sơ bổ sung:
- Giảng viên: chuyên môn/chứng chỉ và hạn hiệu lực; ca rảnh từ/đến + múi giờ IANA; giới hạn số lớp/số tiết/sĩ số hỗ trợ; vai trò chính/phụ; đơn vị và nhiệm vụ ngoài hệ thống; lịch nghỉ/vắng.
- Học viên: khung giờ đăng ký, lớp/khóa mong muốn, trình độ đầu vào và mục tiêu luyện tập do học viên khai báo, hỗ trợ đặc thù **chỉ khi thật cần và có chính sách bảo vệ dữ liệu**; xếp lớp không suy đoán trình độ từ tuổi/giới tính.
- Cơ sở: giờ vận hành phòng/bể; loại/độ sâu bể, giới hạn an toàn được phê duyệt, thời gian chuyển khu và tình trạng thực tế.
- Kết nối account-first và bản ghi hồ sơ: source ID, owner, revision, thời điểm cập nhật, hết hạn, mức tin cậy, consent/retention, quyền xem từng trường. Dữ liệu thiếu phải hiển thị “Chưa khai báo” và **không thể coi là rảnh/đạt chuẩn**.
- Chính sách gợi ý tương lai: hard veto khi thiếu chứng chỉ cần có, không hợp giờ, trùng lịch, hết hạn tài khoản, lớp/bể không hợp lệ, vượt giới hạn; trong tập hợp hợp lệ, xếp ưu tiên sự phù hợp, cân bằng tải và liên tục học tập. Không chấm điểm phù hợp giả nếu thiếu dữ liệu.

## Decision queue & notifications — **CHƯA TRIỂN KHAI** (future gated)
- Write-side proposal ID, scoped server-side permission, status `suggested → reviewed → approved/rejected → applied`; CAS (expected version), idempotency key, approval user/time/reason, immutable audit, atomic class/teacher/schedule checks, rollback/readback.
- Server-side event fanout to exact authorized teacher/manager inbox, deduplicated by source event + revision. Distinguish “thông báo có đề xuất mới” from “đã gửi bài tập/lịch chính thức”. No unauthorized global broadcasts, no data leak across classes, no automatic external messaging.
- Release requires Cloudflare D1 migration rehearsal, signed role E2E, actual Preview readback, dual review and Owner approval.

## Optional generative AI, Knowledge Base — **BLOCKED UNTIL CONFIGURED**
Provider/model, spending cap, timeout, retention, permitted data, prompt injection protection, accessible on/off switch, fallback rules-only, evaluated answer set, human-approved versioned knowledge documents with per-document ACL and citations. “Bật AI” without any of these would be a false compliance claim.

## Acceptance
Exact-HEAD tsc/lint/build/full regression; zero fake source fields and zero new mutations without human click; media-free teacher output; expired/blocked excluded; assistant-teacher/time conflicts; class load and capacity; two successive video events; stale teacher review; low capture quality; quota/limit/cap handling; 320/390/768/1024/1440, computed contrast/light/dark; signed teacher/manager Preview and non-role rejection. CI/Preview gates are not PASS until workflow evidence is actually read.

**Do not merge PR #188/#189, dispatch Production, or claim realtime notifications/full matching without real evidence and separate Owner authorization.**
