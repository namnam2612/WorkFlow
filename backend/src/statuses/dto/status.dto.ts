import { StatusCategory, StatusScope } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../common/utils/transforms';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class CreateStatusDto {
  @IsEnum(StatusScope, { message: 'Bộ trạng thái không hợp lệ' })
  scope: StatusScope;

  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Tên trạng thái không được để trống' })
  @MaxLength(40)
  name: string;

  @Matches(HEX_COLOR, { message: 'Màu phải dạng #rrggbb' })
  color: string;

  @IsEnum(StatusCategory, { message: 'Nhóm trạng thái không hợp lệ' })
  category: StatusCategory;
}

export class UpdateStatusDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Tên trạng thái không được để trống' })
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'Màu phải dạng #rrggbb' })
  color?: string;

  @IsOptional()
  @IsEnum(StatusCategory, { message: 'Nhóm trạng thái không hợp lệ' })
  category?: StatusCategory;
}

export class ReorderStatusesDto {
  @IsEnum(StatusScope)
  scope: StatusScope;

  /** Toàn bộ id của bộ trạng thái theo thứ tự mới */
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsInt({ each: true })
  ids: number[];
}

export class ListStatusesQueryDto {
  @IsOptional()
  @IsEnum(StatusScope)
  scope?: StatusScope;
}

export class DeleteStatusQueryDto {
  /** Chuyển các công việc đang ở trạng thái bị xóa sang trạng thái này (bắt buộc nếu còn công việc) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  moveTo?: number;
}
