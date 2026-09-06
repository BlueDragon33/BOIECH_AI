# Sức khỏe trẻ

Ứng dụng độc lập cho nội dung **Sức khỏe trẻ 9 tháng–5 tuổi**.

- Worker production: `suc-khoe-tre`
- D1 production: `suc-khoe-tre-db`
- Trung tâm quản trị: `learning-management`
- API quản trị nhận vé ngắn hạn có audience `child-health-control`.
- Dữ liệu học viên, tiến độ, thanh toán và AI của Bơi ếch không thuộc ứng dụng này.

## Chạy cục bộ

```bash
npm ci
npm run dev
```

## Kiểm tra

```bash
npm run lint
npx vite build
```

## Cơ sở dữ liệu

Migration nằm trong `drizzle/`. Ứng dụng chỉ duy trì các bảng phục vụ nội dung, thiết bị biên tập, thử thách xác thực và audit riêng của Sức khỏe trẻ.
