import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { emptyToNull, trimString } from '../../common/utils/transforms';

export class CreateSprintDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Tên sprint không được để trống' })
  @MaxLength(120)
  name: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000)
  goal?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  startDate?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  endDate?: string | null;
}

export class UpdateSprintDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000)
  goal?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;
}

export class CompleteSprintDto {
  /** Việc chưa xong: 'backlog' (mặc định) hoặc id của một sprint chưa kết thúc để chuyển sang */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  moveIncompleteTo?: number | null;
}

export class BacklogQueryDto {
  /** Gồm cả việc đã xong chưa thuộc sprint nào */
  @IsOptional()
  @IsIn(['true', 'false'])
  includeDone?: string;
}

export class VelocityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit?: number = 8;
}

export class MoveToSprintDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  taskIds: number[];
}
