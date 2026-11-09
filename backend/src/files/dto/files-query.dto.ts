import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { toBoolean, trimString } from '../../common/utils/transforms';

export const FOLDER_SORT_FIELDS = ['name', 'updatedAt'] as const;
export const FILE_SORT_FIELDS = ['name', 'updatedAt', 'size'] as const;

/** Duyệt thư mục (dự án, task): mặc định theo tên A→Z, 20 mục/trang */
export class FolderQueryDto extends PaginationQueryDto {
  /** Lọc theo tên thư mục (tên dự án / tiêu đề task) */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  /** name = theo tên; updatedAt = file mới nhất trước (thư mục chưa có file xếp cuối) */
  @IsOptional()
  @IsIn(FOLDER_SORT_FIELDS)
  sortBy: (typeof FOLDER_SORT_FIELDS)[number] = 'name';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';

  /** Cấp 2: true = hiện cả task chưa có file */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeEmpty?: boolean;
}

/** Danh sách file trong một thư mục: mặc định mới gửi trước */
export class FileListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(FILE_SORT_FIELDS)
  sortBy: (typeof FILE_SORT_FIELDS)[number] = 'updatedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}

/** Tìm file theo tên trên toàn kho */
export class FileSearchQueryDto extends PaginationQueryDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập từ khóa tìm kiếm' })
  @MaxLength(100)
  q: string;
}
