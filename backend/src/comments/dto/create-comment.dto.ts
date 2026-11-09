import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../common/utils/transforms';

export class CreateCommentDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Nội dung bình luận không được để trống' })
  @MaxLength(5000, { message: 'Bình luận tối đa 5000 ký tự' })
  content: string;
}
