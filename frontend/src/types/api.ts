export type Role = 'admin' | 'leader' | 'member';
/** Nhóm trạng thái: hệ thống chỉ cần biết chưa làm / đang làm / đã xong; tên và màu do từng dự án đặt */
export type StatusCategory = 'todo' | 'in_progress' | 'done';
/** Bộ trạng thái: công việc thường hay Bug (vòng đời riêng) */
export type StatusScope = 'task' | 'bug';
export type TaskType = 'task' | 'story' | 'bug' | 'epic';
export type SprintStatus = 'planned' | 'active' | 'completed';
export type BugSeverity = 'minor' | 'major' | 'critical' | 'blocker';
export type Environment = 'dev' | 'staging' | 'prod';

/** Trạng thái nhúng trong task */
export interface StatusRef {
  id: number;
  name: string;
  color: string;
  category: StatusCategory;
  scope: StatusScope;
}

export interface ProjectStatus extends StatusRef {
  projectId: number;
  position: number;
}
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  isActive: boolean;
  /** Nhận thêm thông báo qua email */
  emailNotifications: boolean;
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
  /** Đã cấu hình Slack webhook (URL là bí mật nên không trả về) */
  slackConfigured: boolean;
  /** Nhóm phụ trách dự án */
  team: { id: number; name: string } | null;
  teamId: number | null;
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
  creatorId: number;
  type: TaskType;
  statusId: number;
  status: StatusRef;
  storyPoints: number | null;
  startDate: string | null;
  sprintId: number | null;
  sprint: { id: number; name: string; status: SprintStatus } | null;
  epicId: number | null;
  epic: { id: number; title: string } | null;
  fixReleaseId: number | null;
  fixRelease: { id: number; version: string } | null;
  foundReleaseId: number | null;
  foundRelease: { id: number; version: string } | null;
  severity: BugSeverity | null;
  environment: Environment | null;
  priority: Priority;
  deadline: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  position: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Những người cùng thực hiện (rỗng = chưa giao), theo thứ tự được giao */
  assignees: UserBrief[];
  project?: { id: number; name: string };
  subtaskTotal: number;
  subtaskDone: number;
  commentCount: number;
  attachmentCount: number;
}

export interface TaskDetail extends Task {
  creator: UserBrief;
  project: { id: number; name: string; createdById: number };
  parent: { id: number; title: string; assigneeIds: number[] } | null;
  subtasks: Task[];
  /** Phải chờ những việc này xong */
  dependsOn: DependencyRef[];
  /** Những việc đang chờ công việc này */
  blocking: DependencyRef[];
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
  /** Task có BẤT KỲ người nào trong danh sách */
  assigneeIds?: number[];
  statusId?: number;
  sprintId?: number;
  epicId?: number;
  fixReleaseId?: number;
  foundReleaseId?: number;
  environment?: Environment;
  statusCategory?: StatusCategory;
  types?: TaskType[];
  priority?: Priority;
  deadlineFrom?: string;
  deadlineTo?: string;
  search?: string;
  sortBy?: 'createdAt' | 'deadline' | 'priority' | 'status' | 'title' | 'updatedAt';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export type StatusCounts = Record<StatusCategory, number>;

export interface DashboardData {
  scope: 'mine' | 'team';
  categoryCounts: StatusCounts;
  /** Gộp theo tên trạng thái (mỗi dự án có bộ riêng) */
  statusBreakdown: { name: string; color: string; category: StatusCategory; count: number }[];
  totalTasks: number;
  upcoming: Task[];
  upcomingCount: number;
  overdue: Task[];
  overdueCount: number;
  projectProgress: { projectId: number; name: string; total: number; done: number; progress: number }[];
  workload: { userId: number; name: string; todo: number; in_progress: number; done: number; overdue: number }[];
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

export type AttachmentSource = 'project' | 'task';

/** File đính kèm; `uploader` là người gửi (người đã tải file lên) */
export interface Attachment {
  id: number;
  /** 'project' = đính vào dự án, 'task' = đính vào công việc */
  source: AttachmentSource;
  /** null với file của dự án */
  taskId: number | null;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploader: UserBrief;
  /** null với file của dự án */
  task: { id: number; title: string; status: StatusRef } | null;
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
  /** Nguồn: file của dự án hay của công việc */
  source?: AttachmentSource;
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

// ---- Kho tài liệu dạng thư mục (Dự án → Công việc → File)

/** Số file, tổng dung lượng và thời điểm file mới nhất của một thư mục */
export interface FolderStats {
  fileCount: number;
  totalSize: number;
  latestAt: string | null;
}

export interface ProjectFolder extends FolderStats {
  id: number;
  name: string;
}

export interface TaskFolder extends FolderStats {
  id: number;
  /** Tiêu đề task */
  name: string;
  status: StatusRef;
  /** Task cha nếu đây là công việc con */
  parent: { id: number; title: string } | null;
}

/** Cấp 2: trong một dự án */
export type ProjectContents = Paginated<TaskFolder> & {
  project: { id: number; name: string };
  /** File chung của dự án (đính trực tiếp vào dự án) */
  common: FolderStats;
  canUpload: boolean;
};

export type ProjectFilesPage = Paginated<Attachment> & { project: { id: number; name: string }; canUpload: boolean };

export type TaskFilesPage = Paginated<Attachment> & {
  task: { id: number; title: string; status: StatusRef; projectId: number; projectName: string; parent: { id: number; title: string } | null };
  canUpload: boolean;
};

export interface FolderParams {
  search?: string;
  sortBy?: 'name' | 'updatedAt';
  order?: 'asc' | 'desc';
  includeEmpty?: boolean;
  page?: number;
  pageSize?: number;
}

export interface FileListParams {
  search?: string;
  sortBy?: 'name' | 'updatedAt' | 'size';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface SprintStats {
  taskCount: number;
  doneCount: number;
  points: number;
  donePoints: number;
}

export interface Sprint {
  id: number;
  projectId: number;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: SprintStatus;
  committedPoints: number | null;
  completedPoints: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export type SprintWithStats = Sprint & { stats: SprintStats };

export interface BacklogData {
  sprints: (SprintWithStats & { tasks: Task[] })[];
  /** Việc chưa thuộc sprint nào */
  backlog: Task[];
  epics: (Task & { stats: SprintStats })[];
}

export interface BurndownData {
  sprint: Sprint;
  unit: 'points' | 'tasks';
  committed: number;
  scope: number;
  points: { date: string; ideal: number; remaining: number | null }[];
}

export interface VelocityData {
  items: { id: number; name: string; committed: number; completed: number; completedAt: string | null }[];
  average: number;
}

export interface WorkLog {
  id: number;
  taskId: number;
  userId: number;
  minutes: number;
  workedOn: string;
  note: string | null;
  createdAt: string;
  user: UserBrief;
}

export interface Timesheet {
  from: string;
  to: string;
  totalMinutes: number;
  byUser: { user: UserBrief; minutes: number; taskCount: number }[];
  byDay: { date: string; minutes: number }[];
}

export type Specialty = 'dev' | 'qa' | 'designer' | 'other';

export interface Team {
  id: number;
  name: string;
  description: string | null;
  leaderId: number;
  leader: UserBrief;
  memberCount: number;
  projectCount: number;
  /** Người xem có quyền quản lý nhóm này (trưởng nhóm hoặc admin) */
  canManage: boolean;
  createdAt: string;
}

export interface TeamMemberView extends UserBrief {
  email: string;
  jobTitle: string | null;
  specialty: Specialty;
  joinedAt: string;
}

export interface TeamDetail extends Team {
  members: TeamMemberView[];
  projects: { id: number; name: string }[];
}

export type LeaveType = 'annual' | 'sick' | 'unpaid' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Leave {
  id: number;
  user: UserBrief;
  startDate: string;
  endDate: string;
  type: LeaveType;
  status: LeaveStatus;
  createdAt: string;
  /** Ẩn với đồng đội (chỉ chủ đơn, người duyệt và admin thấy) */
  reason: string | null;
  reviewNote: string | null;
  reviewer: UserBrief | null;
  reviewedAt: string | null;
  canReview: boolean;
  canCancel: boolean;
}

export interface Capacity {
  from: string;
  to: string;
  hoursPerDay: number;
  totalAvailableDays: number;
  totalAvailableHours: number;
  totalLeaveDays: number;
  members: { user: UserBrief; workingDays: number; leaveDays: number; availableDays: number; availableHours: number }[];
}

export type SprintCapacity = Capacity & { sprintId: number; plannedPoints: number; committedPoints: number | null };

export interface CalendarData {
  from: string;
  to: string;
  tasks: Task[];
  sprints: { id: number; projectId: number; name: string; status: SprintStatus; startDate: string | null; endDate: string | null }[];
  leaves: Leave[];
}

export interface GanttData {
  tasks: Task[];
  dependencies: { taskId: number; dependsOnId: number }[];
  sprints: { id: number; name: string; status: SprintStatus; startDate: string | null; endDate: string | null }[];
}

export interface DependencyRef {
  id: number;
  title: string;
  status: StatusRef;
  deadline?: string | null;
}

export interface ReleaseStats {
  items: number;
  doneItems: number;
  bugsFixed: number;
  openBugsFound: number;
}

export interface Release {
  id: number;
  projectId: number;
  version: string;
  name: string | null;
  description: string | null;
  status: 'planned' | 'released';
  releasedAt: string | null;
  createdAt: string;
  stats: ReleaseStats;
}

export interface ReleaseDetail extends Release {
  fixes: Task[];
  found: Task[];
  /** Release notes dạng Markdown tự tạo từ các việc trong phiên bản */
  notes: string;
}

export type TestResultStatus = 'untested' | 'passed' | 'failed' | 'blocked' | 'skipped';

export interface TestCase {
  id: number;
  projectId: number;
  title: string;
  preconditions: string | null;
  steps: string;
  expected: string;
  priority: Priority;
  archived: boolean;
  createdById: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestRunSummary {
  id: number;
  projectId: number;
  name: string;
  environment: Environment | null;
  releaseId: number | null;
  release?: { id: number; version: string } | null;
  status: 'open' | 'closed';
  createdAt: string;
  closedAt: string | null;
  counts: Record<TestResultStatus, number>;
  total: number;
  executed: number;
  passRate: number | null;
}

export interface TestResultView {
  id: number;
  runId: number;
  testCaseId: number;
  status: TestResultStatus;
  note: string | null;
  executedAt: string | null;
  executedBy: UserBrief | null;
  bugId: number | null;
  bug: { id: number; title: string; status: StatusRef } | null;
  testCase: Pick<TestCase, 'id' | 'title' | 'preconditions' | 'steps' | 'expected' | 'priority' | 'archived'>;
}

export type TestRunDetail = TestRunSummary & { results: TestResultView[] };

export interface WikiNode {
  id: number;
  parentId: number | null;
  title: string;
  slug: string;
  position: number;
  updatedAt: string;
}

export interface WikiPageDetail extends WikiNode {
  projectId: number;
  content: string;
  createdAt: string;
  createdBy: UserBrief | null;
  updatedBy: UserBrief | null;
}

export interface WikiRevisionView {
  id: number;
  pageId: number;
  title: string;
  content: string;
  createdAt: string;
  author: UserBrief | null;
}

export type SearchKind = 'task' | 'wiki' | 'testCase' | 'release' | 'file' | 'comment';

export interface SearchHit {
  kind: SearchKind;
  id: number;
  title: string;
  snippet: string;
  projectId: number;
  projectName: string;
  link: string;
  score: number;
}

export interface SearchResult {
  query: string;
  terms: string[];
  total: number;
  groups: { kind: SearchKind; hits: SearchHit[] }[];
}

export type AutomationTrigger = 'task_created' | 'status_changed' | 'task_assigned';

export interface AutomationConditions {
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

export interface AutomationRule {
  id: number;
  projectId: number;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
  runCount: number;
  lastRunAt: string | null;
}

export interface GuestLink {
  id: number;
  projectId: number;
  name: string;
  tokenPrefix: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  lastViewedAt: string | null;
  viewCount: number;
}

export interface PortalData {
  project: { name: string; description: string | null; startDate: string | null; endDate: string | null; progress: number };
  sprints: { name: string; goal: string | null; status: SprintStatus; startDate: string | null; endDate: string | null; progress: number }[];
  epics: { title: string; progress: number; status: StatusCategory }[];
  releases: { version: string; name: string | null; status: 'planned' | 'released'; releasedAt: string | null; description: string | null }[];
  generatedAt: string;
}
