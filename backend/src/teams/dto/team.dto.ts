import { Specialty } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { emptyToNull, trimString } from '../../common/utils/transforms';

export class CreateTeamDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Tên nhóm không được để trống' })
  @MaxLength(120)
  name: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  /** Chỉ admin được chỉ định trưởng nhóm khác; mặc định là người tạo */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leaderId?: number;
}

export class UpdateTeamDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leaderId?: number;
}

export class AddTeamMemberDto {
  @Type(() => Number)
  @IsInt()
  userId: number;

  @IsOptional()
  @IsEnum(Specialty, { message: 'Chuyên môn không hợp lệ' })
  specialty?: Specialty;
}

export class UpdateTeamMemberDto {
  @IsEnum(Specialty, { message: 'Chuyên môn không hợp lệ' })
  specialty: Specialty;
}
