import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-request';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user.roleType !== 'SUPER_ADMIN') {
      throw new DomainException(
        ErrorCodes.SEC_AUTH_SUPER_ADMIN_REQUIRED,
        'Super admin access required',
      );
    }

    return true;
  }
}
