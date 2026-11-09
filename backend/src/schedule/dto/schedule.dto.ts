import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Matches } from 'class-validator';
import { toBoolean } from '../../common/utils/transforms';

export class CalendarQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from phải có dạng YYYY-MM-DD' })
  from: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to phải có dạng YYYY-MM-DD' })
  to: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  /** Chỉ việc giao cho tôi */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mine?: boolean;
}
