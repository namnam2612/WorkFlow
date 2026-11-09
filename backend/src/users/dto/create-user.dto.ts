import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../common/utils/transforms';

export class CreateUserDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Tên không được để trống' })
  @MaxLength(120)
  name: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(190)
  email: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(128)
  password: string;

  @IsEnum(Role, { message: 'Vai trò không hợp lệ' })
  role: Role;
}
