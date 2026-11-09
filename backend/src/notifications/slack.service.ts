import { Injectable, Logger } from '@nestjs/common';

/** Chỉ nhận Incoming Webhook chính thức của Slack, tránh bị lợi dụng gọi tới địa chỉ nội bộ (SSRF) */
export const SLACK_WEBHOOK_PATTERN = /^https:\/\/hooks\.slack\.com\/(services|workflows|triggers)\/[A-Za-z0-9/_-]{8,}$/;

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  /** Đăng một tin vào kênh; không bao giờ ném lỗi. Trả về true nếu Slack nhận (HTTP 2xx) */
  async post(webhookUrl: string, text: string): Promise<boolean> {
    if (!SLACK_WEBHOOK_PATTERN.test(webhookUrl)) {
      this.logger.warn('Bỏ qua Slack webhook không hợp lệ');
      return false;
    }
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) this.logger.warn(`Slack trả về HTTP ${response.status}`);
      return response.ok;
    } catch (error) {
      this.logger.warn(`Gửi Slack thất bại: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
