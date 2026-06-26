import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import type { InstitutionUser } from '@prisma/client';
import {
  AuthRepository,
  InstitutionMembership,
} from '../domain/auth.repository';
import { User } from '@core/domain/user.entity';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    if (!record) {
      return null;
    }
    return new User(
      {
        email: record.email,
        passwordHash: record.passwordHash,
        firstName: record.firstName,
        lastName: record.lastName,
        ci: record.ci,
        phone: record.phone,
        isSuperAdmin: record.isSuperAdmin,
      },
      record.id,
    );
  }

  public async findUserInstitutions(
    userId: string,
  ): Promise<InstitutionMembership[]> {
    const records = await this.prisma.institutionUser.findMany({
      where: { userId, isActive: true },
      include: { institution: true },
    });
    return records.map(
      (
        r: InstitutionUser & {
          institution: { name: string; institutionType: string };
        },
      ) => ({
        id: r.id,
        institutionId: r.institutionId,
        institutionName: r.institution.name,
        institutionType: r.institution.institutionType,
      }),
    );
  }
}
