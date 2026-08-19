import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError, EntityNotFoundError, TypeORMError } from 'typeorm';
import { ValidationError } from 'class-validator';
import { sanitizeForLog } from '@/common/utils/sanitize';
import { flattenValidationErrors, ValidationDetail } from '@/common/utils/validation-details';

type ExceptionInfo = {
  status: number;
  message: string;
  error?: string;
  details?: ValidationDetail[];
};

/**
 * Filter toàn cục: chuẩn hóa lỗi theo hợp đồng API và không lộ secret/stack ra client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /**
   * Bắt exception, ghi log đã sanitize và trả JSON đúng shape.
   *
   * @param exception Lỗi bất kỳ.
   * @param host HTTP context.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { method, url } = request;
    const user = (request as Request & { user?: { id?: number } }).user;
    const { status, message, error, details } = this.getExceptionInfo(exception);

    this.logError(exception, {
      method,
      url,
      body: request.body,
      userId: user?.id,
      userAgent: request.get('User-Agent') || '',
      ip: request.ip || 'unknown',
      status,
      message,
    });

    response
      .status(status)
      .json(this.createErrorResponse(status, message, error, request, details));
  }

  /**
   * Phân loại exception thành status/message/details theo spec.
   */
  private getExceptionInfo(exception: unknown): ExceptionInfo {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return { status, message: exceptionResponse };
      }

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        const details = this.extractDetailsFromExceptionResponse(responseObj);
        const rawMessage = responseObj.message;
        const message = Array.isArray(rawMessage)
          ? 'Validation failed'
          : typeof rawMessage === 'string'
            ? rawMessage
            : exception.message;

        return {
          status,
          message,
          error: typeof responseObj.error === 'string' ? responseObj.error : undefined,
          details,
        };
      }

      return { status, message: exception.message };
    }

    if (exception instanceof QueryFailedError) {
      return this.handleDatabaseError(exception as QueryFailedError<Error>);
    }

    if (exception instanceof EntityNotFoundError) {
      return {
        status: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
        error: 'Not Found',
      };
    }

    if (exception instanceof TypeORMError) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'Internal Server Error',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }

  /**
   * Giữ chi tiết field từ ValidationPipe/class-validator.
   */
  private extractDetailsFromExceptionResponse(
    responseObj: Record<string, unknown>,
  ): ValidationDetail[] | undefined {
    if (Array.isArray(responseObj.details)) {
      return responseObj.details as ValidationDetail[];
    }

    if (Array.isArray(responseObj.message) && this.isValidationErrorArray(responseObj.message)) {
      return flattenValidationErrors(responseObj.message as ValidationError[]);
    }

    if (
      Array.isArray(responseObj.message) &&
      responseObj.message.every((item) => typeof item === 'string')
    ) {
      return responseObj.message.map((message) => ({
        field: this.inferFieldFromMessage(message),
        message,
      }));
    }

    return undefined;
  }

  /**
   * Suy field từ message class-validator dạng "title should not be empty".
   */
  private inferFieldFromMessage(message: string): string {
    const [field] = message.split(' ');
    return field || 'unknown';
  }

  private isValidationErrorArray(value: unknown[]): boolean {
    return value.every((item) => typeof item === 'object' && item !== null && 'property' in item);
  }

  /**
   * Ánh xạ mã lỗi PostgreSQL sang 409/400/500.
   */
  private handleDatabaseError(exception: QueryFailedError<Error>): ExceptionInfo {
    const errorCode = (exception as QueryFailedError & { code?: string }).code;

    switch (errorCode) {
      case '23505':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Resource already exists',
          error: 'Conflict',
        };
      case '23503':
      case '23502':
      case '23514':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Request is invalid',
          error: 'Bad Request',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          error: 'Internal Server Error',
        };
    }
  }

  /**
   * Ghi log server-side; stack chỉ ở server, body đã sanitize đệ quy.
   */
  private logError(
    exception: unknown,
    context: {
      method: string;
      url: string;
      body: unknown;
      userId?: number;
      userAgent: string;
      ip: string;
      status: number;
      message: string;
    },
  ): void {
    const logPayload = sanitizeForLog({
      timestamp: new Date().toISOString(),
      method: context.method,
      url: context.url,
      status: context.status,
      message: context.message,
      userId: context.userId ?? 'anonymous',
      ip: context.ip,
      userAgent: context.userAgent,
      body: context.body,
    });

    const serialized = JSON.stringify(logPayload);
    if (context.status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(serialized, stack);
    } else {
      this.logger.warn(serialized);
    }
  }

  /**
   * Tạo response lỗi đúng hợp đồng; không trả stack/SQL/secret.
   */
  private createErrorResponse(
    status: number,
    message: string,
    error: string | undefined,
    request: Request,
    details?: ValidationDetail[],
  ): Record<string, unknown> {
    const response: Record<string, unknown> = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (error) {
      response.error = error;
    }

    if (details?.length) {
      response.details = details;
    }

    const requestId = request.headers['x-request-id'];
    if (typeof requestId === 'string' && requestId.length > 0) {
      response.requestId = requestId;
    }

    return response;
  }
}
