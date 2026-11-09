import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { emptyToNull, trimString } from '../../common/utils/transforms';

export class CreateReleaseDto {
  /** Số phiên bản dạng semver, ví dụ 1.1.0 hoặc v2.0.0-rc.1 */
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập số phiên bản' })
  @MaxLength(40)
  version: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(160)
  name?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(5000)
  description?: string | null;
}

export class UpdateReleaseDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(160)
  name?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(5000)
  description?: string | null;
}

export class PublishReleaseDto {
  /** Vẫn phát hành dù còn việc chưa xong trong phiên bản */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
