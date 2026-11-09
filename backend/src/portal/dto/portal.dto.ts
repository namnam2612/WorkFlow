import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { trimString } from '../../common/utils/transforms';

export class CreateGuestLinkDto {
  /** Tên gợi nhớ, ví dụ tên khách hàng */
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Hãy đặt tên cho liên kết' })
  @MaxLength(120)
  name: string;

  /** Hết hạn sau bao nhiêu ngày; bỏ trống = không hết hạn */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
