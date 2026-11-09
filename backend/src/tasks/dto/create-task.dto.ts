import { BugSeverity, Environment, Priority, TaskType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { trimString } from '../../common/utils/transforms';

export class CreateTaskDto {
  @IsInt()
  projectId: number;

  /** Có giá trị => tạo công việc con (chỉ hỗ trợ 1 cấp) */
  @IsOptional()
  @IsInt()
  parentId?: number | null;

  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Tiêu đề không được để trống' })
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  /** Những người cùng thực hiện (thành viên của dự án); [] hoặc bỏ trống = chưa giao. Khi sửa: thay toàn bộ danh sách. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50, { message: 'Tối đa 50 người được giao' })
  @ArrayUnique({ message: 'Danh sách người được giao bị trùng' })
  @IsInt({ each: true, message: 'Mã người được giao không hợp lệ' })
  assigneeIds?: number[];

  /** Loại công việc; mặc định task. Bug dùng bộ trạng thái riêng của Bug. */
  @IsOptional()
  @IsEnum(TaskType, { message: 'Loại công việc không hợp lệ' })
  type?: TaskType;

  /** Trạng thái (thuộc dự án, đúng bộ theo loại); bỏ trống = trạng thái đầu tiên của bộ */
  @IsOptional()
  @IsInt({ message: 'Trạng thái không hợp lệ' })
  statusId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  storyPoints?: number | null;

  /** Sprint của dự án (chưa kết thúc); null = về backlog. Chỉ công việc cấp cao, không phải Epic. */
  @IsOptional()
  @IsInt()
  sprintId?: number | null;

  /** Epic của dự án mà story/công việc này thuộc về; null = không thuộc epic */
  @IsOptional()
  @IsInt()
  epicId?: number | null;

  /** Chỉ dùng cho Bug */
  @IsOptional()
  @IsEnum(BugSeverity, { message: 'Mức độ nghiêm trọng không hợp lệ' })
  severity?: BugSeverity | null;

  /** Chỉ dùng cho Bug */
  @IsOptional()
  @IsEnum(Environment, { message: 'Môi trường không hợp lệ' })
  environment?: Environment | null;

  @IsOptional()
  @IsEnum(Priority, { message: 'Mức ưu tiên không hợp lệ' })
  priority?: Priority;

  /** Ngày bắt đầu dự kiến (cho Gantt/Calendar); phải trước hoặc bằng deadline */
  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  startDate?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'Deadline không hợp lệ' })
  deadline?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  estimatedHours?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  actualHours?: number | null;
}
