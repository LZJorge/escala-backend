import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { REQUIRED_PERMISSIONS_KEY } from './decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
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

    if (user.isSuperAdmin) {
      const allReadOnly = required.every(
        (p: string) => p.endsWith('.read') || p === 'transcript.export',
      );
      if (!allReadOnly) {
        throw new ForbiddenException(
          'Super admins are read-only on institution resources',
        );
      }
      return true;
    }

    const institutionId = this.resolveInstitutionId(request);
    if (!institutionId) {
      throw new ForbiddenException('Institution context required');
    }

    const permissions = await this.effectivePermissions(
      user.sub,
      institutionId,
    );

    const hasAll = required.every((p: string) => permissions.includes(p));
    if (!hasAll) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  private resolveInstitutionId(request: AuthenticatedRequest): string | null {
    return (
      (request.params.institutionId as string | undefined) ??
      ((request.user as Record<string, unknown>).institutionId as
        | string
        | undefined) ??
      null
    );
  }

  private async effectivePermissions(
    userId: string,
    institutionId: string,
  ): Promise<string[]> {
    const rolesKey = `user:${userId}:tenant:${institutionId}:roles`;
    const roleIds = await this.redis.smembers(rolesKey);

    if (roleIds.length === 0) {
      return this.loadAndCachePermissions(userId, institutionId);
    }

    const pipeline = this.redis.pipeline();
    for (const roleId of roleIds) {
      pipeline.smembers(`tenant:${institutionId}:role:${roleId}:permissions`);
    }
    const raw = await pipeline.exec();

    if (!raw) {
      return this.loadAndCachePermissions(userId, institutionId);
    }

    const results = raw as Array<[Error | null, unknown]>;

    const codes: string[] = [];
    const staleRoleIds: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const err = results[i][0];
      const members = results[i][1] as string[] | undefined;
      if (err || !members || members.length === 0) {
        staleRoleIds.push(roleIds[i]);
        continue;
      }
      for (const code of members) {
        if (!codes.includes(code)) {
          codes.push(code);
        }
      }
    }

    if (staleRoleIds.length > 0) {
      return this.loadAndCachePermissions(userId, institutionId);
    }

    return codes;
  }

  private async loadAndCachePermissions(
    userId: string,
    institutionId: string,
  ): Promise<string[]> {
    const membership = await this.prisma.institutionUser.findFirst({
      where: { userId, institutionId, isActive: true },
      select: {
        roles: {
          select: {
            roleId: true,
            role: {
              select: {
                isMaster: true,
                permissions: {
                  select: { permission: { select: { code: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return [];
    }

    const roleIds: string[] = [];
    const permsByRole: Map<string, string[]> = new Map();
    const allCodes: string[] = [];

    for (const iur of membership.roles) {
      roleIds.push(iur.roleId);
      const codes = iur.role.permissions.map(
        (rp: { permission: { code: string } }) => rp.permission.code,
      );
      permsByRole.set(iur.roleId, codes);
      for (const code of codes) {
        if (!allCodes.includes(code)) {
          allCodes.push(code);
        }
      }
    }

    const isMaster = membership.roles.some(
      (r: { role: { isMaster: boolean } }) => r.role.isMaster,
    );

    const pipeline = this.redis.pipeline();

    pipeline.set(
      `user:${userId}:tenant:${institutionId}:master`,
      isMaster ? '1' : '0',
      'EX',
      3600,
    );

    const rolesKey = `user:${userId}:tenant:${institutionId}:roles`;
    pipeline.del(rolesKey);
    if (roleIds.length > 0) {
      pipeline.sadd(rolesKey, ...roleIds);
      pipeline.expire(rolesKey, 3600);
    }

    for (const [roleId, codes] of permsByRole) {
      const permsKey = `tenant:${institutionId}:role:${roleId}:permissions`;
      pipeline.del(permsKey);
      if (codes.length > 0) {
        pipeline.sadd(permsKey, ...codes);
        pipeline.expire(permsKey, 3600);
      }
    }

    await pipeline.exec();
    return allCodes;
  }
}
