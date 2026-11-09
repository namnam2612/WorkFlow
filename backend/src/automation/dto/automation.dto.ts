import { AutomationTrigger } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../common/utils/transforms';

export class CreateAutomationDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Tên quy tắc không được để trống' })
  @MaxLength(120)
  name: string;

  @IsEnum(AutomationTrigger, { message: 'Sự kiện kích hoạt không hợp lệ' })
  trigger: AutomationTrigger;

  /** { statusId?, type?, priority? } — kiểm tra chi tiết trong service */
  @IsOptional()
  @IsObject({ message: 'Điều kiện phải là một đối tượng' })
  conditions?: unknown;

  /** Danh sách hành động — kiểm tra chi tiết trong service */
  @IsArray({ message: 'Hành động phải là một danh sách' })
  actions: unknown;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateAutomationDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(AutomationTrigger)
  trigger?: AutomationTrigger;

  @IsOptional()
  @IsObject()
  conditions?: unknown;

  @IsOptional()
  @IsArray()
  actions?: unknown;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
