import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodes } from './error-codes';

const STATUS_MAP: Record<string, HttpStatus> = {
  [ErrorCodes.SEC_AUTH_TOKEN_MISSING]: HttpStatus.UNAUTHORIZED,
  [ErrorCodes.SEC_AUTH_TOKEN_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [ErrorCodes.SEC_AUTH_INVALID_CREDENTIALS]: HttpStatus.UNAUTHORIZED,
  [ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS]: HttpStatus.FORBIDDEN,
  [ErrorCodes.SEC_AUTH_SUPER_ADMIN_REQUIRED]: HttpStatus.FORBIDDEN,
  [ErrorCodes.ERR_ROLE_BUILT_IN]: HttpStatus.FORBIDDEN,
  [ErrorCodes.ERR_TERM_ALREADY_ACTIVE]: HttpStatus.CONFLICT,
  [ErrorCodes.ERR_SECTION_SCHEDULE_CONFLICT]: HttpStatus.CONFLICT,
  [ErrorCodes.ERR_SECTION_DELETE_FAILED]: HttpStatus.CONFLICT,
  [ErrorCodes.ERR_USER_EMAIL_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCodes.ERR_USER_CI_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCodes.ERR_CONFLICT]: HttpStatus.CONFLICT,
  [ErrorCodes.ERR_VALIDATION_FAILED]: HttpStatus.BAD_REQUEST,
  [ErrorCodes.SYS_INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
};

function resolveStatus(errorCode: string): HttpStatus {
  const mapped = STATUS_MAP[errorCode];
  if (mapped) {
    return mapped;
  }
  if (errorCode.endsWith('_NOT_FOUND')) {
    return HttpStatus.NOT_FOUND;
  }
  return HttpStatus.UNPROCESSABLE_ENTITY;
}

export class DomainException extends HttpException {
  public readonly errorCode: string;

  public readonly details?: Record<string, unknown>;

  public constructor(
    errorCode: string,
    message: string,
    details?: Record<string, unknown>,
    statusCode?: HttpStatus,
  ) {
    super(
      { errorCode, message, details },
      statusCode ?? resolveStatus(errorCode),
    );
    this.errorCode = errorCode;
    this.details = details;
  }
}
