import { Transform } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../common/utils/transforms';

/** Giới hạn nội dung một trang (ký tự) */
export const MAX_WIKI_CONTENT = 200_000;

export class CreateWikiPageDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Tiêu đề không được để trống' })
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_WIKI_CONTENT)
  content?: string;

  @IsOptional()
  @IsInt()
  parentId?: number | null;
}

export class UpdateWikiPageDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_WIKI_CONTENT)
  content?: string;

  @IsOptional()
  @IsInt()
  parentId?: number | null;

  /** `updatedAt` mà người sửa đã tải; nếu trang đã bị người khác sửa sau đó thì từ chối (409) để không ghi đè */
  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;
}
