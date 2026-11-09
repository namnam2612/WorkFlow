import { Transform, Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { trimString } from '../../common/utils/transforms';
import { FILE_CATEGORIES, FileCategory } from '../file-types';

export const ATTACHMENT_SORT_FIELDS = ['createdAt', 'name', 'size'] as const;

export class ListAttachmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId?: number;

  /** Lọc theo người gửi */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  uploaderId?: number;

  @IsOptional()
  @IsIn(FILE_CATEGORIES, { message: 'Loại file không hợp lệ' })
  type?: FileCategory;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Ngày bắt đầu không hợp lệ' })
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Ngày kết thúc không hợp lệ' })
  to?: Date;

  @IsOptional()
  @IsIn(ATTACHMENT_SORT_FIELDS)
  sortBy: (typeof ATTACHMENT_SORT_FIELDS)[number] = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
