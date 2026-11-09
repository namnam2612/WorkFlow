import { Priority } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';

export class BoardQueryDto {
  @Type(() => Number)
  @IsInt()
  projectId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeId?: number;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
