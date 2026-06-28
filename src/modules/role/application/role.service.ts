import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { Result } from '@core/domain/result';
import { Role } from '../domain/role.entity';

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  public async create(
    institutionId: string,
    params: { name: string; permissionCodes: string[] },
  ): Promise<
    Result<{
      id: string;
      name: string;
      permissionCodes: string[];
    }>
  > {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });
    if (!institution) {
      return Result.fail('Institution not found');
    }

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: params.permissionCodes } },
    });
    if (permissions.length !== params.permissionCodes.length) {
      return Result.fail('One or more permission codes are invalid');
    }

    const role = new Role({
      institutionId,
      name: params.name,
      isStudent: false,
      isMaster: false,
      isEditable: true,
    });

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.role.create({
        data: {
          id: role.id,
          institutionId: role.institutionId,
          name: role.name,
          isStudent: false,
          isMaster: false,
          isEditable: true,
        },
      });

      for (const perm of permissions) {
        await tx.rolePermission.create({
          data: { roleId: role.id, permissionId: perm.id },
        });
      }
    });

    const permsKey = `tenant:${institutionId}:role:${role.id}:permissions`;
    await this.redis.del(permsKey);
    if (params.permissionCodes.length > 0) {
      await this.redis.sadd(permsKey, ...params.permissionCodes);
      await this.redis.expire(permsKey, 3600);
    }

    return Result.ok({
      id: role.id,
      name: role.name,
      permissionCodes: params.permissionCodes,
    });
  }

  public async findAll(institutionId: string): Promise<
    Result<
      Array<{
        id: string;
        name: string;
        isStudent: boolean;
        isMaster: boolean;
        isEditable: boolean;
        permissionCodes: string[];
      }>
    >
  > {
    const roles = await this.prisma.role.findMany({
      where: { institutionId },
      include: { permissions: { include: { permission: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return Result.ok(
      roles.map(
        (r: {
          id: string;
          name: string;
          isStudent: boolean;
          isMaster: boolean;
          isEditable: boolean;
          permissions: Array<{ permission: { code: string } }>;
        }) => ({
          id: r.id,
          name: r.name,
          isStudent: r.isStudent,
          isMaster: r.isMaster,
          isEditable: r.isEditable,
          permissionCodes: r.permissions.map(
            (rp: { permission: { code: string } }) => rp.permission.code,
          ),
        }),
      ),
    );
  }

  public async findById(roleId: string): Promise<
    Result<{
      id: string;
      name: string;
      isStudent: boolean;
      isMaster: boolean;
      isEditable: boolean;
      permissionCodes: string[];
    }>
  > {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) {
      return Result.fail('Role not found');
    }

    return Result.ok({
      id: role.id,
      name: role.name,
      isStudent: role.isStudent,
      isMaster: role.isMaster,
      isEditable: role.isEditable,
      permissionCodes: role.permissions.map(
        (rp: { permission: { code: string } }) => rp.permission.code,
      ),
    });
  }

  public async update(
    roleId: string,
    params: { name?: string; permissionCodes?: string[] },
  ): Promise<
    Result<{
      id: string;
      name: string;
      permissionCodes: string[];
    }>
  > {
    const existing = await this.prisma.role.findUnique({
      where: { id: roleId },
    });
    if (!existing) {
      return Result.fail('Role not found');
    }
    if (!existing.isEditable) {
      return Result.fail('Built-in roles cannot be modified');
    }

    let permissionCodes = params.permissionCodes;
    if (permissionCodes !== undefined) {
      const permissions = await this.prisma.permission.findMany({
        where: { code: { in: permissionCodes } },
      });
      if (permissions.length !== permissionCodes.length) {
        return Result.fail('One or more permission codes are invalid');
      }
    } else {
      const current = await this.prisma.rolePermission.findMany({
        where: { roleId },
        include: { permission: true },
      });
      permissionCodes = current.map(
        (rp: { permission: { code: string } }) => rp.permission.code,
      );
    }

    const permissionsChanged =
      params.permissionCodes !== undefined &&
      JSON.stringify(params.permissionCodes.sort()) !==
        JSON.stringify(permissionCodes.sort());

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (params.name) {
        await tx.role.update({
          where: { id: roleId },
          data: { name: params.name },
        });
      }

      if (params.permissionCodes) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        const permissions = await tx.permission.findMany({
          where: { code: { in: params.permissionCodes } },
        });
        for (const perm of permissions) {
          await tx.rolePermission.create({
            data: { roleId, permissionId: perm.id },
          });
        }
      }
    });

    if (permissionsChanged && existing.institutionId) {
      await this.redis.del(
        `tenant:${existing.institutionId}:role:${roleId}:permissions`,
      );
    }

    return Result.ok({
      id: roleId,
      name: params.name ?? existing.name,
      permissionCodes,
    });
  }

  public async delete(roleId: string): Promise<Result<void>> {
    const existing = await this.prisma.role.findUnique({
      where: { id: roleId },
    });
    if (!existing) {
      return Result.fail('Role not found');
    }
    if (!existing.isEditable) {
      return Result.fail('Built-in roles cannot be deleted');
    }

    await this.prisma.role.delete({ where: { id: roleId } });

    if (existing.institutionId) {
      await this.redis.del(
        `tenant:${existing.institutionId}:role:${roleId}:permissions`,
      );
    }

    return Result.ok(undefined);
  }

  public async assignRole(
    institutionUserId: string,
    roleId: string,
  ): Promise<Result<void>> {
    const [iu, role] = await Promise.all([
      this.prisma.institutionUser.findUnique({
        where: { id: institutionUserId },
      }),
      this.prisma.role.findUnique({ where: { id: roleId } }),
    ]);

    if (!iu) {
      return Result.fail('Institution user not found');
    }
    if (!role) {
      return Result.fail('Role not found');
    }
    if (role.institutionId !== iu.institutionId) {
      return Result.fail('Role does not belong to the same institution');
    }

    const exists = await this.prisma.institutionUserRole.findUnique({
      where: { institutionUserId_roleId: { institutionUserId, roleId } },
    });
    if (exists) {
      return Result.fail('User already has this role');
    }

    await this.prisma.institutionUserRole.create({
      data: { institutionUserId, roleId },
    });

    await this.invalidateUserCache(iu.userId, iu.institutionId);

    return Result.ok(undefined);
  }

  public async unassignRole(
    institutionUserId: string,
    roleId: string,
  ): Promise<Result<void>> {
    const iu = await this.prisma.institutionUser.findUnique({
      where: { id: institutionUserId },
    });
    if (!iu) {
      return Result.fail('Institution user not found');
    }

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (role?.isMaster) {
      const masterCount = await this.prisma.institutionUserRole.count({
        where: {
          role: { isMaster: true, institutionId: iu.institutionId },
          institutionUserId: { not: institutionUserId },
        },
      });
      if (masterCount === 0) {
        return Result.fail(
          'Cannot remove the last master role from the institution',
        );
      }
    }

    await this.prisma.institutionUserRole.delete({
      where: { institutionUserId_roleId: { institutionUserId, roleId } },
    });

    await this.invalidateUserCache(iu.userId, iu.institutionId);

    return Result.ok(undefined);
  }

  private async invalidateUserCache(
    userId: string,
    institutionId: string,
  ): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.del(`user:${userId}:tenant:${institutionId}:master`);
    pipeline.del(`user:${userId}:tenant:${institutionId}:roles`);
    await pipeline.exec();
  }
}
