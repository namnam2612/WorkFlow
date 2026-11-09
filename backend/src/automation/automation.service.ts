import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AutomationRule, AutomationTrigger, Prisma } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/types/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { RealtimeService } from '../realtime/realtime.service';
import { scopeOfType } from '../statuses/default-statuses';
import { CreateAutomationDto, UpdateAutomationDto } from './dto/automation.dto';
import { AutomationAction, Conditions, matches, parseActions, parseConditions, renderTemplate } from './rules';

export interface AutomationEvent {
  type: AutomationTrigger;
  taskId: number;
  /** Người thực hiện thao tác gây ra sự kiện (không dùng làm quyền; chỉ để ghi nhận) */
  actorId: number;
}

type ActionOutcome = { applied: string } | { skipped: string };

const taskInclude = {
  status: true,
  assignees: { select: { userId: true } },
  project: { select: { id: true, name: true, createdById: true } },
} satisfies Prisma.TaskInclude;
type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

/**
 * Quy tắc tự động theo dự án. Hành động chạy với quyền hệ thống (không phụ thuộc người gây ra sự kiện)
 * và ghi thẳng vào DB nên KHÔNG kích hoạt thêm quy tắc khác — chống vòng lặp quy tắc gọi quy tắc.
 */
@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  // ------------------------------------------------------------------ CRUD

  async list(user: AuthUser, projectId: number) {
    await this.access.assertCanView(user, projectId);
    const rules = await this.prisma.automationRule.findMany({ where: { projectId }, orderBy: { id: 'asc' } });
    return rules.map((r) => this.toView(r));
  }

  async create(user: AuthUser, projectId: number, dto: CreateAutomationDto) {
    await this.access.assertCanManage(user, projectId);
    const conditions = this.checkConditions(dto.conditions);
    const actions = this.checkActions(dto.actions);
    await this.assertReferences(projectId, conditions, actions);
    const rule = await this.prisma.automationRule.create({
      data: { projectId, name: dto.name, trigger: dto.trigger, enabled: dto.enabled ?? true, conditions: conditions as Prisma.InputJsonObject, actions: actions, createdById: user.id },
    });
    return this.toView(rule);
  }

  async update(user: AuthUser, id: number, dto: UpdateAutomationDto) {
    const rule = await this.findOrThrow(id);
    await this.access.assertCanManage(user, rule.projectId);
    const conditions = dto.conditions === undefined ? undefined : this.checkConditions(dto.conditions);
    const actions = dto.actions === undefined ? undefined : this.checkActions(dto.actions);
    await this.assertReferences(rule.projectId, conditions ?? (rule.conditions as Conditions), actions ?? (rule.actions as unknown as AutomationAction[]));
    const updated = await this.prisma.automationRule.update({
      where: { id },
      data: {
        name: dto.name,
        trigger: dto.trigger,
        enabled: dto.enabled,
        conditions: conditions as Prisma.InputJsonObject | undefined,
        actions: actions,
      },
    });
    return this.toView(updated);
  }

  async remove(user: AuthUser, id: number): Promise<void> {
    const rule = await this.findOrThrow(id);
    await this.access.assertCanManage(user, rule.projectId);
    await this.prisma.automationRule.delete({ where: { id } });
  }

  // ---------------------------------------------------------------- engine

  /** Chạy các quy tắc khớp với sự kiện. Không bao giờ ném lỗi để không làm hỏng thao tác gốc của người dùng. */
  async handle(event: AutomationEvent): Promise<void> {
    try {
      const task = await this.prisma.task.findUnique({ where: { id: event.taskId }, include: taskInclude });
      if (!task) return;
      const rules = await this.prisma.automationRule.findMany({ where: { projectId: task.projectId, trigger: event.type, enabled: true }, orderBy: { id: 'asc' } });
      // Điều kiện luôn so với trạng thái LÚC XẢY RA sự kiện: việc quy tắc trước đổi công việc không làm quy tắc sau
      // khớp thêm (tránh chuỗi A→B→A trong cùng một sự kiện). Hành động vẫn thao tác trên dữ liệu hiện tại.
      for (const rule of rules) {
        if (!matches(rule.conditions as Conditions, task)) continue;
        await this.runRule(rule, task, event);
      }
    } catch (error) {
      this.logger.warn(`Chạy quy tắc tự động thất bại (sự kiện ${event.type}, việc ${event.taskId}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async runRule(rule: AutomationRule, task: TaskRow, event: AutomationEvent): Promise<void> {
    const parsed = parseActions(rule.actions);
    if (!parsed.ok) {
      this.logger.warn(`Quy tắc ${rule.id} có hành động không hợp lệ: ${parsed.error}`);
      return;
    }
    const outcomes: ActionOutcome[] = [];
    for (const action of parsed.value) {
      try {
        outcomes.push(await this.apply(action, rule, task, event));
      } catch (error) {
        outcomes.push({ skipped: `${action.type}: ${error instanceof Error ? error.message : 'lỗi'}` });
      }
    }
    const applied = outcomes.filter((o): o is { applied: string } => 'applied' in o).map((o) => o.applied);
    const skipped = outcomes.filter((o): o is { skipped: string } => 'skipped' in o).map((o) => o.skipped);
    await this.prisma.automationRule.update({ where: { id: rule.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
    if (applied.length > 0) {
      await this.activity.log({ taskId: task.id, userId: rule.createdById, action: 'automation_applied', detail: { rule: { id: rule.id, name: rule.name }, applied, skipped } });
      this.realtime.taskChanged(task.projectId, task.id);
    }
  }

  private async apply(action: AutomationAction, rule: AutomationRule, task: TaskRow, event: AutomationEvent): Promise<ActionOutcome> {
    const vars = async (): Promise<Record<string, string>> => {
      const actor = await this.prisma.user.findUnique({ where: { id: event.actorId }, select: { name: true } });
      const status = await this.prisma.projectStatus.findUnique({ where: { id: (await this.prisma.task.findUniqueOrThrow({ where: { id: task.id }, select: { statusId: true } })).statusId }, select: { name: true } });
      return { title: task.title, status: status?.name ?? task.status.name, user: actor?.name ?? '', project: task.project.name };
    };

    switch (action.type) {
      case 'set_status': {
        const target = await this.prisma.projectStatus.findUnique({ where: { id: action.statusId } });
        if (!target || target.projectId !== task.projectId) return { skipped: 'Trạng thái đích không còn tồn tại' };
        if (target.scope !== scopeOfType(task.type)) return { skipped: `Trạng thái "${target.name}" không dùng được cho loại công việc này` };
        const current = await this.prisma.task.findUniqueOrThrow({ where: { id: task.id }, select: { statusId: true, completedAt: true, parentId: true } });
        if (current.statusId === target.id) return { skipped: `Đã ở trạng thái "${target.name}"` };
        const from = await this.prisma.projectStatus.findUnique({ where: { id: current.statusId }, select: { id: true, name: true, category: true } });
        const max = await this.prisma.task.aggregate({ where: { projectId: task.projectId, statusId: target.id, parentId: current.parentId }, _max: { position: true } });
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            statusId: target.id,
            position: (max._max.position ?? -1) + 1,
            completedAt: target.category === 'done' ? (from?.category === 'done' && current.completedAt ? current.completedAt : new Date()) : null,
          },
        });
        await this.activity.log({ taskId: task.id, userId: rule.createdById, action: 'status_changed', detail: { from: from ? { id: from.id, name: from.name } : null, to: { id: target.id, name: target.name }, by: 'automation' } });
        return { applied: `Đổi trạng thái sang "${target.name}"` };
      }
      case 'assign': {
        const already = new Set((await this.prisma.taskAssignee.findMany({ where: { taskId: task.id }, select: { userId: true } })).map((a) => a.userId));
        const members = await this.prisma.user.findMany({
          where: { id: { in: action.userIds.filter((id) => !already.has(id)) }, isActive: true, OR: [{ memberships: { some: { projectId: task.projectId } } }, { id: task.project.createdById }] },
          select: { id: true, name: true },
        });
        if (members.length === 0) return { skipped: 'Không có người hợp lệ để giao (phải là thành viên dự án và chưa được giao)' };
        await this.prisma.taskAssignee.createMany({ data: members.map((m) => ({ taskId: task.id, userId: m.id })) });
        await this.activity.log({ taskId: task.id, userId: rule.createdById, action: 'assignee_changed', detail: { added: members, removed: [], by: 'automation' } });
        await this.notifications.notify(members.map((m) => ({ userId: m.id, type: 'task_assigned', message: `Bạn được giao công việc "${task.title}"`, channelMessage: `${m.name} được giao công việc "${task.title}"`, link: `/tasks/${task.id}`, projectId: task.projectId })));
        return { applied: `Giao việc cho ${members.map((m) => m.name).join(', ')}` };
      }
      case 'set_priority': {
        const current = await this.prisma.task.findUniqueOrThrow({ where: { id: task.id }, select: { priority: true } });
        if (current.priority === action.priority) return { skipped: 'Mức ưu tiên đã đúng' };
        await this.prisma.task.update({ where: { id: task.id }, data: { priority: action.priority } });
        await this.activity.log({ taskId: task.id, userId: rule.createdById, action: 'priority_changed', detail: { from: current.priority, to: action.priority, by: 'automation' } });
        return { applied: `Đổi mức ưu tiên sang ${action.priority}` };
      }
      case 'add_comment': {
        const text = renderTemplate(action.text, await vars());
        await this.prisma.comment.create({ data: { taskId: task.id, userId: rule.createdById, content: `🤖 ${text}` } });
        return { applied: 'Thêm bình luận tự động' };
      }
      case 'notify': {
        const message = renderTemplate(action.message, await vars());
        const wanted = new Set<number>(action.userIds ?? []);
        if (action.toLeader) wanted.add(task.project.createdById);
        const valid = await this.prisma.user.findMany({
          where: { id: { in: [...wanted] }, isActive: true, OR: [{ memberships: { some: { projectId: task.projectId } } }, { id: task.project.createdById }] },
          select: { id: true },
        });
        if (valid.length === 0) return { skipped: 'Không có người nhận hợp lệ' };
        await this.notifications.notify(valid.map((u) => ({ userId: u.id, type: 'automation', message, link: `/tasks/${task.id}`, projectId: task.projectId })));
        return { applied: `Gửi thông báo cho ${valid.length} người` };
      }
    }
  }

  // ---------------------------------------------------------------- helpers

  private toView(rule: AutomationRule) {
    return { ...rule, conditions: rule.conditions as Conditions, actions: rule.actions as unknown as AutomationAction[] };
  }

  private async findOrThrow(id: number): Promise<AutomationRule> {
    const rule = await this.prisma.automationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Không tìm thấy quy tắc');
    return rule;
  }

  private checkConditions(raw: unknown): Conditions {
    const parsed = parseConditions(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.error);
    return parsed.value;
  }

  private checkActions(raw: unknown): AutomationAction[] {
    const parsed = parseActions(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.error);
    return parsed.value;
  }

  /** Trạng thái và người được nhắc tới phải thuộc đúng dự án (tránh quy tắc trỏ sang dữ liệu dự án khác) */
  private async assertReferences(projectId: number, conditions: Conditions, actions: AutomationAction[]): Promise<void> {
    const statusIds = [conditions.statusId, ...actions.map((a) => (a.type === 'set_status' ? a.statusId : undefined))].filter((v): v is number => v !== undefined);
    if (statusIds.length > 0) {
      const found = await this.prisma.projectStatus.count({ where: { id: { in: statusIds }, projectId } });
      if (found !== new Set(statusIds).size) throw new BadRequestException('Trạng thái được chọn không thuộc dự án này');
    }
    const userIds = [...new Set(actions.flatMap((a) => (a.type === 'assign' ? a.userIds : a.type === 'notify' ? (a.userIds ?? []) : [])))];
    if (userIds.length > 0) {
      const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { createdById: true } });
      const members = await this.prisma.projectMember.findMany({ where: { projectId, userId: { in: userIds } }, select: { userId: true } });
      const ok = new Set([project.createdById, ...members.map((m) => m.userId)]);
      if (userIds.some((id) => !ok.has(id))) throw new BadRequestException('Người được chọn phải là thành viên của dự án');
    }
  }
}
