import {
  ExceptionFilter as NestExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';
import type { ErrorResponse } from './envelope-response.type';

const FALLBACK_CODE: Record<number, string> = {
  400: ErrorCodes.ERR_VALIDATION_FAILED,
  401: ErrorCodes.SEC_AUTH_TOKEN_MISSING,
  403: ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS,
  404: ErrorCodes.ERR_RESOURCE_NOT_FOUND,
  409: ErrorCodes.ERR_CONFLICT,
  422: ErrorCodes.ERR_VALIDATION_FAILED,
  429: 'ERR_RATE_LIMITED',
  500: ErrorCodes.SYS_INTERNAL_ERROR,
  502: 'SYS_BAD_GATEWAY',
  503: 'SYS_SERVICE_UNAVAILABLE',
};

@Catch()
export class ExceptionFilter implements NestExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let statusCode: number;
    let errorCode: string;
    let message: string;
    let details: Record<string, unknown> | string[] | undefined;

    if (exception instanceof DomainException) {
      statusCode = exception.getStatus();
      errorCode = exception.errorCode;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      errorCode = FALLBACK_CODE[statusCode] ?? ErrorCodes.SYS_INTERNAL_ERROR;
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const body = exceptionResponse as Record<string, unknown>;
        if (typeof body.message === 'string') {
          message = body.message;
        } else if (Array.isArray(body.message)) {
          message = (body.message as string[]).join(', ');
          details = body.message as string[];
        } else {
          message = 'Internal server error';
        }
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = ErrorCodes.SYS_INTERNAL_ERROR;
      message = 'Internal server error';
    }

    const body: ErrorResponse = {
      statusCode,
      errorCode,
      message,
      ...(details !== undefined ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(body);
  }
}
