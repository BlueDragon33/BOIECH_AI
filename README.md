# BOIECH_AI

Mã nguồn chung cho hệ thống **Ứng dụng AI trong dạy và học môn Bơi ếch**.

Repository này gồm hai ứng dụng độc lập:

| Thư mục | Chức năng |
| --- | --- |
| `boi-ech/` | Site bài giảng, học tập, AI hỗ trợ ngoại tuyến, chứng chỉ và biên tập nội dung tại thiết bị |
| `quan-ly-hoc-tap/` | Trung tâm quản trị thiết bị, tài khoản, thanh toán, tiến độ và quy trình duyệt nội dung |

## Lấy mã nguồn

```bash
git clone https://github.com/BlueDragon33/boiech_AI.git
cd boiech_AI
```

Nếu đã clone trước đó:

```bash
git pull origin main
```

## Chạy site bài giảng

```bash
cd boi-ech
npm ci
npm run dev
```

## Chạy trung tâm quản trị

```bash
cd quan-ly-hoc-tap
npm ci
npm run dev
```

Yêu cầu Node.js `>=22.13.0`. Mỗi ứng dụng có cấu hình, cơ sở dữ liệu và quy trình triển khai riêng. Không đưa tệp `.env` hoặc khóa bí mật lên GitHub; dùng `.env.example` làm mẫu khi có.
