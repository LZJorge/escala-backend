import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user.roleType !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }

    return true;
  }
}
