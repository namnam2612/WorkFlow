import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class AddDependencyDto {
  /** Công việc phải xong trước */
  @Type(() => Number)
  @IsInt()
  dependsOnId: number;
}
