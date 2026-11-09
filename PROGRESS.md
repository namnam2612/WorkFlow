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
- [ ] Rà soát phân quyền, lỗi thống nhất, loading/empty state
- [x] Dockerfile backend + frontend (nginx proxy /api + /socket.io), compose chạy full stack — đã kiểm thử từ DB trống
- [ ] Kiểm tra cuối, README

## Quyết định thiết kế
- MySQL của dự án map ra cổng host **3307** vì máy đã có MySQL khác ở 3306.
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
- Thông báo phát sinh khi: được giao việc, đổi trạng thái (báo người tạo/leader/assignee, trừ người thao tác), bình luận, đổi deadline, thêm vào dự án, task sắp hạn (<=24h) và quá hạn (cron).
- Socket.IO: sự kiện `notification` (riêng từng user) và `task:changed` (thành viên dự án + admin) để Kanban/danh sách tự làm mới.
- Dashboard: member luôn xem số liệu "của tôi"; leader/admin chuyển được giữa "Cả nhóm" và "Của tôi". Biểu đồ workload và tiến độ dự án tính trên mọi dự án người xem được thấy.
- Màu biểu đồ theo trạng thái dùng bảng màu phân loại đã qua `validate_palette` (kèm legend, nhãn số, khe 2px, tooltip, bảng thay thế).
