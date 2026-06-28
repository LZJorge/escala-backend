import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import {
  AuthRepository,
  InstitutionMembership,
} from '../domain/auth.repository';
import { User } from '@core/domain/user.entity';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findByEmail(
    email: string,
    institutionId?: string,
  ): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: institutionId !== undefined ? { email, institutionId } : { email },
    });
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
        institutionId: record.institutionId,
      },
      record.id,
    );
  }

  public async findInstitutionById(
    id: string,
    userId?: string,
  ): Promise<InstitutionMembership | null> {
    const record = await this.prisma.institution.findUnique({
      where: { id },
    });
    if (!record) {
      return null;
    }

    let institutionUserId: string | undefined;
    if (userId) {
      const iu = await this.prisma.institutionUser.findFirst({
        where: { userId, institutionId: id },
        select: { id: true },
      });
      institutionUserId = iu?.id;
    }

    return {
      id: record.id,
      institutionId: record.id,
      institutionName: record.name,
      institutionType: record.institutionType,
      institutionUserId,
    };
  }
}
