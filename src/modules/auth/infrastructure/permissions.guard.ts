import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { REQUIRED_PERMISSIONS_KEY } from './decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from './authenticated-request';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';

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

    const roles = await this.prisma.adminRole.findMany({
      where: { adminProfile: { userId: user.sub } },
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
    for (const ar of roles) {
      for (const rp of ar.role.permissions) {
        userPermissionCodes.add(rp.permission.code);
      }
    }

    const expandedRequired = required.flatMap((p: string) => {
      const dot = p.lastIndexOf('.');
      const module = p.slice(0, dot);
      const action = p.slice(dot + 1);
      return action === 'read' ? [p] : [p, `${module}.read`];
    });

    const hasAll = expandedRequired.every((p: string) =>
      userPermissionCodes.has(p),
    );
    if (!hasAll) {
      throw new DomainException(
        ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS,
        'Insufficient permissions',
        { required },
      );
    }

    return true;
  }
}
