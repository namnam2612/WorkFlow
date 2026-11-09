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
- `admin`: toàn hệ thống. `leader`: quản lý dự án mình tạo (task, thành viên). `member`: xem task của dự án mình tham gia; cập nhật status/actualHours/bình luận task được giao cho mình; thêm công việc con vào task lớn được giao cho mình (giao cho chính mình hoặc để trống) và sửa/xóa công việc con do mình tạo.
- Kiểm tra ở backend (Guard `JwtAuthGuard`, `RolesGuard`, + kiểm tra truy cập dự án trong service). Frontend chỉ ẩn nút thêm cho UX.

## Quy ước
- Module theo tính năng (`backend/src/<feature>/`), tên biến/hàm tiếng Anh, text UI tiếng Việt.
- Thời gian lưu UTC; frontend hiển thị theo `Asia/Ho_Chi_Minh`.
- Không dùng `any`, `@ts-ignore`, không tắt lint rule. Không hard-code secret — mọi cấu hình qua env.
- Lỗi trả về thống nhất: `{ statusCode, error, message, path, timestamp }` (AllExceptionsFilter).
- Task → `done` set `completedAt`; rời `done` thì xóa.

## File đính kèm
- `backend/src/attachments/`: lưu qua `StorageService` (đổi sang S3/MinIO bằng cách thay provider trong `StorageModule`). Thư mục `UPLOAD_DIR` (mặc định `./uploads`, đã `.gitignore`); Docker dùng volume `uploads_data`. Xóa task/dự án phải dọn file (`AttachmentCleanupService`). Frontend tải/xem file bằng `fetchBlob` (có Authorization), không dùng thẻ `<a href>`/`<img src>` trực tiếp tới API.

## Lệnh chạy
```bash
cp .env.example .env && docker compose up -d mysql     # MySQL ở localhost:3307
cd backend && npm i && cp .env.example .env
npx prisma migrate deploy && npm run seed
npm run start:dev                          # API http://localhost:3000/api
npm run build && npm run lint && npm test  # 158 unit test
cd ../frontend && npm i && npm run dev     # http://localhost:5173 (proxy /api, /socket.io)
npm run build && npm run lint
docker compose up -d --build               # toàn bộ stack: web http://localhost:8080
```
Máy dev có MySQL riêng ở cổng 3306 — KHÔNG đụng vào; MySQL của dự án chạy ở 3307.
Đăng nhập thử bị giới hạn 10 lần/phút/IP: khi chạy script kiểm thử nhiều lần hãy khởi động lại backend để reset.

## Lưu ý khi sửa code
- Đổi `schema.prisma` → `npm run migrate:dev -- --name <ten>` (cần quyền shadow DB, đã cấp trong `docker/mysql-init`).
- Phân quyền theo dự án/task nằm ở `ProjectAccessService` + `TasksService`; thêm endpoint mới phải kiểm tra ở backend và có test.
- Frontend: không dùng `eslint-disable`; màu trạng thái/biểu đồ ở `lib/constants.ts`.
- Giao diện: nền tối đơn sắc (cảm hứng Lusion), trắng là màu nhấn. Token màu + keyframes ở `frontend/src/index.css` (thang `slate/brand/red/...` của Tailwind được ánh xạ lại sang bảng tối nên class cũ vẫn đúng). Hiệu ứng ở `components/fx/` (Reveal, TiltCard, ParticleBackground, LoadingScreen, HeroScene/three.js); tôn trọng `prefers-reduced-motion`. Có 2 giao diện Tối (mặc định) / Sáng: `<html data-theme>`, ghi nhớ ở localStorage `taskflow.theme`; bản sáng đảo `--color-white/--color-black` + ghi đè token trong `index.css`. Màu cố định trong code (biểu đồ, hạt, 3D) phải đọc `useTheme()`.

## Tài liệu
- `PROGRESS.md`: checklist tiến độ + "Quyết định thiết kế".
- `README.md`: hướng dẫn đầy đủ.
