# TaskFlow — Quản lý công việc nhóm

Web app để **Leader giao việc và theo dõi tiến độ/deadline** của từng thành viên; **thành viên xem việc cần làm, đang làm, đã làm**. Giao diện tiếng Việt, responsive.

- **Backend**: NestJS 11 + TypeScript, Prisma 6, MySQL 8 (InnoDB, `utf8mb4_unicode_ci`), JWT (access 15 phút + refresh 7 ngày, xoay vòng), Socket.IO, `@nestjs/schedule`
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS 4, React Router, TanStack Query, dnd-kit, Recharts, react-hook-form + zod
- Thời gian lưu **UTC**, hiển thị theo `Asia/Ho_Chi_Minh`.

## Tính năng

| Màn hình | Nội dung |
|---|---|
| Đăng nhập | JWT, tự refresh token (single-flight), route bảo vệ |
| Tổng quan | Số task theo nhóm trạng thái (cần làm / đang làm / hoàn thành) + phân bố từng trạng thái, sắp đến hạn (3 ngày), quá hạn (đỏ), tiến độ % từng dự án, biểu đồ workload theo thành viên |
| Kanban | Cột theo **trạng thái tùy biến của từng dự án** (mặc định Cần làm / Đang làm / Chờ duyệt / Hoàn thành / Bị chặn), tab **Bug** có vòng đời riêng; kéo thả đổi cột + thứ tự (cập nhật optimistic, hoàn tác khi lỗi), lọc theo người/ưu tiên; nút "Tùy chỉnh cột" (đổi tên/màu/nhóm/thứ tự, xóa kèm chuyển việc) |
| Công việc | Lọc (dự án, người, trạng thái, ưu tiên, khoảng deadline), tìm kiếm, sắp xếp, phân trang; bộ lọc lưu trên URL |
| Chi tiết task | Sửa thông tin, subtask, bình luận, lịch sử hoạt động (tự ghi) |
| Giao việc cho nhiều người | Một công việc giao được cho nhiều thành viên cùng làm (chọn nhiều người có tìm kiếm, avatar + tên). Thẻ Kanban/danh sách hiển thị chồng avatar (tối đa 3 + "+N", rê chuột xem tên); chi tiết task thêm/bớt người trực tiếp; lọc theo nhiều người. Người mới thêm mới nhận thông báo "được giao"; thông báo bình luận/đổi trạng thái/deadline/sắp hạn/quá hạn gửi cho TẤT CẢ người được giao; lịch sử ghi "A đã giao việc cho B, C". Thống kê/workload tính task cho từng người |
| Kho tài liệu dạng thư mục | Trang **Kho tài liệu** (`/files`) duyệt như thư mục trên máy tính: **Dự án → Công việc → File**. Mỗi dự án là một thư mục (chỉ dự án bạn được xem), bên trong có mục "File chung của dự án" và các task có file (bật "Hiện cả task chưa có file" để xem cả task trống); mỗi thư mục ghi số file · dung lượng. Có breadcrumb, link riêng cho từng cấp (bấm Back/chia sẻ được), lưới ⇄ danh sách (ghi nhớ), phân trang 20 mục, sắp xếp theo tên hoặc cập nhật mới nhất, ô tìm file trên TOÀN kho (kết quả ghi đường dẫn `Dự án / Task`), nút "Mở dự án"/"Mở công việc" và "Tải lên file" ngay trong thư mục. Danh sách phẳng cũ (tab Tài liệu/Ảnh, nhóm theo ngày) vẫn ở `/documents` ("Xem tất cả file") |
| File đính kèm | Đính kèm được cho **công việc** và cho **dự án**, và chọn file ngay trong form Tạo/Sửa (file lỗi không làm mất dự án/công việc, thử lại được). Mỗi nơi đính kèm nhiều file (kéo thả, thanh tiến trình, xem trước ảnh/PDF, tải về, xóa); trang **Kho tài liệu** gom mọi file, tách tab **Tài liệu** / **Ảnh** (không lẫn nhau), nhóm theo ngày gửi (Hôm nay, Hôm qua, ...), hiển thị task/dự án chứa file và **Người gửi** (avatar + tên + thời gian), lọc theo tên/dự án/người gửi/loại/ngày, dạng bảng hoặc lưới có ảnh thu nhỏ. Xem trước ngay trên web: ảnh (kể cả SVG), PDF, văn bản/Markdown/JSON/XML/YAML, CSV, HTML, Word (.docx), Excel (.xlsx), PowerPoint (.pptx) |
| Thành viên | Danh sách + trang từng người (đang làm / cần làm / đã xong / quá hạn); admin tạo/sửa/vô hiệu hóa người dùng |
| Dự án | Danh sách, tạo/sửa/xóa, quản lý thành viên, chọn **nhóm phụ trách** (thành viên nhóm tự vào dự án), Slack webhook, liên kết cổng khách. Trang chi tiết có lối tắt tới Kanban, Backlog, Gantt, Báo cáo, Phát hành, Kiểm thử, Tài liệu, Tự động hóa |
| Hôm nay (My Work) | "Hôm nay cần làm gì": việc của tôi chia nhóm **Quá hạn / Đến hạn hôm nay / Đang làm / Sắp tới 7 ngày** theo ngày giờ Việt Nam; tích để hoàn thành ngay |
| Loại công việc & Bug | Loại: Công việc, **User Story**, **Bug**, **Epic**; Story Point; Bug có mức nghiêm trọng, **môi trường (Dev/Staging/Prod)**, phiên bản phát hiện/sửa và bộ trạng thái riêng (Mới → Đã xác nhận → Đang sửa → Chờ kiểm thử → Mở lại/Đã đóng) |
| Backlog & Sprint | Sprint (kế hoạch → đang chạy → kết thúc, mỗi dự án một sprint chạy), Epic gom Story, chuyển việc giữa backlog và sprint, mục tiêu sprint, **capacity thực tế** (ngày công trừ nghỉ phép). Kết thúc sprint ghi velocity và chuyển việc dở về backlog/sprint khác |
| Báo cáo | **Burndown** theo ngày (điểm hoặc số việc), **Velocity** các sprint đã kết thúc (+ trung bình 3 sprint), **chấm công** theo người |
| Thời gian làm việc (work log) | Người được giao ghi thời gian theo ngày ("1g30", "90p"); giờ thực tế của việc = tổng các lần ghi |
| Lịch & Gantt | Trang **Lịch** (tháng): deadline, ngày bắt đầu, mốc sprint, ngày nghỉ đã duyệt; **Gantt** theo epic với thanh tiến độ và **phụ thuộc** "xong rồi mới bắt đầu" (chặn vòng lặp, cảnh báo đỏ khi sai thứ tự ngày) |
| Nhóm (Team) | Nhóm là thực thể riêng: trưởng nhóm, thành viên có chuyên môn (Dev/QA/Designer/Khác), phụ trách nhiều dự án |
| Nghỉ phép | Xin nghỉ (phép năm/ốm/không lương), leader/admin của nhóm/dự án duyệt, đồng đội chỉ thấy ngày nghỉ đã duyệt (ẩn lý do); capacity tính theo T2–T6 giờ VN × 8 giờ |
| Tài liệu (Wiki) | Trang Markdown (GFM) theo dự án có cây trang, xem trước khi soạn, lịch sử 30 bản + khôi phục, chống ghi đè đồng thời, mẫu tài liệu API. Markdown không cho HTML thô (không XSS) |
| Kiểm thử (QA) | Test case (tiền điều kiện, bước, kết quả mong đợi), **đợt kiểm thử** theo môi trường/phiên bản; ghi Đạt/Lỗi/Bị chặn/Bỏ qua; **Lỗi tự tạo Bug** (kế thừa môi trường + phiên bản, không sinh trùng) |
| Phát hành | Phiên bản semver (v1.1.0), gắn việc/Bug vào phiên bản, phát hành (chặn khi còn việc dở trừ khi xác nhận), **release notes** Markdown tự tạo |
| Tự động hóa | Quy tắc "khi (tạo việc / đổi trạng thái / được giao) + điều kiện → đổi trạng thái, giao việc, đổi ưu tiên, bình luận, thông báo"; chạy với quyền hệ thống, ghi lịch sử, chống vòng lặp |
| Tìm kiếm | Tìm xuyên dự án (việc, bình luận, tài liệu, test case, phiên bản, file): nhiều từ khóa, không phân biệt hoa/thường và dấu (kể cả d↔đ), xếp theo độ liên quan |
| Cổng khách hàng | Liên kết bí mật `/portal/:token` cho khách xem roadmap **chỉ đọc**, không cần tài khoản (tiến độ, epic, sprint, phiên bản); không lộ người dùng/bình luận/file/việc nội bộ |
| Thông báo ngoài hệ thống | **Email** (SMTP, mỗi người tự bật trong Hồ sơ) và **Slack webhook** theo dự án |
| Thông báo | Chuông ở header (realtime qua Socket.IO), trang thông báo, đánh dấu đã đọc; cron mỗi giờ quét task sắp hạn/quá hạn |

### Phân quyền

| Vai trò | Quyền |
|---|---|
| `admin` | Toàn hệ thống: người dùng, vai trò, mọi dự án/task |
| `leader` | Tạo dự án; thêm/xóa thành viên; tạo/giao/sửa/xóa **mọi task trong dự án do mình tạo** |
| `member` | Xem task trong dự án mình tham gia; viết test case/tài liệu và ghi kết quả kiểm thử; cập nhật **trạng thái, giờ thực tế, bình luận** trên task **được giao cho mình**; **thêm công việc con** vào task lớn được giao cho mình (chỉ giao cho chính mình hoặc để trống) và sửa/xóa công việc con do mình tạo |

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
npm test             # 261 unit test (auth, tasks, users, attachments, files, RolesGuard...)
npm run seed:admin   # đảm bảo có admin (giữ nguyên dữ liệu), cấu hình qua ADMIN_EMAIL/ADMIN_PASSWORD
npm run reset        # XÓA TOÀN BỘ dữ liệu, chỉ giữ lại admin
npm run seed         # xóa hết rồi nạp dữ liệu mẫu để dùng thử
npm run migrate:dev -- --name <ten>   # tạo migration mới khi đổi schema.prisma
npx prisma studio    # xem dữ liệu
npm run build && npm run migrate:files -- --dry-run   # xem trước việc chuyển file sang cấu trúc thư mục mới (không đổi gì)
npm run migrate:files                                   # chuyển file + cập nhật cột Attachment.path (chạy lại nhiều lần an toàn)

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
| `UPLOAD_DIR` | `./uploads` | Thư mục lưu file đính kèm (Docker: `/app/uploads`, nằm trên volume `uploads_data`) |
| `MAX_UPLOAD_SIZE` | `20971520` | Dung lượng tối đa mỗi file đính kèm, đơn vị byte (20MB) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | — / `587` / `false` | Gửi email thông báo; để trống `SMTP_HOST` = tắt kênh email (mỗi người còn phải tự bật trong Hồ sơ) |
| `APP_URL` | — | Địa chỉ web của ứng dụng, dùng làm link trong email/Slack (Docker tự lấy từ `PUBLIC_URL`/`CORS_ORIGIN`) |
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
| Users | `GET /users` (lọc, phân trang, kèm thống kê) · `GET /users/:id` · `POST /users` · `PATCH /users/:id` (gồm trường hồ sơ) · `PUT/DELETE /users/:id/avatar` (multipart `file`) · `GET /users/:id/avatar` (công khai) | list/get: theo phạm vi dự án; tạo: admin; sửa: admin hoặc chính mình (giới hạn trường) |
| Projects | `GET /projects` · `POST /projects` · `GET/PATCH/DELETE /projects/:id` · `POST /projects/:id/members` · `DELETE /projects/:id/members/:userId` | tạo: admin/leader; sửa/xóa/thành viên: admin hoặc leader của dự án |
| Tasks | `GET /tasks` (lọc, tìm kiếm, sắp xếp, phân trang; `assigneeIds=1,2` = task có bất kỳ người nào trong danh sách) · `GET /tasks/board?projectId=` · `POST /tasks` (kèm `parentId` = subtask; `assigneeIds: number[]` = những người cùng thực hiện) · `GET/PATCH/DELETE /tasks/:id` · `PATCH /tasks/:id/move` (status + position) | tạo task lớn/xóa: leader của dự án/admin; tạo công việc con: thêm cả người được giao của task cha; sửa: leader/admin (mọi trường), người được giao (status, actualHours), người tạo công việc con (mọi trường của việc con đó); move: leader/admin hoặc người được giao |
| Comments | `GET/POST /tasks/:id/comments` · `DELETE /comments/:id` | xem: thành viên dự án; viết: leader/admin, MỘT trong những người được giao, và với công việc con thêm người tạo việc con + người được giao của task cha; xóa: tác giả hoặc leader/admin |
| Attachments | `POST /tasks/:taskId/attachments` (multipart, field `files`, tối đa 10 file) · `GET /tasks/:taskId/attachments` · `POST /projects/:projectId/attachments` · `GET /projects/:projectId/attachments` · `GET /attachments` (danh sách phẳng, mỗi file có `source=project\|task`: `search, projectId, source=project\|task, uploaderId, type=image\|pdf\|document\|spreadsheet\|other\|file` (`file` = mọi thứ không phải ảnh; kết quả kèm `counts` theo loại)`, from, to, sortBy=createdAt\|name\|size, order, page, pageSize`) · `GET /attachments/:id/download` · `GET /attachments/:id/preview` (ảnh, PDF, txt/md/csv/json/xml/yaml, html, docx, xlsx, pptx) · `DELETE /attachments/:id` | xem/tải: thành viên dự án (admin: tất cả); tải lên file công việc: thành viên dự án; tải lên file dự án: leader của dự án, admin; xóa: người gửi, leader của dự án, admin |
| Files (Kho tài liệu dạng thư mục) | `GET /files/projects` (cấp 1: dự án + số file/dung lượng/file mới nhất) · `GET /files/projects/:id` (cấp 2: `common` = file chung, danh sách task kèm số file; `includeEmpty=true` lấy cả task chưa có file) · `GET /files/projects/:id/files` (file chung) · `GET /files/tasks/:id` (cấp 3: thông tin task + file) · `GET /files/search?q=` (tìm theo tên trên toàn kho). Mọi cấp: `page, pageSize` (mặc định 20), `search`, `sortBy=name\|updatedAt` (file: thêm `size`), `order` | chỉ trong các dự án người dùng được xem (admin: tất cả); người ngoài nhận 403 |
| Trạng thái | `GET/POST /projects/:id/statuses` · `PATCH/DELETE /projects/:id/statuses/:statusId` (xóa cần `?moveTo=` nếu còn việc) · `PUT /projects/:id/statuses/order` | xem: thành viên; sửa: leader dự án/admin |
| Hôm nay | `GET /tasks/my-work` | đăng nhập |
| Sprint & Backlog | `GET/POST /projects/:id/sprints` · `PATCH/DELETE /sprints/:id` · `POST /sprints/:id/start\|complete` · `POST /sprints/:id/tasks`, `POST /projects/:id/backlog/tasks` · `GET /projects/:id/backlog` · `GET /sprints/:id/burndown\|capacity` · `GET /projects/:id/velocity` | xem: thành viên; ghi: leader dự án/admin |
| Work log | `GET/POST /tasks/:id/worklogs` · `DELETE /worklogs/:id` · `GET /projects/:id/timesheet` | ghi: người được giao hoặc leader/admin |
| Nhóm | `GET/POST /teams` · `GET/PATCH/DELETE /teams/:id` · `POST /teams/:id/members` · `PATCH/DELETE /teams/:id/members/:userId` | xem: thành viên nhóm; ghi: trưởng nhóm/admin (nhóm ngoài phạm vi trả 404) |
| Nghỉ phép | `GET/POST /leaves` · `POST /leaves/:id/cancel\|review` · `GET /projects/:id/capacity` | gửi: mọi người; duyệt: admin hoặc leader của nhóm/dự án có người đó (không tự duyệt) |
| Lịch & Gantt | `GET /calendar?from=&to=&projectId=&mine=` · `GET /projects/:id/gantt` · `POST/DELETE /tasks/:id/dependencies` | xem: thành viên dự án; phụ thuộc: leader/admin |
| Phát hành | `GET/POST /projects/:id/releases` · `GET/PATCH/DELETE /releases/:id` · `POST /releases/:id/publish` | xem: thành viên; ghi: leader dự án/admin |
| Kiểm thử | `GET/POST /projects/:id/test-cases` · `PATCH/DELETE /test-cases/:id` · `GET/POST /projects/:id/test-runs` · `GET /test-runs/:id` · `POST /test-runs/:id/close` · `PATCH /test-results/:id` (Fail tự tạo Bug) | thành viên dự án |
| Tài liệu | `GET/POST /projects/:id/wiki` · `GET/PATCH/DELETE /wiki/:id` · `GET /wiki/:id/revisions` · `POST /wiki/:id/revisions/:revId/restore` · `GET /wiki-templates/api-spec` | thành viên dự án; xóa: người tạo/leader/admin |
| Tự động hóa | `GET/POST /projects/:id/automations` · `PATCH/DELETE /automations/:id` | xem: thành viên; ghi: leader dự án/admin |
| Tìm kiếm | `GET /search?q=&projectId=` | chỉ trong dự án được xem |
| Cổng khách hàng | `GET/POST /projects/:id/guest-links` · `DELETE /guest-links/:id` · `GET /public/portal/:token` (**công khai**, 30 lượt/phút/IP) | quản lý: leader dự án/admin |
| Activity | `GET /tasks/:id/activity` | thành viên dự án |
| Notifications | `GET /notifications` · `GET /notifications/unread-count` · `PATCH /notifications/:id/read` · `POST /notifications/read-all` · `POST /notifications/scan-deadlines` | người dùng; `scan-deadlines`: admin |
| Dashboard | `GET /dashboard?projectId=&mine=` | đăng nhập (member luôn xem "của tôi") |
| Realtime | Socket.IO (`auth.token` = access token): sự kiện `notification`, `task:changed` | đăng nhập |

## Ghi chú thiết kế & lưu ý
- **File đính kèm**: file nằm trên ổ đĩa ở `UPLOAD_DIR`, tên lưu là UUID (không lộ tên gốc); DB (`Attachment`) giữ metadata. Việc đọc/ghi đi qua `StorageService` nên chuyển sang S3/MinIO chỉ cần viết một lớp mới và đổi provider trong `StorageModule`. Loại file do server quyết định theo đuôi; chặn file thực thi theo đuôi lẫn chữ ký (ELF/PE/Mach-O/shebang). Xem trực tiếp cho ảnh, PDF, văn bản, html, docx, xlsx, pptx và kiểm tra chữ ký thật; các loại Office được dựng ngay ở trình duyệt (mammoth, read-excel-file, jszip, tải khi cần), không gửi file cho dịch vụ bên thứ ba. HTML và Word hiển thị trong iframe `sandbox` (không script; HTML còn có CSP chặn tải tài nguyên ngoài); SVG chỉ hiển thị qua thẻ `<img>`. PowerPoint là bản xem nhanh (chữ + ảnh từng slide, không bố cục). Xóa task/dự án sẽ dọn cả file trên ổ đĩa. Cấu trúc thư mục trên ổ đĩa: `uploads/projects/{projectId}/{uuid}.{ext}` (file của dự án) và `uploads/projects/{projectId}/tasks/{taskId}/{uuid}.{ext}` (file của task); xóa task/dự án xóa luôn thư mục tương ứng. **File đã lưu theo cấu trúc cũ (`YYYY/MM/uuid.ext`)** vẫn tải được nhưng nên chuyển sang cấu trúc mới bằng `npm run migrate:files` (trong Docker: `docker compose exec backend npm run migrate:files`; trên server prod: `docker compose -p taskflow-alpha -f deploy/docker-compose.prod.yml exec backend npm run migrate:files`). Nên chạy `-- --dry-run` trước và sao lưu thư mục uploads + MySQL; script không bao giờ ghi đè file khác, báo file bị mất thay vì dừng, và dọn thư mục năm/tháng cũ đã rỗng. **Khi deploy phải giữ volume `uploads_data`** (đã khai báo ở compose) và sao lưu cùng MySQL.

- Quyết định thiết kế chi tiết nằm ở mục "Quyết định thiết kế" trong [PROGRESS.md](PROGRESS.md); quy ước code ở [CLAUDE.md](CLAUDE.md).
- Refresh token lưu **hash SHA-256** trong DB, xoay vòng mỗi lần refresh; dùng lại token đã thu hồi sẽ thu hồi toàn bộ phiên của người dùng. Frontend lưu token trong `localStorage` (đơn giản, nhưng nhạy với XSS — môi trường production nên cân nhắc cookie `HttpOnly`).
- Đăng nhập giới hạn 10 lần/phút/IP; toàn API 600 request/phút/IP.
- Task kéo ra khỏi/vào `done` tự xóa/đặt `completedAt`. Subtask chỉ 1 cấp.
- Chưa có: upload ảnh đại diện (chỉ nhận URL), quên mật khẩu qua email, test e2e tự động trong repo.
- **Trạng thái tùy biến**: mỗi dự án có 2 bộ trạng thái (công việc / Bug), mỗi trạng thái thuộc một *nhóm* (cần làm / đang làm / hoàn thành); hệ thống chỉ dựa vào nhóm để tính tiến độ, quá hạn, `completedAt`. Mỗi bộ luôn phải còn ít nhất một trạng thái "hoàn thành" và một trạng thái chưa xong. Migration giữ nguyên dữ liệu cũ (5 trạng thái cũ thành 5 trạng thái cùng tên).
- **Bug dùng chung bảng `Task`** (`type = bug`) nhưng có bộ trạng thái riêng; kéo Bug sang cột công việc bị từ chối. Đổi loại task ⇄ Bug tự ánh xạ trạng thái theo nhóm.
- **Burndown** dựa vào `completedAt` nên việc mở lại sau khi xong chỉ được tính theo trạng thái hiện tại; chưa ước lượng điểm thì đếm theo số việc.
- **Capacity** chỉ trừ ngày nghỉ đã duyệt và cuối tuần (chưa có lịch nghỉ lễ), 8 giờ/ngày (`HOURS_PER_DAY`).
- **Fail tự sinh Bug** chạy với quyền của người ghi kết quả (QA không cần là leader); Bug nằm ở trạng thái đầu bộ Bug, chưa có người xử lý.
- **Tự động hóa** ghi thẳng DB với quyền hệ thống nên hành động của quy tắc KHÔNG kích hoạt quy tắc khác; điều kiện luôn so với trạng thái lúc xảy ra sự kiện (không có chuỗi A→B→A).
- **Cổng khách hàng**: token chỉ hiện một lần khi tạo, DB chỉ lưu băm SHA-256 (mất link thì tạo link mới, thu hồi link cũ); sai token/thu hồi/hết hạn cùng trả 404.
- **Email/Slack** gửi nền, lỗi kênh ngoài không làm hỏng thao tác; Slack chỉ nhận `https://hooks.slack.com/...` (chống SSRF) và URL webhook không bao giờ trả về qua API.
- **Tìm kiếm**: MySQL `utf8mb4_unicode_ci` coi ă/â/ơ/dấu thanh là chữ gốc nhưng `đ` ≠ `d`, nên truy vấn thử thêm biến thể d↔đ; nhiều từ khóa là AND. Chưa dùng full-text index.
- **Gỡ khỏi nhóm không gỡ khỏi dự án** (người đó có thể đang giữ việc); thêm vào nhóm thì vào luôn mọi dự án của nhóm.

## Deploy lên máy chủ (Ubuntu + Docker + nginx + HTTPS)

```bash
# Từ máy của bạn (cần đăng nhập SSH được vào server, tài khoản có sudo)
LE_EMAIL=ban@example.com ./deploy/deploy.sh root@103.175.146.251   # gửi mã nguồn đã commit qua SSH
```

Script `deploy/remote-setup.sh` chạy trên server: cài Docker/nginx/certbot, nhận mã nguồn đã commit qua SSH (không cần quyền GitHub), sinh `.env` với secret ngẫu nhiên (giữ nguyên nếu đã có), chạy `deploy/docker-compose.prod.yml` (MySQL và backend không mở cổng ra ngoài; frontend chỉ ở `127.0.0.1:18080`), tạo tài khoản admin nếu DB trống, cấu hình vhost nginx và cấp chứng chỉ Let's Encrypt. Mật khẩu admin được in ra ở cuối nếu không đặt `ADMIN_PASSWORD`. Chạy lại script để cập nhật phiên bản mới.
