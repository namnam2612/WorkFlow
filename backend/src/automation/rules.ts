import { AutomationTrigger, Priority, TaskType } from '@prisma/client';

export interface Conditions {
  /** Trạng thái hiện tại của công việc (với "đổi trạng thái" là trạng thái MỚI) */
  statusId?: number;
  type?: TaskType;
  priority?: Priority;
}

export type AutomationAction =
  | { type: 'set_status'; statusId: number }
  | { type: 'assign'; userIds: number[] }
  | { type: 'set_priority'; priority: Priority }
  | { type: 'add_comment'; text: string }
  | { type: 'notify'; userIds?: number[]; toLeader?: boolean; message: string };

export const TRIGGERS: readonly AutomationTrigger[] = ['task_created', 'status_changed', 'task_assigned'];
export const MAX_ACTIONS = 6;
const TYPES: readonly string[] = ['task', 'story', 'bug', 'epic'];
const PRIORITIES: readonly string[] = ['low', 'medium', 'high', 'urgent'];

/** Mọi điều kiện đã đặt đều phải khớp (AND); không đặt điều kiện nào = luôn khớp */
export function matches(conditions: Conditions, task: { statusId: number; type: TaskType; priority: Priority }): boolean {
  if (conditions.statusId !== undefined && conditions.statusId !== task.statusId) return false;
  if (conditions.type !== undefined && conditions.type !== task.type) return false;
  if (conditions.priority !== undefined && conditions.priority !== task.priority) return false;
  return true;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Kiểm tra hình dạng điều kiện; trả về điều kiện đã chuẩn hóa hoặc chuỗi lỗi tiếng Việt */
export function parseConditions(raw: unknown): { ok: true; value: Conditions } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: {} };
  if (!isObj(raw)) return { ok: false, error: 'Điều kiện phải là một đối tượng' };
  const value: Conditions = {};
  for (const key of Object.keys(raw)) {
    const v = raw[key];
    if (key === 'statusId' && v !== undefined && v !== null) {
      if (!isInt(v)) return { ok: false, error: 'Điều kiện trạng thái không hợp lệ' };
      value.statusId = v;
    } else if (key === 'type' && v !== undefined && v !== null) {
      if (typeof v !== 'string' || !TYPES.includes(v)) return { ok: false, error: 'Điều kiện loại công việc không hợp lệ' };
      value.type = v as TaskType;
    } else if (key === 'priority' && v !== undefined && v !== null) {
      if (typeof v !== 'string' || !PRIORITIES.includes(v)) return { ok: false, error: 'Điều kiện mức ưu tiên không hợp lệ' };
      value.priority = v as Priority;
    } else if (!['statusId', 'type', 'priority'].includes(key)) {
      return { ok: false, error: `Điều kiện không được hỗ trợ: ${key}` };
    }
  }
  return { ok: true, value };
}

/** Kiểm tra hình dạng danh sách hành động; trả về danh sách đã chuẩn hóa hoặc chuỗi lỗi tiếng Việt */
export function parseActions(raw: unknown): { ok: true; value: AutomationAction[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'Cần ít nhất một hành động' };
  if (raw.length > MAX_ACTIONS) return { ok: false, error: `Tối đa ${MAX_ACTIONS} hành động mỗi quy tắc` };
  const out: AutomationAction[] = [];
  for (const item of raw as unknown[]) {
    if (!isObj(item) || typeof item.type !== 'string') return { ok: false, error: 'Hành động không hợp lệ' };
    switch (item.type) {
      case 'set_status':
        if (!isInt(item.statusId)) return { ok: false, error: 'Hành động đổi trạng thái thiếu trạng thái đích' };
        out.push({ type: 'set_status', statusId: item.statusId });
        break;
      case 'assign':
        if (!Array.isArray(item.userIds) || item.userIds.length === 0 || !item.userIds.every(isInt) || item.userIds.length > 20) return { ok: false, error: 'Hành động giao việc cần danh sách người nhận (tối đa 20)' };
        out.push({ type: 'assign', userIds: [...new Set(item.userIds)] });
        break;
      case 'set_priority':
        if (typeof item.priority !== 'string' || !PRIORITIES.includes(item.priority)) return { ok: false, error: 'Hành động đổi mức ưu tiên không hợp lệ' };
        out.push({ type: 'set_priority', priority: item.priority as Priority });
        break;
      case 'add_comment':
        if (typeof item.text !== 'string' || item.text.trim() === '' || item.text.length > 2000) return { ok: false, error: 'Nội dung bình luận tự động phải từ 1 đến 2000 ký tự' };
        out.push({ type: 'add_comment', text: item.text.trim() });
        break;
      case 'notify': {
        const userIds = item.userIds === undefined ? undefined : Array.isArray(item.userIds) && item.userIds.every(isInt) ? (item.userIds) : null;
        if (userIds === null) return { ok: false, error: 'Danh sách người nhận thông báo không hợp lệ' };
        if (typeof item.message !== 'string' || item.message.trim() === '' || item.message.length > 400) return { ok: false, error: 'Nội dung thông báo phải từ 1 đến 400 ký tự' };
        if ((userIds?.length ?? 0) === 0 && item.toLeader !== true) return { ok: false, error: 'Thông báo cần người nhận (chọn người hoặc trưởng nhóm)' };
        out.push({ type: 'notify', userIds, toLeader: item.toLeader === true, message: item.message.trim() });
        break;
      }
      default:
        return { ok: false, error: `Hành động không được hỗ trợ: ${item.type}` };
    }
  }
  return { ok: true, value: out };
}

/** Thay {{title}}, {{status}}, {{user}}, {{project}} trong văn bản; biến lạ giữ nguyên */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) => vars[key] ?? whole);
}
