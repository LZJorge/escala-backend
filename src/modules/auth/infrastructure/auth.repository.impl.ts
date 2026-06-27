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
  ): Promise<InstitutionMembership | null> {
    const record = await this.prisma.institution.findUnique({
      where: { id },
    });
    if (!record) {
      return null;
    }
    return {
      id: record.id,
      institutionId: record.id,
      institutionName: record.name,
      institutionType: record.institutionType,
    };
  }
}
