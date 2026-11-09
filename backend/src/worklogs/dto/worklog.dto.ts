import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { emptyToNull } from '../../common/utils/transforms';

export class CreateWorkLogDto {
  /** Thời gian làm, tính bằng phút (1 phút đến 24 giờ cho mỗi lần ghi) */
  @IsInt({ message: 'Thời gian phải là số phút nguyên' })
  @Min(1, { message: 'Thời gian tối thiểu 1 phút' })
  @Max(24 * 60, { message: 'Mỗi lần ghi tối đa 24 giờ' })
  minutes: number;

  /** Ngày làm việc YYYY-MM-DD (giờ VN); bỏ trống = hôm nay */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' })
  workedOn?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class TimesheetQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from phải có dạng YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to phải có dạng YYYY-MM-DD' })
  to?: string;
}

