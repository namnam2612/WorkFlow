import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { toBoolean, trimString } from '../../common/utils/transforms';

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}
