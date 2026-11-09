import { ArrayUnique, IsArray, IsDateString, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { trimString } from '../../common/utils/transforms';

export class CreateProjectDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Tên dự án không được để trống' })
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  startDate?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  endDate?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  memberIds?: number[];
}
