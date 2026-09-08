# BOIECH_AI

Repository cho **Bơi ếch** và **Trung tâm Quản trị**.

Ứng dụng **Sức khỏe Y tế 9–18 tuổi đã được tách hoàn toàn về repo riêng**:

- `BlueDragon33/Health_Care`
- Worker hiện hành: `suc-khoe-tre`
- D1 hiện hành: `suc-khoe-tre-db`

`BOIECH_AI` không còn chứa runtime/mã nguồn nghiệp vụ của Sức khỏe Y tế. Trung tâm Quản trị vẫn giữ bridge và giao diện quản trị cần thiết để quản lý Health_Care từ xa qua Control API.

## Kiến trúc

| Thành phần | Worker / dữ liệu | Chức năng |
| --- | --- | --- |
| `boi-ech/` | Worker `boi-ech` · D1 `boi-ech-db` | Ứng dụng Bơi ếch, học viên, tiến độ, thanh toán, AI và nội dung Bơi ếch |
| `quan-ly-hoc-tap/` | Worker `learning-management` · D1 `learning-management-db` | Trung tâm quản trị thiết bị, quyền, policy, phiên, audit và bridge tới các ứng dụng độc lập |
| `BlueDragon33/Health_Care` | Worker `suc-khoe-tre` · D1 `suc-khoe-tre-db` | Web App Sức khỏe Y tế 9–18 tuổi độc lập; nằm ngoài repo này |

Trung tâm không sở hữu dữ liệu sức khỏe cá nhân. Health_Care có runtime, mã nguồn, CI và vòng đời phát hành riêng; Trung tâm chỉ giao tiếp thông qua Control API rõ ràng.

## Lấy mã nguồn BOIECH_AI

```bash
git clone https://github.com/BlueDragon33/BOIECH_AI.git
cd BOIECH_AI
```

## Chạy Bơi ếch

```bash
cd boi-ech
npm ci
npm run dev
```

## Chạy Trung tâm quản trị

```bash
cd quan-ly-hoc-tap
npm ci
npm run dev
```

## Sức khỏe Y tế

Mã nguồn không còn nằm trong repo này. Làm việc tại repo:

```text
https://github.com/BlueDragon33/Health_Care
```

Yêu cầu Node.js `>=22.13.0`. Không đưa `.env`, token hoặc khóa bí mật lên GitHub; secret production được quản lý tại Cloudflare/GitHub Actions của từng repo.
