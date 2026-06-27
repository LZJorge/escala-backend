import {
  ExceptionFilter as NestExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';

@Catch()
export class ExceptionFilter implements NestExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : typeof (exceptionResponse as Record<string, unknown>).message ===
            'string'
          ? ((exceptionResponse as Record<string, unknown>).message as string)
          : Array.isArray(
                (exceptionResponse as Record<string, unknown>).message,
              )
            ? (
                (exceptionResponse as Record<string, unknown>)
                  .message as string[]
              ).join(', ')
            : 'Internal server error';

    const errorLabel =
      typeof exceptionResponse === 'object' &&
      (exceptionResponse as Record<string, unknown>).error
        ? ((exceptionResponse as Record<string, unknown>).error as string)
        : undefined;

    response.status(status).json({
      statusCode: status,
      message,
      ...(errorLabel ? { error: errorLabel } : {}),
      timestamp: new Date().toISOString(),
      path: request.path,
    });
  }
}
