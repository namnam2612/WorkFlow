import { Priority, TaskStatus } from '@prisma/client';
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
