import { Priority, StatusCategory, TaskType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { toBoolean, toNumberList, trimString } from '../../common/utils/transforms';

export const TASK_SORT_FIELDS = ['createdAt', 'updatedAt', 'deadline', 'priority', 'status', 'title', 'type'] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export class ListTasksQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  /** Lọc theo người được giao: "1,2" hoặc lặp tham số; task có BẤT KỲ người nào trong danh sách */
  @IsOptional()
  @Transform(toNumberList)
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true, message: 'Mã người được giao không hợp lệ' })
  assigneeIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusId?: number;

  /** Lọc theo nhóm trạng thái (cần làm / đang làm / đã xong) xuyên qua mọi dự án */
  @IsOptional()
  @IsEnum(StatusCategory)
  statusCategory?: StatusCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sprintId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  epicId?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  @IsEnum(TaskType, { each: true })
  types?: TaskType[];

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
