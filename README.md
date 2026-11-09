# TaskFlow — Quản lý công việc nhóm

Web app để **Leader giao việc và theo dõi tiến độ/deadline** của từng thành viên; **thành viên xem việc cần làm, đang làm, đã làm**. Giao diện tiếng Việt, responsive.

- **Backend**: NestJS 11 + TypeScript, Prisma 6, MySQL 8 (InnoDB, `utf8mb4_unicode_ci`), JWT (access 15 phút + refresh 7 ngày, xoay vòng), Socket.IO, `@nestjs/schedule`
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS 4, React Router, TanStack Query, dnd-kit, Recharts, react-hook-form + zod
- Thời gian lưu **UTC**, hiển thị theo `Asia/Ho_Chi_Minh`.

## Tính năng

| Màn hình | Nội dung |
|---|---|
| Đăng nhập | JWT, tự refresh token (single-flight), route bảo vệ |
| Tổng quan | Số task theo trạng thái, sắp đến hạn (3 ngày), quá hạn (đỏ), tiến độ % từng dự án, biểu đồ workload theo thành viên |
| Kanban | 5 cột theo trạng thái, kéo thả đổi cột + thứ tự (cập nhật optimistic, hoàn tác khi lỗi), lọc theo người/ưu tiên |
| Công việc | Lọc (dự án, người, trạng thái, ưu tiên, khoảng deadline), tìm kiếm, sắp xếp, phân trang; bộ lọc lưu trên URL |
| Chi tiết task | Sửa thông tin, subtask, bình luận, lịch sử hoạt động (tự ghi) |
| Thành viên | Danh sách + trang từng người (đang làm / cần làm / đã xong / quá hạn); admin tạo/sửa/vô hiệu hóa người dùng |
| Dự án | Danh sách, tạo/sửa/xóa, quản lý thành viên |
| Thông báo | Chuông ở header (realtime qua Socket.IO), trang thông báo, đánh dấu đã đọc; cron mỗi giờ quét task sắp hạn/quá hạn |

### Phân quyền

| Vai trò | Quyền |
|---|---|
| `admin` | Toàn hệ thống: người dùng, vai trò, mọi dự án/task |
| `leader` | Tạo dự án; thêm/xóa thành viên; tạo/giao/sửa/xóa **mọi task trong dự án do mình tạo** |
| `member` | Xem task trong dự án mình tham gia; cập nhật **trạng thái, giờ thực tế, bình luận** trên task **được giao cho mình**; **thêm công việc con** vào task lớn được giao cho mình (chỉ giao cho chính mình hoặc để trống) và sửa/xóa công việc con do mình tạo |

Phân quyền được kiểm tra **ở backend** (`JwtAuthGuard` toàn cục, `RolesGuard` + `@Roles`, và `ProjectAccessService` cho quyền theo dự án/task cụ thể). Frontend chỉ ẩn nút để trải nghiệm tốt hơn.

## Yêu cầu cài đặt

- Node.js ≥ 20 (đã kiểm thử với 24) và npm
- Docker + Docker Compose (cho MySQL, hoặc chạy cả stack)

## Chạy nhanh bằng một lệnh

```bash
./dev.sh
```

Script tự bật Docker/MySQL, cài thư viện (lần đầu), áp dụng migration, tạo tài khoản admin nếu DB trống, chạy backend (`:3000`) và frontend (`:5173`) rồi mở trình duyệt. Dừng bằng `Ctrl+C` (hoặc nút Stop); MySQL vẫn chạy nền.
Trong VS Code: mở `dev.sh` và bấm ▶ của **Code Runner** (đã cấu hình trong `.vscode/settings.json`), hoặc `Cmd+Shift+B` để chạy task mặc định.

## Chạy để phát triển (từng bước thủ công)

```bash
# 1) Cấu hình & khởi động MySQL (host port 3307 — tránh đụng MySQL cài sẵn ở 3306)
cp .env.example .env
docker compose up -d mysql

# 2) Backend
cd backend
npm install
cp .env.example .env
npx prisma migrate deploy      # áp dụng migration
npm run seed:admin             # tạo tài khoản admin (hoặc: npm run seed = dữ liệu mẫu đầy đủ)
npm run start:dev              # API: http://localhost:3000/api

# 3) Frontend (terminal khác)
cd frontend
npm install
npm run dev                    # http://localhost:5173  (proxy /api và /socket.io sang :3000)
```

## Chạy toàn bộ bằng Docker

```bash
cp .env.example .env           # BẮT BUỘC đổi JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (openssl rand -hex 32)
docker compose up -d --build   # MySQL + API + web (nginx)
docker compose exec backend npm run seed   # (tuỳ chọn) nạp dữ liệu mẫu
```

- Web: http://localhost:8080 (nginx phục vụ SPA và chuyển tiếp `/api`, `/socket.io` sang backend)
- API: http://localhost:3000/api
- Backend tự chạy `prisma migrate deploy` khi khởi động.
- Dừng: `docker compose down` (thêm `-v` để xóa cả dữ liệu MySQL).

## Tài khoản & đăng ký

- Người dùng mới tự đăng ký ở trang `/register`: tài khoản luôn có vai trò **Thành viên** (không thể tự chọn vai trò). Admin vào **Thành viên** để nâng lên Trưởng nhóm, hoặc tự tạo tài khoản với vai trò bất kỳ.
- Leader thêm thành viên vào dự án thì họ mới thấy dự án đó.
- Muốn chỉ admin tạo tài khoản: đặt `ALLOW_REGISTRATION=false`.

### Tài khoản mẫu

Sau khi chạy `npm run seed`, mọi tài khoản dùng mật khẩu **`Password123!`** (đổi qua biến `SEED_DEFAULT_PASSWORD`):

| Vai trò | Email | Ghi chú |
|---|---|---|
| Admin | `admin@taskflow.vn` | Quản trị toàn hệ thống |
| Leader | `leader1@taskflow.vn` | Quản lý dự án "Website thương mại điện tử" và "Hệ thống báo cáo nội bộ" |
| Leader | `leader2@taskflow.vn` | Quản lý dự án "Ứng dụng di động Giao hàng" |
| Member | `member1@taskflow.vn` … `member5@taskflow.vn` | Thành viên các dự án (member1: Cường, member2: Dung, member3: Em, member4: Phong, member5: Giang) |

Dữ liệu mẫu: 3 dự án, 40 task (+ 8 subtask) với deadline đa dạng (có task **quá hạn** và **sắp đến hạn**), bình luận, lịch sử và thông báo.

## Lệnh hữu ích

```bash
# Backend (thư mục backend/)
npm run build        # prisma generate + nest build
npm run lint
npm test             # 73 unit test (auth, tasks, users, RolesGuard)
npm run seed:admin   # đảm bảo có admin (giữ nguyên dữ liệu), cấu hình qua ADMIN_EMAIL/ADMIN_PASSWORD
npm run reset        # XÓA TOÀN BỘ dữ liệu, chỉ giữ lại admin
npm run seed         # xóa hết rồi nạp dữ liệu mẫu để dùng thử
npm run migrate:dev -- --name <ten>   # tạo migration mới khi đổi schema.prisma
npx prisma studio    # xem dữ liệu

# Frontend (thư mục frontend/)
npm run build        # tsc -b && vite build
npm run lint
```

### Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | — | Chuỗi kết nối MySQL (bắt buộc) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | — | Bí mật ký JWT, ≥ 32 ký tự (bắt buộc; app từ chối khởi động nếu ngắn hơn) |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `15m` / `7d` | Thời hạn token |
| `CORS_ORIGIN` | `http://localhost:5173` | Origin được phép (phân tách bằng dấu phẩy) |
| `ALLOW_REGISTRATION` | `true` | `false` để tắt đăng ký công khai (chỉ admin tạo tài khoản) |
| `TRUST_PROXY` | `0` | Số reverse proxy phía trước API (docker/nginx = `1`) để rate limit theo IP client thật |
| `PORT` | `3000` | Cổng API |
| `SEED_DEFAULT_PASSWORD` | `Password123!` | Mật khẩu cho tài khoản mẫu |

## Cấu trúc thư mục

```
.
├── docker-compose.yml          # mysql + backend + frontend
├── docker/mysql-init/          # cấp quyền shadow DB cho prisma migrate dev
├── backend/
│   ├── prisma/                 # schema.prisma, migrations/, seed.ts
│   └── src/
│       ├── auth/               # login, refresh (rotate), logout, đổi mật khẩu, JWT strategy
│       ├── users/  projects/  tasks/  comments/  activity/  notifications/  dashboard/
│       ├── realtime/           # Socket.IO gateway (xác thực JWT ở handshake)
│       ├── scheduler/          # cron quét deadline mỗi giờ
│       ├── common/             # guards, decorators, filter lỗi thống nhất, DTO dùng chung
│       └── prisma/  config/
└── frontend/
    └── src/
        ├── pages/              # Dashboard, Kanban, Tasks, TaskDetail, Members, Projects, Notifications...
        ├── components/         # ui/, layout/, kanban/, tasks/, projects/, users/, dashboard/, notifications/
        ├── hooks/              # TanStack Query hooks, realtime
        ├── auth/               # AuthProvider, ProtectedRoute
        └── lib/                # api client (auto refresh), format (múi giờ VN), constants
```

## API chính

Tiền tố `/api`. Mọi route cần `Authorization: Bearer <accessToken>` trừ `login`, `refresh`, `logout`. Lỗi trả về thống nhất: `{ statusCode, error, message, path, timestamp }`.

| Nhóm | Endpoint | Quyền |
|---|---|---|
| Auth | `POST /auth/login` · `POST /auth/register` (công khai, luôn tạo `member`) · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/change-password` | công khai / đăng nhập |
| Users | `GET /users` (lọc, phân trang, kèm thống kê) · `GET /users/:id` · `POST /users` · `PATCH /users/:id` | list/get: theo phạm vi dự án; tạo: admin; sửa: admin hoặc chính mình (giới hạn trường) |
| Projects | `GET /projects` · `POST /projects` · `GET/PATCH/DELETE /projects/:id` · `POST /projects/:id/members` · `DELETE /projects/:id/members/:userId` | tạo: admin/leader; sửa/xóa/thành viên: admin hoặc leader của dự án |
| Tasks | `GET /tasks` (lọc, tìm kiếm, sắp xếp, phân trang) · `GET /tasks/board?projectId=` · `POST /tasks` (kèm `parentId` = subtask) · `GET/PATCH/DELETE /tasks/:id` · `PATCH /tasks/:id/move` (status + position) | tạo task lớn/xóa: leader của dự án/admin; tạo công việc con: thêm cả assignee của task cha; sửa: leader/admin (mọi trường), assignee (status, actualHours), người tạo công việc con (mọi trường của việc con đó); move: leader/admin hoặc assignee |
| Comments | `GET/POST /tasks/:id/comments` · `DELETE /comments/:id` | xem: thành viên dự án; viết: leader/admin, assignee, và với công việc con thêm người tạo việc con + assignee của task cha; xóa: tác giả hoặc leader/admin |
| Activity | `GET /tasks/:id/activity` | thành viên dự án |
| Notifications | `GET /notifications` · `GET /notifications/unread-count` · `PATCH /notifications/:id/read` · `POST /notifications/read-all` · `POST /notifications/scan-deadlines` | người dùng; `scan-deadlines`: admin |
| Dashboard | `GET /dashboard?projectId=&mine=` | đăng nhập (member luôn xem "của tôi") |
| Realtime | Socket.IO (`auth.token` = access token): sự kiện `notification`, `task:changed` | đăng nhập |

## Ghi chú thiết kế & lưu ý

- Quyết định thiết kế chi tiết nằm ở mục "Quyết định thiết kế" trong [PROGRESS.md](PROGRESS.md); quy ước code ở [CLAUDE.md](CLAUDE.md).
- Refresh token lưu **hash SHA-256** trong DB, xoay vòng mỗi lần refresh; dùng lại token đã thu hồi sẽ thu hồi toàn bộ phiên của người dùng. Frontend lưu token trong `localStorage` (đơn giản, nhưng nhạy với XSS — môi trường production nên cân nhắc cookie `HttpOnly`).
- Đăng nhập giới hạn 10 lần/phút/IP; toàn API 600 request/phút/IP.
- Task kéo ra khỏi/vào `done` tự xóa/đặt `completedAt`. Subtask chỉ 1 cấp.
- Chưa có: upload ảnh đại diện (chỉ nhận URL), quên mật khẩu qua email, test e2e tự động trong repo.

## Deploy lên máy chủ (Ubuntu + Docker + nginx + HTTPS)

```bash
# Từ máy của bạn (cần đăng nhập SSH được vào server, tài khoản có sudo)
LE_EMAIL=ban@example.com DOMAIN=alpha.hopphu.vn ./deploy/deploy.sh user@103.175.146.251
```

Script `deploy/remote-setup.sh` chạy trên server: cài Docker/nginx/certbot, nhận mã nguồn đã commit qua SSH (không cần quyền GitHub), sinh `.env` với secret ngẫu nhiên (giữ nguyên nếu đã có), chạy `deploy/docker-compose.prod.yml` (MySQL và backend không mở cổng ra ngoài; frontend chỉ ở `127.0.0.1:18080`), tạo tài khoản admin nếu DB trống, cấu hình vhost nginx và cấp chứng chỉ Let's Encrypt. Mật khẩu admin được in ra ở cuối nếu không đặt `ADMIN_PASSWORD`. Chạy lại script để cập nhật phiên bản mới.
