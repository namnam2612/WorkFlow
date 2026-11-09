import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../common/utils/transforms';

export class UpdateUserDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Tên không được để trống' })
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'Ảnh đại diện phải là URL http(s)' })
  @MaxLength(500)
  avatarUrl?: string | null;

  /** Chỉ admin */
  @IsOptional()
  @IsEnum(Role, { message: 'Vai trò không hợp lệ' })
  role?: Role;

  /** Chỉ admin */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Chỉ admin: đặt lại mật khẩu */
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(128)
  password?: string;
}
