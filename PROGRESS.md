# Tiến độ

## Giai đoạn 1 — Nền tảng
- [x] Monorepo, docker-compose MySQL
- [x] Prisma schema + migration (thêm model RefreshToken)
- [x] Seed (1 admin, 2 leader, 5 member, 3 dự án, 40 task + 8 subtask, 6 task quá hạn)
- [x] `.env.example`

## Giai đoạn 2 — Auth
- [x] Backend: login / refresh / logout / me / đổi mật khẩu, Guard theo role
- [x] Frontend: đăng nhập, tự refresh token (single-flight), layout chung, route bảo vệ

## Giai đoạn 3 — CRUD
- [x] Backend: User, Project, ProjectMember
- [x] Backend: Task + subtask, danh sách có lọc/sắp xếp/phân trang, board, move
- [x] Frontend: Dự án (+ quản lý thành viên), Danh sách task (lọc/sắp xếp/phân trang, đồng bộ URL), Chi tiết task, Thành viên (+ admin tạo/sửa user)

## Giai đoạn 4 — Kanban
- [x] API status + position (PATCH /tasks/:id/move, đánh số lại cột trong transaction)
- [x] Frontend dnd-kit (kéo thả đổi cột + thứ tự), optimistic update có rollback, lọc người/ưu tiên (đã E2E bằng Playwright)

## Giai đoạn 5 — Tương tác
- [x] Bình luận (GET/POST /tasks/:id/comments), activity log tự ghi + tab lịch sử
- [x] Thông báo realtime Socket.IO (xác thực JWT ở handshake) + chuông + trang thông báo
- [x] Cron mỗi giờ quét sắp hạn (<=24h)/quá hạn, chống trùng; admin chạy tay: POST /notifications/scan-deadlines

## Giai đoạn 6 — Dashboard & Thành viên
- [x] API thống kê (GET /dashboard: theo trạng thái, sắp hạn 3 ngày, quá hạn, tiến độ dự án, workload)
- [x] Dashboard (Recharts, bảng thay thế), trang thành viên (đã làm ở giai đoạn 3)

## Giai đoạn 7 — Hoàn thiện
- [x] Unit test: auth (16), tasks (~35), users + RolesGuard — tổng 73 test, mock Prisma
- [x] Rà soát phân quyền (ma trận 3 vai trò qua curl + Playwright + unit test), lỗi thống nhất (AllExceptionsFilter), loading/empty/error state ở mọi trang
- [x] Dockerfile backend + frontend (nginx proxy /api + /socket.io), compose chạy full stack — đã kiểm thử từ DB trống
- [x] Kiểm tra cuối, README

## Giai đoạn 8 — File đính kèm & Kho tài liệu
- [x] Prisma `Attachment` (+ migration), `StorageService` (local, UUID, `UPLOAD_DIR`), Multer 20MB/file (`MAX_UPLOAD_SIZE`), chặn file thực thi
- [x] API upload/list theo task, Kho tài liệu `GET /attachments` (tìm tên, dự án, người gửi, loại, ngày, sắp xếp, phân trang), download (tên tiếng Việt), preview ảnh/PDF, xóa; phân quyền theo dự án; ActivityLog
- [x] Frontend: khu "File đính kèm" trong chi tiết task (kéo thả, tiến trình), trang Kho tài liệu (bảng/lưới, link tới task, "Người gửi"), xem trước trong modal, số file 📎 trên Kanban và danh sách task
- [x] Kho tài liệu tách tab Tài liệu/Ảnh, nhóm theo ngày; xem trước thêm txt/md/csv/json/xml/yaml/html/docx/xlsx/pptx/svg (migration backfill mimeType cho file cũ)
- [x] Seed có file mẫu do nhiều người gửi; test phân quyền AttachmentsService; docker volume `uploads_data`, nginx cho phép body lớn

## Giai đoạn 9 — Đính kèm file ngay trong form & file của dự án
- [x] `Attachment.projectId` (nullable, migration `project_attachments` giữ nguyên dữ liệu cũ): một file thuộc DÚNG MỘT nơi, dự án (projectId) hoặc công việc (taskId); service kiểm tra ràng buộc (MySQL không cho CHECK trên cột có FK ON DELETE)
- [x] API `GET/POST /projects/:projectId/attachments`; Kho tài liệu trả `source: 'project' | 'task'` và lọc `?source=`; `?projectId=` gồm cả file dự án; xóa dự án dọn cả file dự án lẫn file task
- [x] Quyền file dự án: thành viên dự án xem/tải; leader của dự án và admin tải lên; người gửi, leader của dự án, admin xóa
- [x] Form Tạo/Sửa dự án và Tạo/Sửa công việc có `AttachmentPicker` (dưới Mô tả): kéo thả/chọn nhiều file, báo lỗi ngay (quá 20MB, file rỗng, file thực thi, quá 10 file, trùng file), danh sách file kèm nút bỏ chọn
- [x] Luồng tạo: gọi API tạo trước → lấy id → tải LẦN LƯỢT từng file (tiến trình từng file). File lỗi không làm mất dự án/công việc: form hiện đúng file nào lỗi + lý do, "Thử lại" chỉ gửi các file lỗi (không tạo trùng)
- [x] Trang chi tiết dự án có "File đính kèm của dự án" (xem trước, tải, xóa theo quyền); Kho tài liệu có bộ lọc Nguồn, file dự án gắn nhãn "Dự án" và bấm tên dự án để mở chi tiết
- [x] Seed: mỗi dự án có 2 PDF + 1 ảnh của dự án; test phân quyền file dự án

## Giai đoạn 10 — Một công việc giao cho nhiều người
- [x] Bảng nối `TaskAssignee` (khóa chính kép taskId+userId, `assignedAt`, CASCADE, index userId) thay cột `Task.assigneeId`
- [x] Migration `task_assignees` chuyển dữ liệu: tạo bảng → sao chép mỗi `assigneeId` cũ thành một dòng → đối chiếu số dòng → MỚI xóa khóa ngoại/index/cột cũ. Diễn tập trên MySQL thật với dữ liệu cũ: `npm run verify:assignee-migration` (DB tạm); có test kiểm tra thứ tự các bước
- [x] API nhận `assigneeIds: number[]` (thay `assigneeId`), chỉ chấp nhận thành viên đang hoạt động của dự án; sửa = thay toàn bộ danh sách, so sánh để biết ai được thêm/bớt (chỉ kiểm tra người MỚI thêm). Lọc `assigneeIds=1,2` cho danh sách và Kanban (bất kỳ người nào)
- [x] Cập nhật mọi nơi dùng assignee: phân quyền (một trong những người được giao đổi trạng thái/giờ làm, kéo thẻ, bình luận), thống kê trang thành viên và workload dashboard (task nhiều người tính cho từng người; `tasks/assignee-stats.ts`), "của tôi" ở dashboard, thông báo (người mới được báo "được giao"; bình luận/trạng thái/deadline/cron gửi cho tất cả), ActivityLog `assignee_changed` dạng `{added, removed}` (vẫn đọc được log cũ `{from, to}`), gỡ thành viên khỏi dự án chỉ gỡ người đó khỏi danh sách giao
- [x] Frontend: `AssigneePicker` (nhiều người, có tìm kiếm), `AssigneeStack` (chồng avatar, "+N"), `AssigneeFilter` (lọc nhiều người, URL `?assigneeIds=`), thêm/bớt trực tiếp ở chi tiết task
- [x] Seed: một số task giao 2–3 người; test phân quyền/thông báo/lịch sử/lọc, thống kê, scanner, gỡ thành viên

## Giai đoạn 11 — Kho tài liệu dạng thư mục (Dự án → Công việc → File)
- [x] Cấu trúc lưu file theo thư mục: `projects/{id}/{uuid}.ext` và `projects/{id}/tasks/{id}/{uuid}.ext` (`attachments/file-layout.ts`); `StorageService.deleteDirectory`; xóa task/dự án xóa cả thư mục (kể cả công việc con)
- [x] Script `npm run migrate:files` (`--dry-run`): chuyển file cũ `YYYY/MM/...` sang cấu trúc mới + cập nhật `Attachment.path`; chạy lại an toàn, phục hồi khi bị ngắt, không ghi đè, báo file mất, dọn thư mục cũ rỗng (có test với thư mục thật)
- [x] API `GET /files/projects`, `/files/projects/:id` (`includeEmpty`), `/files/projects/:id/files`, `/files/tasks/:id`, `/files/search?q=`: phân trang (20), tìm kiếm, sắp xếp, lọc quyền; số file/dung lượng/file mới nhất bằng truy vấn gộp GROUP BY
- [x] Frontend `/files`, `/files/projects/:id`, `/files/projects/:id/common`, `/files/tasks/:id`: breadcrumb, thư mục (biểu tượng khác cho "File chung"), lưới ⇄ danh sách ghi nhớ, phân trang, sắp xếp theo tên/cập nhật mới nhất, ô tìm toàn kho với đường dẫn bấm được, "Mở dự án"/"Mở công việc", "Tải lên file" (dùng lại `AttachmentPicker`), trạng thái rỗng
- [x] Sửa lỗi cũ: Kho tài liệu dạng phẳng và tìm kiếm bỏ sót file dự án khi xem bằng admin (`visibleWhere` trả `{}` cho admin)
- [x] Seed: 3 dự án, mỗi dự án có file chung và task có 2–5 file (một số task không có file); test phân quyền từng cấp, số đếm, script migrate

## Giai đoạn 12 — Nâng cấp Agile (Phân hệ 1–4 theo bản audit)
- [x] **Trạng thái tùy biến theo dự án** (`ProjectStatus`, nhóm todo/in_progress/done, 2 bộ công việc/Bug) + migration giữ dữ liệu + UI "Tùy chỉnh cột"
- [x] **Loại công việc** (Task/Story/Bug/Epic), Story Point, Bug (mức nghiêm trọng, môi trường) với vòng đời riêng — dùng chung bảng `Task`
- [x] **Hôm nay (My Work)** theo giờ Việt Nam
- [x] **Thông báo ngoài hệ thống**: email SMTP (bật theo người) + Slack webhook theo dự án
- [x] **Sprint, Backlog, Epic**, Burndown, Velocity, **work log** + chấm công
- [x] **Nhóm (Team)** là thực thể riêng, chuyên môn Dev/QA/Designer
- [x] **Nghỉ phép** + duyệt đơn + capacity thực tế của sprint
- [x] **Lịch tháng** + **Gantt** có phụ thuộc giữa công việc
- [x] **Phát hành**: phiên bản semver, release notes, phiên bản/môi trường cho Bug
- [x] **QA**: test case, đợt kiểm thử, Fail tự sinh Bug
- [x] **Tài liệu Wiki** Markdown (lịch sử, chống ghi đè, mẫu API spec)
- [x] **Tìm kiếm thông minh** xuyên dự án (không phân biệt dấu)
- [x] **Tự động hóa** (workflow rules) chống vòng lặp
- [x] **Cổng khách hàng** chỉ đọc
- [x] Seed mẫu cho toàn bộ tính năng mới (`prisma/seed-agile.ts`, in ra link cổng khách demo); 456 unit test backend

## Quyết định thiết kế
- Kho tài liệu dạng thư mục: danh sách phẳng cũ giữ ở `/documents` (nút "Xem tất cả file"). Cấp 1/2 sắp xếp và phân trang ở bộ nhớ sau khi đếm bằng GROUP BY (số dự án/task mỗi dự án nhỏ); cấp 3 và tìm kiếm phân trang ở DB. Số đếm của cấp 1 dùng SQL thô (`Attachment LEFT JOIN Task`) vì Prisma không groupBy qua quan hệ.
- Giao nhiều người: thành viên (không phải leader/admin) chỉ thêm/bớt được CHÍNH MÌNH trong danh sách của công việc con mình tạo (không động tới người khác). Người đã được giao nhưng sau đó rời dự án được giữ nguyên cho tới khi bị bớt; khi gỡ thành viên khỏi dự án họ bị gỡ khỏi mọi task của dự án đó. Thống kê tính trên bảng nối ở bộ nhớ (MySQL không groupBy qua quan hệ), đủ cho quy mô hiện tại; nếu task lên tới hàng trăm nghìn hãy chuyển sang truy vấn SQL thô.
- MySQL của dự án map ra cổng host **3307** vì máy đã có MySQL khác ở 3306.
- Hồ sơ cá nhân (`/profile`): chức danh, SĐT, email liên hệ, giới thiệu, link GitHub/LinkedIn/Facebook (kiểm tra tên miền ở backend). Ảnh đại diện lưu trong DB (bảng `UserAvatar`, MEDIUMBLOB) để không phụ thuộc ổ đĩa container; trình duyệt tự cắt vuông 256px trước khi gửi, backend nhận tối đa 1MB và kiểm tra JPEG/PNG/WebP bằng chữ ký file. `GET /users/:id/avatar` công khai (thẻ <img> không gửi được header Authorization).
- Ghim phiên bản major ổn định: NestJS 11, Prisma 6, TypeScript 5.9, ESLint 9, Vite 7, Tailwind 4, Jest 29.

## Vấn đề / ghi chú
- Task `position` là Int, đánh số lại theo từng cột (projectId + status) mỗi lần di chuyển.
- Người tạo dự án cũng được thêm vào `ProjectMember` để kiểm tra truy cập thống nhất.
- Người dùng bị vô hiệu hóa (`isActive=false`) thay vì xóa cứng, để giữ lịch sử task/bình luận.
- Refresh token lưu dạng hash SHA-256 trong bảng `RefreshToken` (rotate mỗi lần refresh, thu hồi khi logout).
- User MySQL `taskflow` được cấp quyền shadow DB (`docker/mysql-init`) để chạy `prisma migrate dev`.
- Subtask chỉ 1 cấp. Thống kê/dashboard/danh sách mặc định chỉ tính task cấp cao (subtask xem trong chi tiết task cha; danh sách có tùy chọn `includeSubtasks`).
- Admin tạo dự án thì không tự thành thành viên (quản lý bằng quyền hệ thống); leader tạo dự án thì tự là thành viên.
- Member xem được danh sách/thống kê của người cùng dự án; thống kê chỉ tính trong các dự án người xem được phép thấy.
- Sắp xếp `deadline` tăng dần luôn đẩy task không có deadline xuống cuối (MySQL mặc định xếp NULL lên đầu).
- Đăng nhập giới hạn 10 lần/phút/IP (Throttler); refresh token tái sử dụng sẽ thu hồi toàn bộ phiên của user.
- Kanban tải toàn bộ task cấp cao của dự án, lọc người/ưu tiên ở client để vị trí kéo thả luôn tính trên cột đầy đủ.
- Member chỉ kéo được thẻ giao cho mình (leader/admin của dự án kéo được tất cả); backend kiểm tra lại ở `PATCH /tasks/:id/move`.
- Bình luận: leader/admin của dự án bình luận mọi task; member chỉ trên task được giao cho mình; xóa: tác giả hoặc leader/admin của dự án.
- Thông báo phát sinh khi: được giao việc (chỉ người MỚI được thêm), đổi trạng thái (báo người tạo/leader/mọi người được giao, trừ người thao tác), bình luận, đổi deadline, thêm vào dự án, task sắp hạn (<=24h) và quá hạn (cron).
- Socket.IO: sự kiện `notification` (riêng từng user) và `task:changed` (thành viên dự án + admin) để Kanban/danh sách tự làm mới.
- Dashboard: member luôn xem số liệu "của tôi"; leader/admin chuyển được giữa "Cả nhóm" và "Của tôi". Biểu đồ workload và tiến độ dự án tính trên mọi dự án người xem được thấy.
- Màu biểu đồ theo trạng thái dùng bảng màu phân loại đã qua `validate_palette` (kèm legend, nhãn số, khe 2px, tooltip, bảng thay thế).
- Sau reverse proxy phải đặt `TRUST_PROXY=1`, nếu không mọi người dùng chia sẻ một giới hạn đăng nhập theo IP của proxy (đã bật sẵn trong docker-compose).
- Backend image giữ devDependencies để chạy `prisma migrate deploy` và `npm run seed` trong container (đổi lại: image lớn hơn).

## Vấn đề / ghi chú
- Chưa có: upload ảnh đại diện (chỉ nhận URL), quên mật khẩu qua email, E2E tự động trong repo (đã chạy E2E bằng Playwright nhưng script nằm ngoài repo).
- Token lưu `localStorage` (dễ bị XSS hơn cookie HttpOnly) — chấp nhận cho phạm vi hiện tại, xem README.
- Cron chỉ chạy khi tiến trình backend chạy; nếu chạy nhiều bản backend song song sẽ trùng lần quét (đã chống tạo thông báo trùng ở mức DB-check, chưa có khóa phân tán).
- Đăng ký công khai (`POST /auth/register`): luôn tạo `member`, DTO không có trường role (gửi `role` bị 400); tắt bằng `ALLOW_REGISTRATION=false`.
- Có 3 script dữ liệu: `seed:admin` (chỉ đảm bảo admin), `reset` (xóa hết, giữ admin), `seed` (xóa hết, nạp dữ liệu mẫu). `dev.sh` chỉ tạo admin khi DB trống.
- Member được thêm công việc con vào task lớn **được giao cho mình** (chỉ giao cho chính mình hoặc để trống), được sửa/xóa công việc con do chính mình tạo; tạo được task lớn nhưng luôn tự giao cho chính mình (để trống = tự giao, giao người khác bị 403); không thêm công việc con vào task của người khác. Leader dự án nhận thông báo `subtask_added`. Muốn mở rộng cho mọi thành viên dự án chỉ cần bỏ kiểm tra `parent.assigneeId` trong `TasksService.create`.
- Bình luận trên công việc con: ngoài leader/admin và những người được giao, người tạo việc con và những người được giao của task cha cũng bình luận được. Người tạo việc con (member) cũng đổi được trạng thái/giờ làm của việc con đó dù chưa được giao.

## Deploy (alpha.hopphu.vn)
- Server Ubuntu 24.04 (103.175.146.251) dùng chung với site khác (`beta.hopphu.vn`, các cổng 3100/4010/8080/27017 đã bị chiếm). TaskFlow chạy ở `/opt/taskflow-alpha` bằng `deploy/docker-compose.prod.yml` (project `taskflow-alpha`), frontend chỉ nghe `127.0.0.1:18080`, MySQL/backend không mở cổng ngoài.
- nginx của server: chỉ thêm `/etc/nginx/conf.d/alpha.hopphu.vn.conf`; HTTPS Let's Encrypt tự gia hạn (certbot). `TRUST_PROXY=2` (nginx server → nginx container).
- Deploy không dùng GitHub: `deploy/deploy.sh` gửi `git archive HEAD` qua SSH; `.env` trên server (secret ngẫu nhiên) được giữ nguyên khi deploy lại.
- Cập nhật phiên bản: commit rồi `LE_EMAIL=... ./deploy/deploy.sh root@103.175.146.251`.
