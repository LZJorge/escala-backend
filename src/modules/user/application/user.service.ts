import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { Result } from '@core/domain/result';
import { Page } from '@core/domain/page';
import { User } from '@core/domain/user.entity';
import { USER_REPOSITORY } from '../domain/user.repository';
import type {
  UserListFilter,
  UserRepository,
  UserListItem,
} from '../domain/user.repository';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly prisma: PrismaService,
  ) {}

  public async findAllUsers(params: {
    page: number;
    pageSize: number;
    filter: UserListFilter;
  }): Promise<Result<Page<UserListItem>>> {
    const [users, total] = await Promise.all([
      this.userRepository.findAll({
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        ...params.filter,
      }),
      this.userRepository.count(params.filter),
    ]);
    return Result.ok({
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.ceil(total / params.pageSize),
      },
      data: users,
    });
  }

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
      profiles?: Array<'ADMIN' | 'STUDENT'>;
      studentProfileId?: string | null;
      adminProfileId?: string | null;
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
        studentProfile: true,
        adminProfile: {
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
        },
      },
    });
    if (!record) {
      return Result.fail('User not found');
    }

    const roles = record.adminProfile?.roles ?? [];
    return Result.ok({
      id: record.id,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      type: 'USER',
      profiles: [
        ...(record.adminProfile ? (['ADMIN'] as const) : []),
        ...(record.studentProfile ? (['STUDENT'] as const) : []),
      ],
      studentProfileId: record.studentProfile?.id ?? null,
      adminProfileId: record.adminProfile?.id ?? null,
      roles: roles.map((ar: { role: { name: string } }) => ar.role.name),
      permissions: [
        ...new Set(
          roles.flatMap(
            (ar: {
              role: {
                permissions: Array<{ permission: { code: string } }>;
              };
            }) =>
              ar.role.permissions.map(
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
    profiles: Array<'ADMIN' | 'STUDENT'>;
  }): Promise<
    Result<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      profiles: Array<'ADMIN' | 'STUDENT'>;
      roles: string[];
      studentProfileId: string | null;
      adminProfileId: string | null;
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

    let studentProfileId: string | null = null;
    let adminProfileId: string | null = null;

    if (params.profiles.includes('ADMIN')) {
      const adminProfile = await this.prisma.adminProfile.create({
        data: { userId: user.id },
      });
      adminProfileId = adminProfile.id;
    }

    if (params.profiles.includes('STUDENT')) {
      const studentProfile = await this.prisma.studentProfile.create({
        data: { userId: user.id },
      });
      studentProfileId = studentProfile.id;
    }

    return Result.ok({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profiles: [
        ...(adminProfileId ? (['ADMIN'] as const) : []),
        ...(studentProfileId ? (['STUDENT'] as const) : []),
      ],
      roles: [],
      studentProfileId,
      adminProfileId,
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
