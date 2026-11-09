import { Priority, TaskStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { toBoolean, trimString } from '../../common/utils/transforms';

export const TASK_SORT_FIELDS = ['createdAt', 'updatedAt', 'deadline', 'priority', 'status', 'title'] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export class ListTasksQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeId?: number;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsDateString()
  deadlineFrom?: string;

  @IsOptional()
  @IsDateString()
  deadlineTo?: string;

  /** Chỉ lấy task quá hạn (chưa hoàn thành và deadline < hiện tại) */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(TASK_SORT_FIELDS)
  sortBy: TaskSortField = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';

  /** Mặc định chỉ trả task cấp cao; true để gồm cả công việc con */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeSubtasks?: boolean;
}
