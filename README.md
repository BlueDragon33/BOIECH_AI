# BOIECH_AI

Repository chung cho các ứng dụng học tập/sức khỏe và Trung tâm quản trị.

Kiến trúc production tách theo ứng dụng:

| Thư mục | Worker / dữ liệu | Chức năng |
| --- | --- | --- |
| `boi-ech/` | Worker `boi-ech` · D1 `boi-ech-db` | Ứng dụng Bơi ếch, học viên, tiến độ, thanh toán, AI và nội dung Bơi ếch |
| `suc-khoe-tre/` | Worker `suc-khoe-tre` · D1 `suc-khoe-tre-db` | Ứng dụng Sức khỏe trẻ 9 tháng–5 tuổi, dữ liệu nội dung và quy trình biên tập riêng |
| `quan-ly-hoc-tap/` | Worker `learning-management` · D1 `learning-management-db` | Trung tâm chọn ứng dụng, xác thực quản trị và điều hướng vào khu quản trị riêng của từng ứng dụng |

Trung tâm không gộp dữ liệu nghiệp vụ của các ứng dụng. Mỗi ứng dụng có API, cơ sở dữ liệu và vòng đời deploy riêng; Trung tâm chỉ cấp vé quản trị ngắn hạn theo đúng audience của ứng dụng.

## Lấy mã nguồn

```bash
git clone https://github.com/BlueDragon33/boiech_AI.git
cd boiech_AI
```

Nếu đã clone trước đó:

```bash
git pull origin main
```

## Chạy Bơi ếch

```bash
cd boi-ech
npm ci
npm run dev
```

## Chạy Sức khỏe trẻ

```bash
cd suc-khoe-tre
npm ci
npm run dev
```

## Chạy Trung tâm quản trị

```bash
cd quan-ly-hoc-tap
npm ci
npm run dev
```

Yêu cầu Node.js `>=22.13.0`. Không đưa tệp `.env`, token hoặc khóa bí mật lên GitHub; các secret production được quản lý tại Cloudflare/GitHub Actions.
