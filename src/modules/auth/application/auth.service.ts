import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { Result } from '@core/domain/result';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { AUTH_REPOSITORY } from '../domain/auth.repository';
import type {
  AuthRepository,
  InstitutionMembership,
} from '../domain/auth.repository';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  public async login(params: {
    email: string;
    password: string;
    institutionId?: string;
  }): Promise<
    Result<{
      accessToken: string;
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        isSuperAdmin: boolean;
      };
      institution: InstitutionMembership | null;
    }>
  > {
    if (!params.email || !params.password) {
      return Result.fail('Email and password are required');
    }

    const user = await this.authRepository.findByEmail(params.email);
    if (!user) {
      return Result.fail('Invalid email or password');
    }

    if (!user.isSuperAdmin) {
      if (!params.institutionId) {
        return Result.fail('Institution ID is required');
      }
      if (user.institutionId !== params.institutionId) {
        return Result.fail('Invalid email or password');
      }
    }

    const [salt, storedHash] = user.passwordHash.split(':');
    const hashBuf = scryptSync(params.password, salt, 64);
    const storedBuf = Buffer.from(storedHash, 'hex');

    if (
      hashBuf.length !== storedBuf.length ||
      !timingSafeEqual(hashBuf, storedBuf)
    ) {
      return Result.fail('Invalid email or password');
    }

    const institution =
      user.institutionId !== null
        ? await this.authRepository.findInstitutionById(
            user.institutionId,
            user.id,
          )
        : null;

    const jwtPayload: Record<string, unknown> = {
      sub: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
    };

    if (institution) {
      jwtPayload.institutionId = institution.institutionId;
      if (institution.institutionUserId) {
        jwtPayload.institutionUserId = institution.institutionUserId;
      }
    }

    const accessToken = this.jwtService.sign(jwtPayload);

    if (institution && institution.institutionUserId) {
      await this.warmCache(user.id, institution.institutionId);
    }

    return Result.ok({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin,
      },
      institution,
    });
  }

  private async warmCache(
    userId: string,
    institutionId: string,
  ): Promise<void> {
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
      return;
    }

    const isMaster = membership.roles.some(
      (r: { role: { isMaster: boolean } }) => r.role.isMaster,
    );
    const roleIds: string[] = [];
    const permsByRole: Map<string, string[]> = new Map();

    for (const iur of membership.roles) {
      roleIds.push(iur.roleId);
      const codes = iur.role.permissions.map(
        (rp: { permission: { code: string } }) => rp.permission.code,
      );
      permsByRole.set(iur.roleId, codes);
    }

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
  }
}
