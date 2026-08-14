import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import type { AuthenticatedRequest } from '@modules/auth/infrastructure/authenticated-request';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';

@Injectable()
export class UserListGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (user.roleType === 'SUPER_ADMIN') {
      return true;
    }

    const query = request.query as {
      profile?: string;
      enrollmentYear?: string;
      programId?: string;
      academicStatus?: string;
    };
    const isStudentFilter =
      query.profile === 'STUDENT' ||
      query.enrollmentYear !== undefined ||
      query.programId !== undefined ||
      query.academicStatus !== undefined;
    const required = isStudentFilter ? 'student.read' : 'user.read';

    const roles = await this.prisma.adminRole.findMany({
      where: { adminProfile: { userId: user.sub } },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    type RoleWithPermissions = {
      role: { permissions: Array<{ permission: { code: string } }> };
    };
    const hasPermission = roles.some((ar: RoleWithPermissions) =>
      ar.role.permissions.some(
        (rp: { permission: { code: string } }) =>
          rp.permission.code === required,
      ),
    );
    if (!hasPermission) {
      throw new DomainException(
        ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS,
        'Insufficient permissions',
        { required },
      );
    }

    return true;
  }
}
