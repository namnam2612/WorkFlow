import { AlertTriangle, Bell, Clock, FolderPlus, MessageSquare, RefreshCw, UserPlus, type LucideIcon } from 'lucide-react';

export const NOTIFICATION_META: Record<string, { icon: LucideIcon; color: string }> = {
  task_assigned: { icon: UserPlus, color: 'bg-indigo-100 text-indigo-600' },
  comment_added: { icon: MessageSquare, color: 'bg-sky-100 text-sky-600' },
  status_changed: { icon: RefreshCw, color: 'bg-emerald-100 text-emerald-600' },
  deadline_soon: { icon: Clock, color: 'bg-orange-100 text-orange-600' },
  deadline_changed: { icon: Clock, color: 'bg-amber-100 text-amber-600' },
  task_overdue: { icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
  project_added: { icon: FolderPlus, color: 'bg-violet-100 text-violet-600' },
};

export const DEFAULT_NOTIFICATION_META = { icon: Bell, color: 'bg-slate-100 text-slate-600' };
