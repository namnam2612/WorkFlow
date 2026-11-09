import { Priority } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional } from 'class-validator';
import { toNumberList } from '../../common/utils/transforms';

export class BoardQueryDto {
  @Type(() => Number)
  @IsInt()
  projectId: number;

  @IsOptional()
  @Transform(toNumberList)
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true, message: 'Mã người được giao không hợp lệ' })
  assigneeIds?: number[];

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
