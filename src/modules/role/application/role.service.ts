import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { Result } from '@core/domain/result';
import { Role } from '../domain/role.entity';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  public async create(params: {
    name: string;
    permissionCodes: string[];
  }): Promise<
    Result<{
      id: string;
      name: string;
      permissionCodes: string[];
    }>
  > {
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: params.permissionCodes } },
    });
    if (permissions.length !== params.permissionCodes.length) {
      return Result.fail('One or more permission codes are invalid');
    }

    const role = new Role({
      name: params.name,
      isStudent: false,
      isEditable: true,
    });

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.role.create({
        data: {
          id: role.id,
          name: role.name,
          isStudent: false,
          isEditable: true,
        },
      });

      for (const perm of permissions) {
        await tx.rolePermission.create({
          data: { roleId: role.id, permissionId: perm.id },
        });
      }
    });

    return Result.ok({
      id: role.id,
      name: role.name,
      permissionCodes: params.permissionCodes,
    });
  }

  public async findAll(): Promise<
    Result<
      Array<{
        id: string;
        name: string;
        isStudent: boolean;
        isEditable: boolean;
        permissionCodes: string[];
      }>
    >
  > {
    const roles = await this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return Result.ok(
      roles.map(
        (r: {
          id: string;
          name: string;
          isStudent: boolean;
          isEditable: boolean;
          permissions: Array<{ permission: { code: string } }>;
        }) => ({
          id: r.id,
          name: r.name,
          isStudent: r.isStudent,
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

    return Result.ok(undefined);
  }

  // ponytail: assignRole/unassignedRole — legacy, needs user module migration
  public async assignRole(
    userId: string,
    roleId: string,
  ): Promise<Result<void>> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });
    if (!role) {
      return Result.fail('Role not found');
    }

    const exists = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (exists) {
      return Result.fail('User already has this role');
    }

    await this.prisma.userRole.create({
      data: { userId, roleId },
    });

    return Result.ok(undefined);
  }

  public async unassignRole(
    userId: string,
    roleId: string,
  ): Promise<Result<void>> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });
    if (!role) {
      return Result.fail('Role not found');
    }

    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });

    return Result.ok(undefined);
  }
}
