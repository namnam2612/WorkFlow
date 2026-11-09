import { LeaveStatus, LeaveType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { emptyToNull } from '../../common/utils/transforms';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateLeaveDto {
  @Matches(DATE, { message: 'Ngày bắt đầu phải có dạng YYYY-MM-DD' })
  startDate: string;

  @Matches(DATE, { message: 'Ngày kết thúc phải có dạng YYYY-MM-DD' })
  endDate: string;

  @IsOptional()
  @IsEnum(LeaveType, { message: 'Loại nghỉ không hợp lệ' })
  type?: LeaveType;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class ReviewLeaveDto {
  @IsBoolean()
  approve: boolean;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class ListLeavesQueryDto {
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;

  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;
}

export class CapacityQueryDto {
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;
}
