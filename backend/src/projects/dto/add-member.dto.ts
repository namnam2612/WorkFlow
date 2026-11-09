import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class AddMemberDto {
  @Type(() => Number)
  @IsInt()
  userId: number;
}
