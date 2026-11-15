# BƠI ẾCH AI — Tòa bể bơi và bể thực hành (Manager V12)

## Mục đích
Tạo sẵn một mẫu **Tòa bể bơi** có **01 Bể bơi thực hành**, phân biệt với các tòa học lý thuyết. Phục vụ bố trí các buổi thực hành bơi ếch qua hệ thống lịch hiện hành.

## Hiển thị và dữ liệu thực
- Tòa bể bơi xuất hiện dưới dạng **mẫu có sẵn**, có minh họa SVG riêng tại **Tổng quan**, **Phòng học** và **Tòa học**. Trước khi tạo, thẻ ghi rõ **chưa thêm vào dữ liệu**; không được tính trong số liệu thống kê phòng/tòa.
- Cán bộ có quyền vào **Tòa học** và chọn **Tạo tòa và bể bơi thực hành**. Hệ thống dùng hai lệnh `save-resource` hiện hành, có xác minh tài khoản/quyền và đọc lại dữ liệu từ máy chủ: tạo tòa rồi tạo bể con thuộc đúng tòa.
- Mã mẫu ổn định: `boiech_pool_building_v1` / `boiech_pool_room_v1`. Nếu tòa đã tồn tại, không tạo thêm tòa; nếu bể đã tồn tại bên trong, không nhân đôi. Tên tòa/bể được đối chiếu để tránh ghi đè tài nguyên người dùng đã tạo.
- **Sức chứa chưa biết**: trường `capacity=1` chỉ là số tạm do ràng buộc lưu D1, **không phải sức chứa thật**. Bể được tạo ở trạng thái `unavailable`, không thể xếp lịch thực hành khi chưa sửa sức chứa và chọn `active`. Giao diện hiển thị “Chờ xác nhận sức chứa”, không hiển thị con số giả 1 là sức chứa.
- Sau khi xác nhận, bể hoạt động như tài nguyên `room` thông thường, tái sử dụng kiểm tra trùng giờ, sức chứa, lớp, giảng viên và quyền máy chủ. Tên buổi học khi chọn bể được gợi ý là **“Thực hành bơi ếch”** nhưng có thể sửa.

## An toàn và xử lý lỗi
- Không thêm seed vào D1 bằng migration vì đây là dữ liệu sử dụng thật, chỉ tạo từ hành động quản lý có quyền. Không tự ghi khi tải trang, không tạo dữ liệu ảo.
- Nếu tạo tòa thành công nhưng tạo bể thất bại, giữ tòa thật, không tự xóa: **đồng bộ dữ liệu rồi chọn thêm bể**, tránh xóa nhầm bản ghi và dùng mã ổn định để tránh ghi trùng.
- Không mở lịch cho bể chưa cấu hình; không yêu cầu cấu hình chiều dài/sâu/làn bơi giả khi chưa có dữ liệu.
- Không thay đổi `training_schema`, API quyền hay các bản ghi tòa/phòng hiện có.

## Tiêu chí QA
- Kiểm thử RBAC tạo tài nguyên, trạng thái bể chờ cấu hình ngăn lịch, kích hoạt sau chỉnh sức chứa cho phép lịch hợp lệ, khôi phục không tạo trùng.
- Kiểm tra ba tab cùng hiển thị bể/tòa đúng danh tính và không tính mẫu chưa lưu là dữ liệu thật.
- Lint, TypeScript, full regressions, local D1 migration, Constitution 1.3, paired Preview read-only.
- Preview browser 320px / 390px / tablet / desktop cần kiểm tra riêng trước khi merge và publish; giữ PR ở trạng thái Draft cho đến khi Owner phê duyệt.
