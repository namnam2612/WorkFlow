import { ArrayUnique, IsArray, IsDateString, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { emptyToNull, trimString } from '../../common/utils/transforms';
import { SLACK_WEBHOOK_PATTERN } from '../../notifications/slack.service';

export class CreateProjectDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Tên dự án không được để trống' })
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  startDate?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  endDate?: string | null;

  /** Incoming Webhook của Slack; null/rỗng = gỡ. Không bao giờ được trả lại qua API */
  @IsOptional()
  @Transform(emptyToNull)
  @Matches(SLACK_WEBHOOK_PATTERN, { message: 'Slack webhook phải có dạng https://hooks.slack.com/services/...' })
  @MaxLength(500)
  slackWebhookUrl?: string | null;

  /** Nhóm phụ trách dự án; null = không thuộc nhóm. Đặt nhóm thì mọi thành viên của nhóm được thêm vào dự án. */
  @IsOptional()
  @IsInt()
  teamId?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  memberIds?: number[];
}
