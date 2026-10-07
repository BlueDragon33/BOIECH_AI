# BOIECH_AI

Repository hiện giữ **ứng dụng Bơi ếch** và mã nguồn lịch sử của Trung tâm quản trị cũ.

## Nguồn canonical hiện hành

- Bơi ếch: `BOIECH_AI/boi-ech/` — runtime và dữ liệu thuộc chính ứng dụng Bơi ếch.
- Trung tâm quản trị canonical: `BlueDragon33/Application-Management`.
- Sức khỏe Y tế: `BlueDragon33/Health_Care`.
- Hòa nhập Nga: `BlueDragon33/RU_LIFE`.

Thư mục `quan-ly-hoc-tap/` chỉ còn phục vụ đối chiếu/migration lịch sử. **Không được deploy thư mục này thành một control-plane thứ hai.** Workflow deploy `learning-management` cũ đã được loại bỏ để tránh split-brain với `Application-Management`.

## Bơi ếch

Bơi ếch sở hữu runtime, D1 `boi-ech-db`, registry thiết bị `BE-`, tiến độ học, thanh toán, nội dung và audit của chính nó. Application Management chỉ quản trị từ xa qua Control API; không sở hữu database Bơi ếch.

Production Cloudflare hiện tại được giữ nhưng deployment đã chuyển sang **manual-only** trong giai đoạn migration. Một đường preview riêng dùng Worker `boi-ech-preview`, D1 `boi-ech-preview-db` và R2 `boi-ech-preview-payments` được dùng để kiểm chứng trước khi thay đổi production.

GitHub là source of truth. Không commit `.env`, token, khóa bí mật, D1 ID preview hoặc credential Cloudflare vào repository.

## Chạy Bơi ếch local

```bash
cd boi-ech
npm ci
npm run dev
```

Local dùng binding/database local riêng qua Vite/Miniflare; không thực hiện remote migration vào production.

## Gate release-readiness

Trước mọi preview/deploy, Bơi ếch chạy thêm audit:

```bash
cd boi-ech
npm run validate:release
```

Gate này kiểm tra production vẫn manual-only, quyền Học viên/Giảng viên vẫn dùng xác thực thiết bị và scope lớp, các workflow Giảng viên cốt lõi không quay lại placeholder, cùng các ranh giới media-free. Chi tiết xem `boi-ech/RELEASE_READINESS.md`.

## Mã nguồn Trung tâm cũ

```text
quan-ly-hoc-tap/
```

Không chạy workflow deploy từ thư mục này. Mọi thay đổi control-plane mới phải thực hiện tại:

```text
BlueDragon33/Application-Management
```

Yêu cầu Node.js `>=22.13.0`.


## Operational sovereignty

BOIECH_AI adopts **Universal Constitution 1.2.0** at **B3**.

Bơi ếch is currently in a truthful sovereignty migration:
- lessons and teaching truth must remain provider-independent;
- AI is optional intelligence only;
- Cloudflare Workers/D1/R2 currently remain essential for published device/progress/payment state;
- Application Management remains remote administration, not learner-state ownership;
- Google Drive or equivalent is optional export/backup, not runtime authority.

The project must not claim full local-first compliance until the documented migration blockers in `.blueprint/dependency-budget.json` are closed with evidence.
