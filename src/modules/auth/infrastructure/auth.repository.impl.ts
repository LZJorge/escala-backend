import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { AuthRepository, SuperAdminRecord } from '../domain/auth.repository';
import { User } from '@core/domain/user.entity';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { email },
    });
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
