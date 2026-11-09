import { Priority, TaskStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
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

  @IsOptional()
  @IsInt()
  assigneeId?: number | null;

  @IsOptional()
  @IsEnum(TaskStatus, { message: 'Trạng thái không hợp lệ' })
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(Priority, { message: 'Mức ưu tiên không hợp lệ' })
  priority?: Priority;

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
