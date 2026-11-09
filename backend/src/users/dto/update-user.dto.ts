import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';
import { emptyToNull, trimString } from '../../common/utils/transforms';

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

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  jobTitle?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(/^\+?[0-9][0-9 ().-]{5,18}$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string | null;

  /** Email liên hệ hiển thị cho đồng đội (có thể khác email đăng nhập, ví dụ Gmail cá nhân) */
  @IsOptional()
  @Transform(emptyToNull)
  @IsEmail({}, { message: 'Email liên hệ không hợp lệ' })
  @MaxLength(190)
  contactEmail?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500, { message: 'Giới thiệu tối đa 500 ký tự' })
  bio?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, host_whitelist: ['github.com', 'www.github.com'] }, { message: 'Link GitHub phải thuộc github.com' })
  @MaxLength(255)
  githubUrl?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, host_whitelist: ['linkedin.com', 'www.linkedin.com'] }, { message: 'Link LinkedIn phải thuộc linkedin.com' })
  @MaxLength(255)
  linkedinUrl?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, host_whitelist: ['facebook.com', 'www.facebook.com', 'fb.com', 'www.fb.com'] },
    { message: 'Link Facebook phải thuộc facebook.com' },
  )
  @MaxLength(255)
  facebookUrl?: string | null;

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
