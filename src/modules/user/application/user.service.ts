import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { Result } from '@core/domain/result';
import { User } from '@core/domain/user.entity';
import { USER_REPOSITORY } from '../domain/user.repository';
import type { UserRepository } from '../domain/user.repository';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly prisma: PrismaService,
  ) {}

  public async getMe(jwt: {
    sub: string;
    email: string;
    roleType: 'SUPER_ADMIN' | 'USER';
  }): Promise<
    Result<{
      id: string;
      email: string;
      type: 'SUPER_ADMIN' | 'USER';
      firstName?: string;
      lastName?: string;
      roles?: string[];
      permissions: string[];
    }>
  > {
    if (jwt.roleType === 'SUPER_ADMIN') {
      const record = await this.prisma.superAdmin.findUnique({
        where: { id: jwt.sub },
      });
      if (!record) {
        return Result.fail('Super admin not found');
      }
      return Result.ok({
        id: record.id,
        email: record.email,
        type: 'SUPER_ADMIN',
        permissions: ['*'],
      });
    }

    const record = await this.prisma.user.findUnique({
      where: { id: jwt.sub },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });
    if (!record) {
      return Result.fail('User not found');
    }

    return Result.ok({
      id: record.id,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      type: 'USER',
      roles: record.roles.map((ur: { role: { name: string } }) => ur.role.name),
      permissions: [
        ...new Set(
          record.roles.flatMap(
            (ur: {
              role: {
                permissions: Array<{ permission: { code: string } }>;
              };
            }) =>
              ur.role.permissions.map(
                (rp: { permission: { code: string } }) => rp.permission.code,
              ),
          ),
        ),
      ],
    });
  }

  public async getProfile(userId: string): Promise<
    Result<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      ci: string;
      phone: string | null;
    }>
  > {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return Result.fail('User not found');
    }
    return Result.ok({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      ci: user.ci,
      phone: user.phone,
    });
  }

  public async updateProfile(
    userId: string,
    params: { firstName?: string; lastName?: string; phone?: string },
  ): Promise<
    Result<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      ci: string;
      phone: string | null;
    }>
  > {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return Result.fail('User not found');
    }

    const updated = new User(
      {
        email: user.email,
        password: user.password,
        firstName: params.firstName ?? user.firstName,
        lastName: params.lastName ?? user.lastName,
        ci: user.ci,
        phone: params.phone !== undefined ? params.phone : user.phone,
      },
      user.id,
    );

    await this.userRepository.update(updated);

    return Result.ok({
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      ci: updated.ci,
      phone: updated.phone,
    });
  }

  public async createUser(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    ci: string;
    phone?: string;
  }): Promise<
    Result<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    }>
  > {
    const [existingEmail, existingCi] = await Promise.all([
      this.userRepository.findByEmail(params.email),
      this.userRepository.findByCi(params.ci),
    ]);

    if (existingEmail) {
      return Result.fail('Email already in use');
    }
    if (existingCi) {
      return Result.fail('CI already in use');
    }

    const salt = randomBytes(16).toString('hex');
    const hashed = scryptSync(params.password, salt, 64).toString('hex');

    const user = new User({
      email: params.email,
      password: `${salt}:${hashed}`,
      firstName: params.firstName,
      lastName: params.lastName,
      ci: params.ci,
      phone: params.phone ?? null,
    });

    await this.userRepository.save(user);

    return Result.ok({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  }

  public async softDelete(userId: string): Promise<Result<void>> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return Result.fail('User not found');
    }

    await this.userRepository.softDelete(userId);

    return Result.ok(undefined);
  }
}
