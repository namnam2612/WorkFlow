import { PrismaClient, Priority, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createDefaultStatuses, DEFAULT_TASK_STATUSES } from '../src/statuses/default-statuses';
import { seedAgile, type SeededProject } from './seed-agile';
import { clearAttachments, makeDocx, makePdf, makePng, makePptx, makeXlsx, writeSample } from './seed-files';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number): Date => new Date(Date.now() + days * DAY);

/** Khóa trạng thái mặc định của bộ công việc (xem DEFAULT_TASK_STATUSES) */
type StatusKey = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';

type TaskSeed = {
  title: string;
  status: StatusKey;
  priority: Priority;
  /** Số ngày so với hiện tại (âm = đã qua), null = không có deadline */
  deadline: number | null;
  /** Chỉ số trong danh sách thành viên của dự án (mảng = giao cho nhiều người), null = chưa giao */
  assignee: number | number[] | null;
  estimated?: number;
  actual?: number;
  subtasks?: string[];
};

type ProjectSeed = {
  name: string;
  description: string;
  leader: 'leader1' | 'leader2';
  memberKeys: string[];
  startOffset: number;
  endOffset: number;
  tasks: TaskSeed[];
};

const PROJECTS: ProjectSeed[] = [
  {
    name: 'Website thương mại điện tử',
    description: 'Xây dựng website bán hàng trực tuyến: catalog, giỏ hàng, thanh toán và trang quản trị.',
    leader: 'leader1',
    memberKeys: ['member1', 'member2', 'member3', 'member4'],
    startOffset: -45,
    endOffset: 40,
    tasks: [
      { title: 'Thiết kế wireframe trang chủ', status: 'done', priority: 'high', deadline: -30, assignee: 0, estimated: 12, actual: 14 },
      { title: 'Thiết kế cơ sở dữ liệu sản phẩm', status: 'done', priority: 'high', deadline: -25, assignee: 1, estimated: 8, actual: 7 },
      { title: 'API danh mục và sản phẩm', status: 'done', priority: 'medium', deadline: -15, assignee: 1, estimated: 20, actual: 22 },
      { title: 'Giao diện danh sách sản phẩm', status: 'review', priority: 'medium', deadline: 2, assignee: [0, 1], estimated: 16, actual: 15, subtasks: ['Bộ lọc theo giá', 'Phân trang và sắp xếp'] },
      { title: 'Chức năng giỏ hàng', status: 'in_progress', priority: 'high', deadline: 4, assignee: [2, 3], estimated: 24, actual: 10, subtasks: ['Thêm/xóa sản phẩm', 'Tính tổng tiền và khuyến mãi'] },
      { title: 'Tích hợp cổng thanh toán VNPay', status: 'in_progress', priority: 'urgent', deadline: -2, assignee: [3, 0, 1], estimated: 30, actual: 18 },
      { title: 'Trang chi tiết sản phẩm', status: 'in_progress', priority: 'medium', deadline: 6, assignee: 0, estimated: 14, actual: 5 },
      { title: 'Gửi email xác nhận đơn hàng', status: 'todo', priority: 'medium', deadline: 9, assignee: 2, estimated: 8 },
      { title: 'Trang quản trị đơn hàng', status: 'todo', priority: 'high', deadline: 14, assignee: 1, estimated: 28 },
      { title: 'Tối ưu SEO cho trang sản phẩm', status: 'todo', priority: 'low', deadline: 25, assignee: null, estimated: 10 },
      { title: 'Sửa lỗi hiển thị trên Safari', status: 'blocked', priority: 'high', deadline: -4, assignee: 0, estimated: 4, actual: 2 },
      { title: 'Viết tài liệu API', status: 'todo', priority: 'low', deadline: 30, assignee: 3, estimated: 12 },
      { title: 'Kiểm thử luồng đặt hàng', status: 'todo', priority: 'urgent', deadline: 1, assignee: 2, estimated: 16 },
      { title: 'Cấu hình CI/CD', status: 'done', priority: 'medium', deadline: -20, assignee: 3, estimated: 6, actual: 8 },
    ],
  },
  {
    name: 'Ứng dụng di động Giao hàng',
    description: 'Ứng dụng cho shipper nhận đơn, theo dõi lộ trình và xác nhận giao hàng.',
    leader: 'leader2',
    memberKeys: ['member3', 'member4', 'member5'],
    startOffset: -30,
    endOffset: 60,
    tasks: [
      { title: 'Khảo sát yêu cầu nghiệp vụ giao hàng', status: 'done', priority: 'high', deadline: -22, assignee: 0, estimated: 10, actual: 12 },
      { title: 'Thiết kế UI/UX màn hình nhận đơn', status: 'done', priority: 'medium', deadline: -12, assignee: 1, estimated: 18, actual: 20 },
      { title: 'Đăng nhập và xác thực shipper', status: 'done', priority: 'high', deadline: -8, assignee: 2, estimated: 12, actual: 10 },
      { title: 'Màn hình danh sách đơn hàng', status: 'review', priority: 'high', deadline: 1, assignee: [1, 2], estimated: 16, actual: 17 },
      { title: 'Tích hợp bản đồ và chỉ đường', status: 'in_progress', priority: 'urgent', deadline: 3, assignee: [0, 1, 2], estimated: 32, actual: 14, subtasks: ['Hiển thị vị trí shipper', 'Tính quãng đường tối ưu'] },
      { title: 'Chụp ảnh xác nhận giao hàng', status: 'in_progress', priority: 'medium', deadline: -1, assignee: 2, estimated: 14, actual: 9 },
      { title: 'Thông báo đẩy khi có đơn mới', status: 'todo', priority: 'high', deadline: 8, assignee: 2, estimated: 20 },
      { title: 'Chế độ offline và đồng bộ', status: 'todo', priority: 'medium', deadline: 20, assignee: null, estimated: 36 },
      { title: 'Lỗi crash khi mất kết nối GPS', status: 'blocked', priority: 'urgent', deadline: -6, assignee: 0, estimated: 6, actual: 3 },
      { title: 'Báo cáo thu nhập theo ngày', status: 'todo', priority: 'low', deadline: 28, assignee: 1, estimated: 12 },
      { title: 'Kiểm thử trên thiết bị Android', status: 'todo', priority: 'medium', deadline: 35, assignee: 2, estimated: 16 },
      { title: 'Đóng gói và phát hành bản beta', status: 'todo', priority: 'high', deadline: 45, assignee: 0, estimated: 10 },
      { title: 'Tối ưu thời gian khởi động ứng dụng', status: 'todo', priority: 'low', deadline: null, assignee: null, estimated: 8 },
    ],
  },
  {
    name: 'Hệ thống báo cáo nội bộ',
    description: 'Dashboard báo cáo doanh thu, nhân sự và tiến độ dự án cho ban giám đốc.',
    leader: 'leader1',
    memberKeys: ['member1', 'member2', 'member5'],
    startOffset: -20,
    endOffset: 35,
    tasks: [
      { title: 'Thu thập yêu cầu báo cáo từ các phòng ban', status: 'done', priority: 'high', deadline: -14, assignee: 0, estimated: 8, actual: 9 },
      { title: 'Thiết kế mô hình dữ liệu kho báo cáo', status: 'done', priority: 'high', deadline: -9, assignee: 1, estimated: 14, actual: 16 },
      { title: 'ETL dữ liệu doanh thu hằng ngày', status: 'in_progress', priority: 'urgent', deadline: 2, assignee: [1, 0], estimated: 26, actual: 15, subtasks: ['Đọc dữ liệu từ hệ thống bán hàng', 'Chuẩn hóa và nạp vào kho'] },
      { title: 'Biểu đồ doanh thu theo tháng', status: 'in_progress', priority: 'medium', deadline: 5, assignee: 0, estimated: 12, actual: 6 },
      { title: 'Báo cáo nhân sự và chấm công', status: 'review', priority: 'medium', deadline: 0, assignee: [2, 0, 1], estimated: 18, actual: 18 },
      { title: 'Xuất báo cáo ra PDF và Excel', status: 'todo', priority: 'medium', deadline: 12, assignee: 2, estimated: 14 },
      { title: 'Phân quyền xem báo cáo theo phòng ban', status: 'todo', priority: 'high', deadline: 10, assignee: 0, estimated: 16 },
      { title: 'Gửi báo cáo tuần qua email tự động', status: 'todo', priority: 'low', deadline: 22, assignee: null, estimated: 10 },
      { title: 'Sửa lỗi sai lệch số liệu cuối tháng', status: 'in_progress', priority: 'urgent', deadline: -3, assignee: 1, estimated: 8, actual: 5 },
      { title: 'Tối ưu truy vấn báo cáo chậm', status: 'blocked', priority: 'high', deadline: 7, assignee: 1, estimated: 12, actual: 4 },
      { title: 'Đào tạo người dùng sử dụng hệ thống', status: 'todo', priority: 'low', deadline: 30, assignee: 2, estimated: 6 },
      { title: 'Họp nghiệm thu với ban giám đốc', status: 'todo', priority: 'medium', deadline: 33, assignee: 0, estimated: 4 },
      { title: 'Cập nhật tài liệu hướng dẫn sử dụng', status: 'todo', priority: 'low', deadline: null, assignee: 2, estimated: 6 },
    ],
  },
];

const SAMPLE_COMMENTS = [
  'Mình đã bắt đầu làm phần này, dự kiến xong đúng hạn.',
  'Cần thêm thông tin về yêu cầu, anh/chị xem giúp nhé.',
  'Đã hoàn thành bản đầu, nhờ review giúp mình.',
  'Đang bị chặn bởi phần phụ thuộc bên ngoài, mình sẽ cập nhật sau.',
  'OK, đã xem. Chỉnh lại một chút rồi merge nhé.',
];

/** Màu ảnh minh họa khác nhau theo dự án */
const projectIndexHue = (name: string): number => [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 360;

async function main(): Promise<void> {
  const password = process.env.SEED_DEFAULT_PASSWORD ?? 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);

  console.log('Xóa dữ liệu cũ...');
  await clearAttachments(prisma); // xóa cả file trên ổ đĩa
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.taskAssignee.deleteMany();
  await prisma.task.deleteMany({ where: { parentId: { not: null } } });
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.team.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const userDefs: { key: string; name: string; email: string; role: Role }[] = [
    { key: 'admin', name: 'Quản trị viên', email: 'admin@taskflow.vn', role: 'admin' },
    { key: 'leader1', name: 'Nguyễn Văn An', email: 'leader1@taskflow.vn', role: 'leader' },
    { key: 'leader2', name: 'Trần Thị Bình', email: 'leader2@taskflow.vn', role: 'leader' },
    { key: 'member1', name: 'Lê Hoàng Cường', email: 'member1@taskflow.vn', role: 'member' },
    { key: 'member2', name: 'Phạm Thu Dung', email: 'member2@taskflow.vn', role: 'member' },
    { key: 'member3', name: 'Võ Minh Em', email: 'member3@taskflow.vn', role: 'member' },
    { key: 'member4', name: 'Đặng Quốc Phong', email: 'member4@taskflow.vn', role: 'member' },
    { key: 'member5', name: 'Bùi Ngọc Giang', email: 'member5@taskflow.vn', role: 'member' },
  ];

  const users = new Map<string, { id: number; name: string }>();
  for (const def of userDefs) {
    const user = await prisma.user.create({
      data: { name: def.name, email: def.email, role: def.role, passwordHash },
    });
    users.set(def.key, { id: user.id, name: user.name });
  }
  const getUser = (key: string): { id: number; name: string } => {
    const user = users.get(key);
    if (!user) throw new Error(`Thiếu user seed: ${key}`);
    return user;
  };

  let taskCount = 0;
  let fileCount = 0;
  const seeded: SeededProject[] = [];
  for (const def of PROJECTS) {
    const leader = getUser(def.leader);
    const project = await prisma.project.create({
      data: {
        name: def.name,
        description: def.description,
        startDate: daysFromNow(def.startOffset),
        endDate: daysFromNow(def.endOffset),
        createdById: leader.id,
      },
    });

    const memberIds = def.memberKeys.map((key) => getUser(key).id);
    seeded.push({ id: project.id, name: def.name, leaderId: leader.id, memberIds });
    await prisma.projectMember.createMany({
      data: [leader.id, ...memberIds].map((userId) => ({ projectId: project.id, userId })),
    });

    // File đính kèm của DỰ ÁN (do leader gửi): PDF hợp đồng / kế hoạch + một ảnh sơ đồ
    const projectSamples = [
      { name: `Hợp đồng - ${def.name}.pdf`, mime: 'application/pdf', data: makePdf(`Hop dong: ${def.name}`), ago: 12 },
      { name: `Kế hoạch tổng thể.pdf`, mime: 'application/pdf', data: makePdf(`Ke hoach tong the: ${def.name}`), ago: 9 },
      { name: `Sơ đồ tổ chức.png`, mime: 'image/png', data: makePng(360, 240, projectIndexHue(def.name)), ago: 8 },
    ];
    for (const sample of projectSamples) {
      const stored = await writeSample(sample, { projectId: project.id, taskId: null });
      await prisma.attachment.create({
        data: {
          projectId: project.id,
          uploaderId: leader.id,
          originalName: sample.name,
          storedName: stored.storedName,
          mimeType: sample.mime,
          size: stored.size,
          path: stored.path,
          createdAt: daysFromNow(-sample.ago),
        },
      });
      fileCount++;
    }

    // Bộ trạng thái mặc định của dự án (tạo giống lúc tạo dự án qua API)
    await createDefaultStatuses(prisma, project.id);
    const statusRows = await prisma.projectStatus.findMany({ where: { projectId: project.id, scope: 'task' } });
    const statusIdOf = (key: StatusKey): number => {
      const name = DEFAULT_TASK_STATUSES.find((d) => d.key === key)?.name;
      const row = statusRows.find((r) => r.name === name);
      if (!row) throw new Error(`Thiếu trạng thái seed: ${key}`);
      return row.id;
    };
    const positionByStatus = new Map<number, number>();
    const nextPosition = (statusId: number): number => {
      const position = positionByStatus.get(statusId) ?? 0;
      positionByStatus.set(statusId, position + 1);
      return position;
    };

    for (const [index, t] of def.tasks.entries()) {
      // Một task có thể giao cho nhiều người; `assigneeId` (người đầu tiên) chỉ dùng để chọn người gửi file / bình luận mẫu
      const assigneeIds = (t.assignee === null ? [] : Array.isArray(t.assignee) ? t.assignee : [t.assignee]).map((i) => memberIds[i]);
      const assigneeId = assigneeIds[0] ?? null;
      const deadline = t.deadline === null ? null : daysFromNow(t.deadline);
      const completedAt =
        t.status === 'done' ? daysFromNow(t.deadline === null ? -1 : Math.min(t.deadline, -1) + 0.5) : null;

      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          title: t.title,
          description: `Mô tả chi tiết cho công việc "${t.title}".`,
          assignees: { create: assigneeIds.map((userId) => ({ userId, assignedAt: daysFromNow(def.startOffset + index) })) },
          creatorId: leader.id,
          statusId: statusIdOf(t.status),
          priority: t.priority,
          deadline,
          estimatedHours: t.estimated ?? null,
          actualHours: t.actual ?? null,
          position: nextPosition(statusIdOf(t.status)),
          completedAt,
          createdAt: daysFromNow(def.startOffset + index),
        },
      });
      taskCount++;

      await prisma.activityLog.create({
        data: { taskId: task.id, userId: leader.id, action: 'task_created', detail: { title: t.title } },
      });
      if (assigneeIds.length > 0) {
        await prisma.activityLog.create({
          data: {
            taskId: task.id,
            userId: leader.id,
            action: 'assignee_changed',
            detail: { added: assigneeIds.map((id) => ({ id, name: [...users.values()].find((u) => u.id === id)?.name ?? '' })), removed: [] },
          },
        });
      }

      // File đính kèm mẫu: vài task trong mỗi dự án, do nhiều người gửi khác nhau (người được giao, leader, đồng đội)
      if (index % 3 === 0) {
        const uploaders = [assigneeId ?? leader.id, leader.id, memberIds[(index + 1) % memberIds.length]];
        const samples: { name: string; mime: string; data: Buffer; by: number; ago: number }[] = [
          { name: `Yêu cầu - ${t.title}.pdf`, mime: 'application/pdf', data: makePdf(`Yeu cau: ${t.title}`), by: uploaders[1], ago: 6 },
          { name: `Ảnh minh họa ${index + 1}.png`, mime: 'image/png', data: makePng(320, 220, index * 40), by: uploaders[0], ago: 3 },
          { name: `Ghi chú họp ${index + 1}.txt`, mime: 'text/plain', data: Buffer.from(`Ghi chú họp cho "${t.title}"\n- Thống nhất phạm vi\n- Phân công người thực hiện\n`, 'utf8'), by: uploaders[2], ago: 1 },
          {
            name: `Báo cáo tiến độ ${index + 1}.docx`,
            mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            data: makeDocx(`Báo cáo tiến độ: ${t.title}`, ['Tình hình: đang triển khai đúng kế hoạch.', 'Rủi ro: phụ thuộc vào đối tác bên ngoài.', 'Đề xuất: họp nhanh vào đầu tuần sau.']),
            by: uploaders[1],
            ago: 5,
          },
          {
            name: `Bảng kế hoạch ${index + 1}.xlsx`,
            mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            data: makeXlsx('Kế hoạch', [['Hạng mục', 'Người phụ trách', 'Số giờ'], ['Thiết kế', 'Cường', 8], ['Lập trình', 'Dung', 16], ['Kiểm thử', 'Em', 6]]),
            by: uploaders[2],
            ago: 4,
          },
          {
            name: `Thuyết trình ${index + 1}.pptx`,
            mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            data: makePptx([
              { title: t.title, lines: ['Mục tiêu và phạm vi', 'Người phụ trách và mốc thời gian'] },
              { title: 'Tiến độ và rủi ro', lines: ['Đã hoàn thành phần thiết kế', 'Đang chờ phản hồi từ đối tác'] },
            ]),
            by: uploaders[1],
            ago: 5,
          },
          {
            name: `Báo giá ${index + 1}.html`,
            mime: 'text/html',
            data: Buffer.from(`<!doctype html><meta charset="utf-8"><h1>Báo giá ${index + 1}</h1><table border="1"><tr><th>Hạng mục</th><th>Đơn giá</th></tr><tr><td>Thiết kế</td><td>8.000.000đ</td></tr></table><script>document.title='x'</script>`, 'utf8'),
            by: uploaders[0],
            ago: 4,
          },
          { name: `Số liệu ${index + 1}.csv`, mime: 'text/csv', data: Buffer.from('Hạng mục,Số giờ\nThiết kế,8\nLập trình,16\nKiểm thử,6\n', 'utf8'), by: uploaders[0], ago: 2 },
        ];
        // Mỗi task có file được 2–5 file, xoay vòng loại file để có đủ mẫu (pdf, ảnh, txt, docx, xlsx, pptx, html, csv)
        const count = 2 + (index % 4);
        const start = index % samples.length;
        const take = [...samples, ...samples].slice(start, start + count);
        for (const sample of take) {
          const stored = await writeSample(sample, { projectId: project.id, taskId: task.id });
          const attachment = await prisma.attachment.create({
            data: {
              taskId: task.id,
              uploaderId: sample.by,
              originalName: sample.name,
              storedName: stored.storedName,
              mimeType: sample.mime,
              size: stored.size,
              path: stored.path,
              createdAt: daysFromNow(-sample.ago),
            },
          });
          await prisma.activityLog.create({
            data: { taskId: task.id, userId: sample.by, action: 'attachment_added', detail: { attachmentId: attachment.id, name: sample.name, size: stored.size } },
          });
          fileCount++;
        }
      }

      for (const subtaskTitle of t.subtasks ?? []) {
        const subDone = t.status === 'review' || t.status === 'done';
        await prisma.task.create({
          data: {
            projectId: project.id,
            parentId: task.id,
            title: subtaskTitle,
            assignees: { create: assigneeIds.map((userId) => ({ userId })) },
            creatorId: leader.id,
            statusId: statusIdOf(subDone ? 'done' : 'todo'),
            priority: t.priority,
            deadline,
            completedAt: subDone ? daysFromNow(-1) : null,
            position: 0,
          },
        });
        taskCount++;
      }

      if (assigneeId !== null && t.status !== 'todo') {
        const commentText = SAMPLE_COMMENTS[index % SAMPLE_COMMENTS.length];
        await prisma.comment.create({ data: { taskId: task.id, userId: assigneeId, content: commentText } });
        await prisma.activityLog.create({
          data: {
            taskId: task.id,
            userId: assigneeId,
            action: 'status_changed',
            detail: {
              from: { id: statusIdOf('todo'), name: DEFAULT_TASK_STATUSES[0]?.name },
              to: { id: statusIdOf(t.status), name: DEFAULT_TASK_STATUSES.find((d) => d.key === t.status)?.name },
            },
          },
        });
      }

      if (assigneeId !== null) {
        await prisma.notification.create({
          data: {
            userId: assigneeId,
            type: 'task_assigned',
            message: `Bạn được giao công việc "${t.title}"`,
            link: `/tasks/${task.id}`,
            isRead: t.status !== 'todo',
          },
        });
      }
    }
  }

  const agileLines = await seedAgile(prisma, seeded);
  console.log(`Seed xong: ${users.size} người dùng, ${PROJECTS.length} dự án, ${taskCount} task (gồm subtask), ${fileCount} file đính kèm.`);
  console.log(`Mật khẩu mặc định cho mọi tài khoản mẫu: ${password}`);
  for (const line of agileLines) console.log(line);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
