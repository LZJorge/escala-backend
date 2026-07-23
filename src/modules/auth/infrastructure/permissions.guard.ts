import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { REQUIRED_PERMISSIONS_KEY } from './decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (user.roleType === 'SUPER_ADMIN') {
      return true;
    }

    const roles = await this.prisma.userRole.findMany({
      where: { userId: user.sub },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const userPermissionCodes = new Set<string>();
    for (const ur of roles) {
      for (const rp of ur.role.permissions) {
        userPermissionCodes.add(rp.permission.code);
      }
    }

    const hasAll = required.every((p: string) => userPermissionCodes.has(p));
    if (!hasAll) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
