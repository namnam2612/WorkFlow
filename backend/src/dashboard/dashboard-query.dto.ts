import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import { toBoolean } from '../common/utils/transforms';

export class DashboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  /** Chỉ tính công việc được giao cho tôi (member luôn bị ép bật) */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mine?: boolean;
}
