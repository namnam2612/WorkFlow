import { IsInt, Min } from 'class-validator';

export class MoveTaskDto {
  /** Trạng thái đích (cột), phải thuộc cùng dự án và đúng bộ trạng thái của công việc */
  @IsInt({ message: 'Trạng thái không hợp lệ' })
  statusId: number;

  /** Vị trí (bắt đầu từ 0) trong cột đích */
  @IsInt()
  @Min(0)
  position: number;
}
