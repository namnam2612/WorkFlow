export type Role = 'admin' | 'leader' | 'member';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface UserBrief {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProjectSummary {
  id: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  createdById: number;
  createdAt: string;
  createdBy: UserBrief;
  members: UserBrief[];
  taskCount: number;
  doneCount: number;
  overdueCount: number;
  progress: number;
}

export interface ProjectDetail extends ProjectSummary {
  members: (UserBrief & { role: Role; email: string })[];
}

export interface Task {
  id: number;
  projectId: number;
  parentId: number | null;
  title: string;
  description: string | null;
  assigneeId: number | null;
  creatorId: number;
  status: TaskStatus;
  priority: Priority;
  deadline: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  position: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: UserBrief | null;
  project?: { id: number; name: string };
  subtaskTotal: number;
  subtaskDone: number;
  commentCount: number;
}

export interface TaskDetail extends Task {
  creator: UserBrief;
  project: { id: number; name: string; createdById: number };
  parent: { id: number; title: string; assigneeId: number | null } | null;
  subtasks: Task[];
}

export interface Comment {
  id: number;
  taskId: number;
  userId: number;
  content: string;
  createdAt: string;
  user: UserBrief;
}

export interface ActivityLogEntry {
  id: number;
  taskId: number;
  userId: number;
  action: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
  user: UserBrief;
}

export interface AppNotification {
  id: number;
  userId: number;
  type: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface TaskFilters {
  projectId?: number;
  assigneeId?: number;
  status?: TaskStatus;
  priority?: Priority;
  deadlineFrom?: string;
  deadlineTo?: string;
  search?: string;
  sortBy?: 'createdAt' | 'deadline' | 'priority' | 'status' | 'title' | 'updatedAt';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export type StatusCounts = Record<TaskStatus, number>;

export interface DashboardData {
  scope: 'mine' | 'team';
  statusCounts: StatusCounts;
  totalTasks: number;
  upcoming: Task[];
  upcomingCount: number;
  overdue: Task[];
  overdueCount: number;
  projectProgress: { projectId: number; name: string; total: number; done: number; progress: number }[];
  workload: { userId: number; name: string; todo: number; in_progress: number; review: number; blocked: number; done: number; overdue: number }[];
}

export interface UserStats {
  counts: StatusCounts;
  overdue: number;
  total: number;
}

export interface UserProfile extends User {
  stats: UserStats;
}
