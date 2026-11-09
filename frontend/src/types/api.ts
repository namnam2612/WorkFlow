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
  /** Hồ sơ cá nhân (tùy chọn) */
  jobTitle: string | null;
  phone: string | null;
  contactEmail: string | null;
  bio: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
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
  attachmentCount: number;
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

export type FileCategory = 'image' | 'pdf' | 'document' | 'spreadsheet' | 'other';

/** File đính kèm; `uploader` là người gửi (người đã tải file lên) */
export interface Attachment {
  id: number;
  taskId: number;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploader: UserBrief;
  task: { id: number; title: string; status: TaskStatus };
  project: { id: number; name: string };
  /** Ảnh/PDF xem trực tiếp được */
  previewable: boolean;
  /** Người xem có quyền xóa file này không (người gửi, leader dự án, admin) */
  canDelete: boolean;
}

/** Số file theo loại (cùng bộ lọc trừ loại); `file` = mọi thứ không phải ảnh */
export type AttachmentCounts = Record<FileCategory | 'all' | 'file', number>;

export type AttachmentPage = Paginated<Attachment> & { counts: AttachmentCounts };

export interface AttachmentFilters {
  search?: string;
  projectId?: number;
  uploaderId?: number;
  /** `file` = mọi thứ không phải ảnh (tab Tài liệu) */
  type?: FileCategory | 'file';
  from?: string;
  to?: string;
  sortBy?: 'createdAt' | 'name' | 'size';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
