import { PrismaClient, Specialty } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

/**
 * Dữ liệu mẫu cho các tính năng Agile: nhóm, sprint, epic/story/bug, phụ thuộc, phát hành, QA, wiki, log work,
 * nghỉ phép, tự động hóa và liên kết cổng khách hàng. Chạy sau khi đã tạo người dùng, dự án và công việc cơ bản.
 */
export interface SeededProject {
  id: number;
  name: string;
  leaderId: number;
  /** Id thành viên dự án (không gồm leader) */
  memberIds: number[];
}

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (d: number): Date => new Date(Date.now() + d * DAY);
const POINTS = [1, 2, 3, 5, 8, 3, 2, 5];
const SPECIALTIES: Specialty[] = ['dev', 'dev', 'qa', 'designer', 'dev', 'qa'];

export async function seedAgile(prisma: PrismaClient, projects: SeededProject[]): Promise<string[]> {
  const lines: string[] = [];

  // ---------------------------------------------------------------- nhóm
  const byLeader = new Map<number, SeededProject[]>();
  for (const p of projects) byLeader.set(p.leaderId, [...(byLeader.get(p.leaderId) ?? []), p]);
  let teamNo = 0;
  for (const [leaderId, ps] of byLeader) {
    teamNo++;
    const memberIds = [...new Set(ps.flatMap((p) => p.memberIds))];
    const team = await prisma.team.create({
      data: {
        name: teamNo === 1 ? 'Nhóm Phát triển Web' : `Nhóm Sản phẩm ${teamNo}`,
        description: `Phụ trách: ${ps.map((p) => p.name).join(', ')}`,
        leaderId,
        members: { create: [{ userId: leaderId, specialty: 'other' }, ...memberIds.map((userId, i) => ({ userId, specialty: SPECIALTIES[i % SPECIALTIES.length] as Specialty }))] },
      },
    });
    await prisma.project.updateMany({ where: { id: { in: ps.map((p) => p.id) } }, data: { teamId: team.id } });
  }

  const pick = async (projectId: number, scope: 'task' | 'bug', category?: 'todo' | 'in_progress' | 'done') => {
    const rows = await prisma.projectStatus.findMany({ where: { projectId, scope, ...(category ? { category } : {}) }, orderBy: { position: 'asc' } });
    const row = rows[0];
    if (!row) throw new Error(`Thiếu trạng thái ${scope}/${category ?? '*'} của dự án ${projectId}`);
    return row;
  };

  for (const [pIndex, project] of projects.entries()) {
    const pid = project.id;
    const people = [project.leaderId, ...project.memberIds];
    const tasks = await prisma.task.findMany({ where: { projectId: pid, parentId: null }, include: { status: true, assignees: true }, orderBy: { id: 'asc' } });

    // ------------------------------------------------- loại việc, điểm, ngày bắt đầu
    for (const [i, t] of tasks.entries()) {
      await prisma.task.update({
        where: { id: t.id },
        data: {
          type: i % 3 === 0 ? 'story' : 'task',
          storyPoints: POINTS[i % POINTS.length],
          startDate: t.deadline ? new Date(t.deadline.getTime() - (2 + (i % 6)) * DAY) : null,
        },
      });
    }

    // ------------------------------------------------------------- phát hành
    const v1 = await prisma.release.create({ data: { projectId: pid, version: 'v1.0.0', name: 'Bản ra mắt', description: 'Phiên bản đầu tiên cho khách hàng.', status: 'released', releasedAt: daysFromNow(-14), createdById: project.leaderId } });
    const v11 = await prisma.release.create({ data: { projectId: pid, version: 'v1.1.0', name: 'Cải tiến trải nghiệm', createdById: project.leaderId } });

    // ------------------------------------------------------------ sprint
    const s1 = await prisma.sprint.create({ data: { projectId: pid, name: 'Sprint 1', goal: 'Hoàn thiện nền tảng và luồng chính', startDate: daysFromNow(-28), endDate: daysFromNow(-15), status: 'completed', startedAt: daysFromNow(-28), completedAt: daysFromNow(-15) } });
    const s2 = await prisma.sprint.create({ data: { projectId: pid, name: 'Sprint 2', goal: 'Cải thiện trải nghiệm và sửa lỗi', startDate: daysFromNow(-4), endDate: daysFromNow(9), status: 'active', startedAt: daysFromNow(-4) } });
    const s3 = await prisma.sprint.create({ data: { projectId: pid, name: 'Sprint 3', goal: 'Mở rộng tính năng', startDate: daysFromNow(10), endDate: daysFromNow(24), status: 'planned' } });

    let n2 = 0;
    for (const [i, t] of tasks.entries()) {
      const cat = t.status.category;
      const sprintId = cat === 'done' ? s1.id : cat === 'in_progress' ? s2.id : i % 3 === 0 ? s2.id : i % 3 === 1 ? s3.id : null;
      if (sprintId === s2.id) n2++;
      await prisma.task.update({ where: { id: t.id }, data: { sprintId, fixReleaseId: cat === 'done' ? v1.id : sprintId === s2.id ? v11.id : null } });
    }
    const sums = async (sprintId: number, onlyDone: boolean) =>
      (await prisma.task.aggregate({ where: { sprintId, parentId: null, ...(onlyDone ? { status: { category: 'done' } } : {}) }, _sum: { storyPoints: true } }))._sum.storyPoints ?? 0;
    await prisma.sprint.update({ where: { id: s1.id }, data: { committedPoints: await sums(s1.id, false), completedPoints: await sums(s1.id, true) } });
    await prisma.sprint.update({ where: { id: s2.id }, data: { committedPoints: await sums(s2.id, false) } });

    // --------------------------------------------------------------- epic
    const epics = [];
    for (const title of [`Epic: Trải nghiệm người dùng (${project.name})`, `Epic: Hiệu năng và độ ổn định (${project.name})`]) {
      const status = await pick(pid, 'task', 'in_progress');
      epics.push(await prisma.task.create({ data: { projectId: pid, title, type: 'epic', statusId: status.id, creatorId: project.leaderId, description: 'Nhóm các story liên quan thành một mục tiêu lớn.' } }));
    }
    const stories = await prisma.task.findMany({ where: { projectId: pid, type: 'story', parentId: null }, orderBy: { id: 'asc' } });
    for (const [i, s] of stories.entries()) await prisma.task.update({ where: { id: s.id }, data: { epicId: epics[i % 2]?.id } });

    // ------------------------------------------------------------ bug
    const bugNew = await pick(pid, 'bug', 'todo');
    const bugFixing = (await prisma.projectStatus.findFirst({ where: { projectId: pid, scope: 'bug', name: 'Đang sửa' } })) ?? bugNew;
    const bugClosed = await pick(pid, 'bug', 'done');
    const bugs = [
      { title: 'Lỗi hiển thị sai múi giờ ở báo cáo', status: bugFixing, severity: 'major' as const, env: 'prod' as const, sprintId: s2.id, found: v1.id, fix: v11.id },
      { title: 'Crash khi tải file lớn hơn 20MB', status: bugNew, severity: 'critical' as const, env: 'staging' as const, sprintId: s2.id, found: v1.id, fix: v11.id },
      { title: 'Nút "Lưu" không phản hồi trên Safari', status: bugClosed, severity: 'minor' as const, env: 'dev' as const, sprintId: s1.id, found: null, fix: v1.id },
    ];
    const bugRows = [];
    for (const [i, b] of bugs.entries()) {
      bugRows.push(
        await prisma.task.create({
          data: {
            projectId: pid,
            title: b.title,
            type: 'bug',
            statusId: b.status.id,
            severity: b.severity,
            environment: b.env,
            priority: b.severity === 'critical' ? 'urgent' : 'medium',
            storyPoints: 2,
            sprintId: b.sprintId,
            foundReleaseId: b.found,
            fixReleaseId: b.fix,
            creatorId: project.leaderId,
            completedAt: b.status.category === 'done' ? daysFromNow(-16) : null,
            deadline: daysFromNow(2 + i),
            startDate: daysFromNow(-2),
            assignees: { create: [{ userId: people[(1 + i) % people.length] as number }] },
          },
        }),
      );
    }

    // ---------------------------------------------------- phụ thuộc giữa việc
    const chain = tasks.filter((t) => t.deadline !== null).slice(0, 4);
    for (let i = 1; i < chain.length; i++) {
      await prisma.taskDependency.create({ data: { taskId: (chain[i] as { id: number }).id, dependsOnId: (chain[i - 1] as { id: number }).id } });
    }

    // ------------------------------------------------------------ log work
    const working = tasks.filter((t) => t.assignees.length > 0 && t.status.category !== 'todo').slice(0, 6);
    for (const [i, t] of working.entries()) {
      const userId = (t.assignees[0] as { userId: number }).userId;
      let total = 0;
      for (let d = 0; d < 3; d++) {
        const minutes = 60 + ((i + d) % 4) * 45;
        total += minutes;
        const day = new Date(daysFromNow(-(d + 1) - i).getTime());
        const workedOn = new Date(Math.floor((day.getTime() + 7 * 3600e3) / DAY) * DAY - 7 * 3600e3);
        await prisma.workLog.create({ data: { taskId: t.id, userId, minutes, workedOn, note: d === 0 ? 'Làm theo yêu cầu đã thống nhất' : null } });
      }
      await prisma.task.update({ where: { id: t.id }, data: { actualHours: Math.round((total / 60) * 100) / 100 } });
    }

    // ---------------------------------------------------------------- QA
    const cases = await Promise.all(
      [
        ['Đăng nhập thành công', 'Có tài khoản hợp lệ', '1. Mở trang đăng nhập\n2. Nhập email và mật khẩu đúng\n3. Bấm Đăng nhập', 'Vào được trang Tổng quan', 'high'],
        ['Đăng nhập sai mật khẩu', 'Có tài khoản hợp lệ', '1. Mở trang đăng nhập\n2. Nhập mật khẩu sai\n3. Bấm Đăng nhập', 'Hiện thông báo lỗi, không vào được hệ thống', 'urgent'],
        ['Tải file đính kèm', 'Đã đăng nhập, có công việc', '1. Mở công việc\n2. Chọn file 5MB\n3. Bấm tải lên', 'File xuất hiện trong danh sách đính kèm', 'medium'],
        ['Xuất báo cáo PDF', 'Có dữ liệu báo cáo', '1. Mở báo cáo\n2. Bấm Xuất PDF', 'Tải về file PDF đúng nội dung', 'low'],
      ].map(([title, pre, steps, expected, priority]) =>
        prisma.testCase.create({ data: { projectId: pid, title: title as string, preconditions: pre as string, steps: steps as string, expected: expected as string, priority: priority as 'low' | 'medium' | 'high' | 'urgent', createdById: project.memberIds[0] ?? project.leaderId } }),
      ),
    );
    const run = await prisma.testRun.create({ data: { projectId: pid, name: 'Regression v1.1.0 (staging)', environment: 'staging', releaseId: v11.id, createdById: project.memberIds[0] ?? project.leaderId } });
    const results: ('passed' | 'failed' | 'blocked' | 'untested')[] = ['passed', 'failed', 'passed', 'untested'];
    for (const [i, c] of cases.entries()) {
      await prisma.testResult.create({
        data: {
          runId: run.id,
          testCaseId: c.id,
          status: results[i] ?? 'untested',
          executedById: results[i] === 'untested' ? null : (project.memberIds[0] ?? project.leaderId),
          executedAt: results[i] === 'untested' ? null : daysFromNow(-1),
          note: results[i] === 'failed' ? 'Không hiện thông báo lỗi sau khi nhập sai mật khẩu' : null,
          bugId: results[i] === 'failed' ? (bugRows[1] as { id: number }).id : null,
        },
      });
    }

    // -------------------------------------------------------------- wiki
    const home = await prisma.wikiPage.create({ data: { projectId: pid, title: 'Giới thiệu dự án', slug: 'gioi-thieu-du-an', content: `# ${project.name}\n\nTài liệu kỹ thuật của dự án.\n\n## Mục lục\n- Hướng dẫn cài đặt\n- Đặc tả API\n\n> Mọi thành viên đều có thể chỉnh sửa trang này.`, createdById: project.leaderId, updatedById: project.leaderId } });
    await prisma.wikiPage.create({ data: { projectId: pid, parentId: home.id, title: 'Hướng dẫn cài đặt', slug: 'huong-dan-cai-dat', content: '# Hướng dẫn cài đặt\n\n```bash\nnpm install\nnpm run dev\n```\n\n- Node.js 20 trở lên\n- MySQL 8', createdById: project.memberIds[0] ?? project.leaderId, updatedById: project.memberIds[0] ?? project.leaderId } });
    const api = await prisma.wikiPage.create({
      data: {
        projectId: pid,
        parentId: home.id,
        title: 'Đặc tả API đăng nhập',
        slug: 'dac-ta-api-dang-nhap',
        content: '# Đăng nhập\n\n```\nPOST /api/auth/login\n```\n\n| Tham số | Kiểu | Bắt buộc | Mô tả |\n| --- | --- | --- | --- |\n| `email` | string | có | Email đăng nhập |\n| `password` | string | có | Mật khẩu |\n\n**200 OK** trả về `accessToken` và `refreshToken`.',
        createdById: project.memberIds[0] ?? project.leaderId,
        updatedById: project.leaderId,
      },
    });
    await prisma.wikiRevision.create({ data: { pageId: api.id, title: 'Đặc tả API đăng nhập (nháp)', content: '# Đăng nhập\n\n(đang soạn)', authorId: project.memberIds[0] ?? project.leaderId } });

    // -------------------------------------------------------- tự động hóa
    const doneStatus = await pick(pid, 'task', 'done');
    await prisma.automationRule.create({ data: { projectId: pid, name: 'Bug khẩn cấp: báo ngay cho trưởng nhóm', trigger: 'task_created', conditions: { type: 'bug', priority: 'urgent' }, actions: [{ type: 'notify', toLeader: true, message: 'Bug khẩn cấp mới: {{title}}' }], createdById: project.leaderId } });
    await prisma.automationRule.create({ data: { projectId: pid, name: 'Hoàn thành: ghi nhận bằng bình luận', trigger: 'status_changed', conditions: { statusId: doneStatus.id }, actions: [{ type: 'add_comment', text: '{{user}} đã hoàn thành "{{title}}".' }], createdById: project.leaderId } });

    // ------------------------------------------------------ nghỉ phép (người đầu tiên của dự án đầu tiên)
    if (pIndex === 0 && project.memberIds[0] !== undefined) {
      let monday = 1;
      while (new Date(Date.now() + 7 * 3600e3 + monday * DAY).getUTCDay() !== 1) monday++;
      const dayStart = (offset: number): Date => new Date(Math.floor((Date.now() + 7 * 3600e3 + offset * DAY) / DAY) * DAY - 7 * 3600e3);
      await prisma.leave.create({ data: { userId: project.memberIds[0], startDate: dayStart(monday), endDate: dayStart(monday + 2), type: 'annual', status: 'approved', reason: 'Nghỉ phép năm', reviewedById: project.leaderId, reviewedAt: new Date() } });
      if (project.memberIds[1] !== undefined) await prisma.leave.create({ data: { userId: project.memberIds[1], startDate: dayStart(monday + 7), endDate: dayStart(monday + 7), type: 'sick', status: 'pending', reason: 'Khám sức khỏe định kỳ' } });
    }

    // ----------------------------------------------- cổng khách hàng (demo)
    const token = randomBytes(24).toString('base64url');
    await prisma.guestLink.create({ data: { projectId: pid, name: 'Khách hàng demo', tokenHash: createHash('sha256').update(token).digest('hex'), tokenPrefix: token.slice(0, 6), createdById: project.leaderId } });
    lines.push(`Cổng khách hàng "${project.name}": /portal/${token}`);
    void n2;
  }
  return lines;
}
