# Tiến độ

## Giai đoạn 1 — Nền tảng
- [ ] Monorepo, docker-compose MySQL
- [ ] Prisma schema + migration
- [ ] Seed (1 admin, 2 leader, 5 member, 3 dự án, ~40 task, có quá hạn)
- [ ] `.env.example`

## Giai đoạn 2 — Auth
- [ ] Backend: login / refresh / logout, Guard theo role
- [ ] Frontend: đăng nhập, tự refresh token, layout chung, route bảo vệ

## Giai đoạn 3 — CRUD
- [ ] User, Project, ProjectMember
- [ ] Task + subtask, danh sách có lọc/phân trang
- [ ] Frontend: Dự án, Danh sách task, Thành viên

## Giai đoạn 4 — Kanban
- [ ] API status + position
- [ ] Frontend dnd-kit, optimistic update, lọc người/ưu tiên

## Giai đoạn 5 — Tương tác
- [ ] Bình luận, activity log tự ghi
- [ ] Thông báo realtime Socket.IO + chuông
- [ ] Cron mỗi giờ quét sắp hạn/quá hạn

## Giai đoạn 6 — Dashboard & Thành viên
- [ ] API thống kê
- [ ] Dashboard (Recharts), trang thành viên

## Giai đoạn 7 — Hoàn thiện
- [ ] Unit test auth + tasks
- [ ] Rà soát phân quyền, lỗi thống nhất, loading/empty state
- [ ] Dockerfile backend + frontend
- [ ] Kiểm tra cuối, README

## Quyết định thiết kế
- MySQL của dự án map ra cổng host **3307** vì máy đã có MySQL khác ở 3306.
- Ghim phiên bản major ổn định: NestJS 11, Prisma 6, TypeScript 5.9, ESLint 9, Vite 7, Tailwind 4, Jest 29.

## Vấn đề / ghi chú
