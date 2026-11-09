import { TaskStatus } from '@prisma/client';
import { IsEnum, IsInt, Min } from 'class-validator';

export class MoveTaskDto {
  @IsEnum(TaskStatus, { message: 'Trạng thái không hợp lệ' })
  status: TaskStatus;

  /** Vị trí (bắt đầu từ 0) trong cột đích */
  @IsInt()
  @Min(0)
  position: number;
}
