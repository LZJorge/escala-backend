import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import type { Prisma } from '@prisma/client';
import { User } from '@core/domain/user.entity';
import {
  UserRepository,
  UserListItem,
  UserListFilter,
} from '../domain/user.repository';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findAll(
    params: { skip: number; take: number } & UserListFilter,
  ): Promise<UserListItem[]> {
    type UserWithProfiles = {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      ci: string;
      phone: string | null;
      isActive: boolean;
      adminProfile: {
        roles: Array<{ role: { name: string } }>;
      } | null;
      studentProfile: {
        id: string;
        enrollmentYear: number | null;
        enrollmentMonth: number | null;
        programId: string | null;
      } | null;
    };

    const records = await this.prisma.user.findMany({
      where: this.buildWhere(params),
      include: {
        adminProfile: {
          include: { roles: { include: { role: true } } },
        },
        studentProfile: true,
      },
      orderBy: { createdAt: 'asc' },
      skip: params.skip,
      take: params.take,
    });

    return records.map((r: UserWithProfiles) => ({
      id: r.id,
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      ci: r.ci,
      phone: r.phone,
      isActive: r.isActive,
      profiles: [
        ...(r.adminProfile ? (['ADMIN'] as const) : []),
        ...(r.studentProfile ? (['STUDENT'] as const) : []),
      ],
      roles:
        r.adminProfile?.roles.map(
          (ar: { role: { name: string } }) => ar.role.name,
        ) ?? [],
      enrollmentYear: r.studentProfile?.enrollmentYear ?? null,
      enrollmentMonth: r.studentProfile?.enrollmentMonth ?? null,
      programId: r.studentProfile?.programId ?? null,
    }));
  }

  public async count(filter?: UserListFilter): Promise<number> {
    return this.prisma.user.count({
      where: filter ? this.buildWhere(filter) : undefined,
    });
  }

  private buildWhere(filter: UserListFilter): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (filter.q) {
      where.OR = [
        { email: { contains: filter.q, mode: 'insensitive' } },
        { firstName: { contains: filter.q, mode: 'insensitive' } },
        { lastName: { contains: filter.q, mode: 'insensitive' } },
        { ci: { contains: filter.q, mode: 'insensitive' } },
      ];
    }

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    const relations: Prisma.UserWhereInput[] = [];
    if (filter.profile === 'ADMIN') {
      relations.push({ adminProfile: { isNot: null } });
    } else if (filter.profile === 'STUDENT') {
      relations.push({ studentProfile: { isNot: null } });
    } else if (filter.profile === 'NONE') {
      relations.push({
        adminProfile: { is: null },
        studentProfile: { is: null },
      });
    }
    if (filter.roleId) {
      relations.push({
        adminProfile: { roles: { some: { roleId: filter.roleId } } },
      });
    }
    if (filter.enrollmentYear !== undefined) {
      relations.push({
        studentProfile: { enrollmentYear: filter.enrollmentYear },
      });
    }
    if (filter.programId) {
      relations.push({
        studentProfile: {
          OR: [
            { programId: filter.programId },
            {
              enrollments: {
                some: {
                  section: {
                    course: { programId: filter.programId },
                  },
                },
              },
            },
          ],
        },
      });
    }
    if (filter.academicStatus) {
      relations.push({
        studentProfile: {
          enrollments: { some: { status: filter.academicStatus } },
        },
      });
    }
    if (relations.length > 0) {
      where.AND = relations;
    }

    if (filter.createdFrom || filter.createdTo) {
      where.createdAt = {};
      if (filter.createdFrom) {
        where.createdAt.gte = filter.createdFrom;
      }
      if (filter.createdTo) {
        where.createdAt.lte = filter.createdTo;
      }
    }

    return where;
  }

  public async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    if (!record) {
      return null;
    }
    return new User(
      {
        email: record.email,
        password: record.password,
        firstName: record.firstName,
        lastName: record.lastName,
        ci: record.ci,
        phone: record.phone,
      },
      record.id,
    );
  }

  public async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    if (!record) {
      return null;
    }
    return new User(
      {
        email: record.email,
        password: record.password,
        firstName: record.firstName,
        lastName: record.lastName,
        ci: record.ci,
        phone: record.phone,
      },
      record.id,
    );
  }

  public async findByCi(ci: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { ci } });
    if (!record) {
      return null;
    }
    return new User(
      {
        email: record.email,
        password: record.password,
        firstName: record.firstName,
        lastName: record.lastName,
        ci: record.ci,
        phone: record.phone,
      },
      record.id,
    );
  }

  public async save(user: User): Promise<void> {
    await this.prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        password: user.password,
        firstName: user.firstName,
        lastName: user.lastName,
        ci: user.ci,
        phone: user.phone,
      },
    });
  }

  public async update(user: User): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
    });
  }

  public async softDelete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }
}
