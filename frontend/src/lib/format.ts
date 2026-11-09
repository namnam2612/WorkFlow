import type { Task } from '../types/api';

export const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFormatter.format(new Date(iso)) : '—';
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTimeFormatter.format(new Date(iso)) : '—';
}

/** "5 phút trước", "2 giờ trước", ... */
export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return formatDate(iso);
}

/** ISO (UTC) -> giá trị cho <input type="datetime-local"> theo giờ Việt Nam */
export function isoToVnDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + VN_OFFSET_MS).toISOString().slice(0, 16);
}

/** Giá trị <input type="datetime-local"> (giờ VN) -> ISO UTC; rỗng -> null */
export function vnDateTimeInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO -> "YYYY-MM-DD" theo giờ VN (cho <input type="date">) */
export function isoToVnDateInput(iso: string | null | undefined): string {
  return iso ? isoToVnDateTimeInput(iso).slice(0, 10) : '';
}

/** "YYYY-MM-DD" (VN) -> ISO UTC tại 00:00 VN; rỗng -> null */
export function vnDateInputToIso(value: string): string | null {
  return vnDateTimeInputToIso(value ? `${value}T00:00` : '');
}

/** Cuối ngày VN (23:59:59.999) của "YYYY-MM-DD" -> ISO UTC */
export function vnDateInputToEndOfDayIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function isOverdue(task: Pick<Task, 'deadline' | 'status'>): boolean {
  return task.status.category !== 'done' && task.deadline !== null && new Date(task.deadline).getTime() < Date.now();
}

/** Số ngày còn lại tới deadline (âm = đã quá hạn), làm tròn lên */
export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS);
}

export function deadlineLabel(task: Pick<Task, 'deadline' | 'status'>): string {
  if (!task.deadline) return 'Không có deadline';
  if (task.status.category === 'done') return formatDate(task.deadline);
  const days = daysUntil(task.deadline);
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Ngày mai';
  return formatDate(task.deadline);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? '';
  const first = parts.length > 1 ? (parts[0] ?? '') : '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
