import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Gửi email qua SMTP cấu hình bằng biến môi trường; không có SMTP_HOST thì kênh email tắt (không lỗi) */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST'));
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const user = this.config.get<string>('SMTP_USER');
      this.transporter = createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port: this.config.get<number>('SMTP_PORT') ?? 587,
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: user ? { user, pass: this.config.get<string>('SMTP_PASS') } : undefined,
        connectionTimeout: 8000,
        socketTimeout: 10000,
      });
    }
    return this.transporter;
  }

  /** Không bao giờ ném lỗi: gửi mail thất bại không được làm hỏng thao tác của người dùng */
  async send(message: MailMessage): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      await this.getTransporter().sendMail({ from: this.config.get<string>('MAIL_FROM') ?? this.config.get<string>('SMTP_USER'), ...message });
      return true;
    } catch (error) {
      this.logger.warn(`Gửi email tới ${message.to} thất bại: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
