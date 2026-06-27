import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import type { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class MasterAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const institutionId: string | undefined = request.params.institutionId as
      | string
      | undefined;

    if (!institutionId) {
      throw new ForbiddenException('Institution ID required');
    }

    const membership = await this.prisma.institutionUser.findFirst({
      where: {
        userId: request.user.sub,
        institutionId,
        isActive: true,
        roles: {
          some: {
            role: { isMaster: true },
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Master admin access required');
    }

    return true;
  }
}
