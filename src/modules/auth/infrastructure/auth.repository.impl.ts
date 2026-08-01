import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import {
  AuthRepository,
  AuthUserWithProfiles,
  SuperAdminRecord,
} from '../domain/auth.repository';
import { User } from '@core/domain/user.entity';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findByEmail(
    email: string,
  ): Promise<AuthUserWithProfiles | null> {
    const record = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      include: {
        studentProfile: true,
        adminProfile: {
          include: {
            roles: { include: { role: true } },
          },
        },
      },
    });
    if (!record) {
      return null;
    }
    return {
      user: new User(
        {
          email: record.email,
          password: record.password,
          firstName: record.firstName,
          lastName: record.lastName,
          ci: record.ci,
          phone: record.phone,
        },
        record.id,
      ),
      profiles: [
        ...(record.adminProfile ? (['ADMIN'] as const) : []),
        ...(record.studentProfile ? (['STUDENT'] as const) : []),
      ],
      adminRoles:
        record.adminProfile?.roles.map(
          (r: { role: { name: string } }) => r.role.name,
        ) ?? [],
      studentProfileId: record.studentProfile?.id ?? null,
      adminProfileId: record.adminProfile?.id ?? null,
    };
  }

  public async findSuperAdminByEmail(
    email: string,
  ): Promise<SuperAdminRecord | null> {
    const record = await this.prisma.superAdmin.findUnique({
      where: { email },
    });
    if (!record) {
      return null;
    }
    return {
      id: record.id,
      email: record.email,
      mustChangePassword: record.mustChangePassword,
      password: record.password,
    };
  }

  public async findSuperAdminById(
    id: string,
  ): Promise<SuperAdminRecord | null> {
    const record = await this.prisma.superAdmin.findUnique({
      where: { id },
    });
    if (!record) {
      return null;
    }
    return {
      id: record.id,
      email: record.email,
      mustChangePassword: record.mustChangePassword,
      password: record.password,
    };
  }

  public async changeSuperAdminPassword(
    id: string,
    password: string,
  ): Promise<void> {
    await this.prisma.superAdmin.update({
      where: { id },
      data: {
        password,
        mustChangePassword: false,
      },
    });
  }
}
