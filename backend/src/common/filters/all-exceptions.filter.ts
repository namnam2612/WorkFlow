import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

const DEFAULT_MESSAGES_VI: Record<number, string> = {
  401: 'Bạn chưa đăng nhập hoặc phiên đã hết hạn',
  403: 'Bạn không có quyền thực hiện thao tác này',
  404: 'Không tìm thấy dữ liệu',
  413: 'Tệp tải lên quá lớn',
  429: 'Bạn thao tác quá nhanh, vui lòng thử lại sau',
};

/** Chuẩn hóa mọi lỗi về cùng một cấu trúc JSON */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message } = this.resolve(exception);
    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorBody = {
      statusCode,
      error: STATUS_TEXT[statusCode] ?? 'Error',
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(statusCode).json(body);
  }

  private resolve(exception: unknown): { statusCode: number; message: string | string[] } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      let message: string | string[] = exception.message;
      if (typeof res === 'object' && res !== null && 'message' in res) {
        const raw: unknown = res.message;
        if (typeof raw === 'string' || Array.isArray(raw)) message = raw;
      }
      const statusCode = exception.getStatus();
      const isGeneric = typeof message === 'string' && (message === STATUS_TEXT[statusCode] || /^(Forbidden resource|Unauthorized|Not Found|File too large|ThrottlerException.*)$/.test(message));
      if (isGeneric && DEFAULT_MESSAGES_VI[statusCode]) message = DEFAULT_MESSAGES_VI[statusCode];
      return { statusCode, message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return { statusCode: HttpStatus.CONFLICT, message: 'Dữ liệu đã tồn tại (trùng giá trị duy nhất)' };
        case 'P2025':
          return { statusCode: HttpStatus.NOT_FOUND, message: 'Không tìm thấy dữ liệu' };
        case 'P2003':
          return { statusCode: HttpStatus.CONFLICT, message: 'Dữ liệu đang được tham chiếu hoặc tham chiếu không hợp lệ' };
        default:
          break;
      }
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống, vui lòng thử lại sau' };
  }
}
