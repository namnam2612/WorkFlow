import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  /** 'false' để tắt đăng ký công khai (mặc định bật) */
  @IsOptional()
  @IsIn(['true', 'false'])
  ALLOW_REGISTRATION?: string;

  /** Số reverse proxy phía trước API (0 = không có) */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY?: number;

  /** Thư mục lưu file đính kèm (mặc định ./uploads) */
  @IsOptional()
  @IsString()
  UPLOAD_DIR?: string;

  /** Dung lượng tối đa mỗi file đính kèm, đơn vị byte (mặc định 20971520 = 20MB) */
  @IsOptional()
  @IsInt()
  @Min(1024)
  @Max(1024 * 1024 * 1024)
  MAX_UPLOAD_SIZE?: number;

  @IsString()
  @MinLength(1)
  DATABASE_URL: string;

  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET phải có ít nhất 32 ký tự' })
  JWT_ACCESS_SECRET: string;

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET phải có ít nhất 32 ký tự' })
  JWT_REFRESH_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRES_IN?: string;

  /** Gửi email thông báo: cần SMTP_HOST; để trống = tắt kênh email */
  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT?: number;

  /** 'true' = TLS ngay khi kết nối (thường cổng 465) */
  @IsOptional()
  @IsIn(['true', 'false'])
  SMTP_SECURE?: string;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  /** Người gửi, ví dụ: "TaskFlow <no-reply@congty.vn>" */
  @IsOptional()
  @IsString()
  MAIL_FROM?: string;

  /** Địa chỉ web của ứng dụng, dùng để tạo link trong email/Slack (ví dụ https://alpha.hopphu.vn) */
  @IsOptional()
  @IsString()
  APP_URL?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('; ');
    throw new Error(`Cấu hình môi trường không hợp lệ: ${details}`);
  }
  return validated;
}
