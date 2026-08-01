import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PROFILES_KEY } from './decorators/require-profile.decorator';
import { REQUIRED_ADMIN_ROLES_KEY } from './decorators/require-admin-role.decorator';
import type { AuthenticatedRequest } from './authenticated-request';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';

@Injectable()
export class ProfilesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredProfiles = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PROFILES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredAdminRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ADMIN_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredProfiles?.length && !requiredAdminRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (user.roleType === 'SUPER_ADMIN') {
      return true;
    }

    const userProfiles = user.profiles ?? [];
    if (
      requiredProfiles?.length &&
      !requiredProfiles.some((p: string) =>
        userProfiles.includes(p as 'ADMIN' | 'STUDENT'),
      )
    ) {
      throw new DomainException(
        ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS,
        'Insufficient profile',
        { required: requiredProfiles },
      );
    }

    const userAdminRoles = user.adminRoles ?? [];
    if (
      requiredAdminRoles?.length &&
      !requiredAdminRoles.some((r: string) => userAdminRoles.includes(r))
    ) {
      throw new DomainException(
        ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS,
        'Insufficient admin role',
        { required: requiredAdminRoles },
      );
    }

    return true;
  }
}
