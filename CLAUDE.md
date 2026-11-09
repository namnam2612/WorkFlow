# TaskFlow — Quản lý công việc nhóm

Web app để Leader giao việc và theo dõi tiến độ/deadline; thành viên xem việc cần làm, đang làm, đã làm. Giao diện tiếng Việt.

## Tech stack
- Monorepo: `backend/`, `frontend/`, `docker-compose.yml`
- Backend: NestJS 11 + TypeScript, Prisma 6, MySQL 8 (InnoDB, utf8mb4_unicode_ci)
- Auth: JWT access (15 phút) + refresh (7 ngày, lưu hash trong DB, rotate), bcrypt
- Validation: class-validator + DTO cho mọi request; `ValidationPipe` global (whitelist, forbidNonWhitelisted)
- Realtime: Socket.IO (gateway thông báo); cron: `@nestjs/schedule`
- Frontend: React 19 + Vite + TS + Tailwind 4, React Router 7, TanStack Query, dnd-kit, Recharts, react-hook-form + zod

## Phân quyền
- `admin`: toàn hệ thống. `leader`: quản lý dự án mình tạo (task, thành viên). `member`: xem task của dự án mình tham gia; chỉ cập nhật status/actualHours/bình luận task được giao cho mình.
- Kiểm tra ở backend (Guard `JwtAuthGuard`, `RolesGuard`, + kiểm tra truy cập dự án trong service). Frontend chỉ ẩn nút thêm cho UX.

## Quy ước
- Module theo tính năng (`backend/src/<feature>/`), tên biến/hàm tiếng Anh, text UI tiếng Việt.
- Thời gian lưu UTC; frontend hiển thị theo `Asia/Ho_Chi_Minh`.
- Không dùng `any`, `@ts-ignore`, không tắt lint rule. Không hard-code secret — mọi cấu hình qua env.
- Lỗi trả về thống nhất: `{ statusCode, error, message, path, timestamp }` (AllExceptionsFilter).
- Task → `done` set `completedAt`; rời `done` thì xóa.

## Lệnh chạy
```bash
cp .env.example .env && docker compose up -d mysql     # MySQL ở localhost:3307
cd backend && npm i && cp .env.example .env
npx prisma migrate deploy && npm run seed
npm run start:dev                          # API http://localhost:3000/api
npm run build && npm run lint && npm test  # 73 unit test
cd ../frontend && npm i && npm run dev     # http://localhost:5173 (proxy /api, /socket.io)
npm run build && npm run lint
docker compose up -d --build               # toàn bộ stack: web http://localhost:8080
```
Máy dev có MySQL riêng ở cổng 3306 — KHÔNG đụng vào; MySQL của dự án chạy ở 3307.
Đăng nhập thử bị giới hạn 10 lần/phút/IP: khi chạy script kiểm thử nhiều lần hãy khởi động lại backend để reset.

## Lưu ý khi sửa code
- Đổi `schema.prisma` → `npm run migrate:dev -- --name <ten>` (cần quyền shadow DB, đã cấp trong `docker/mysql-init`).
- Phân quyền theo dự án/task nằm ở `ProjectAccessService` + `TasksService`; thêm endpoint mới phải kiểm tra ở backend và có test.
- Frontend: không dùng `eslint-disable`; màu biểu đồ theo bảng đã validate (`lib/constants.ts`).

## Tài liệu
- `PROGRESS.md`: checklist tiến độ + "Quyết định thiết kế".
- `README.md`: hướng dẫn đầy đủ.
