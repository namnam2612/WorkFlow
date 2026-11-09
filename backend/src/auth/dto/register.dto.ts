import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../common/utils/transforms';

/** Đăng ký công khai: KHÔNG có trường role — tài khoản mới luôn là member */
export class RegisterDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập họ tên' })
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
}
