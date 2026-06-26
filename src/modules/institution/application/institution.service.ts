import { Inject, Injectable } from '@nestjs/common';
import type { InstitutionType, PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync, randomUUID } from 'node:crypto';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { Result } from '@core/domain/result';
import { User } from '@core/domain/user.entity';
import { INSTITUTION_REPOSITORY } from '../domain/institution.repository';
import type { InstitutionRepository } from '../domain/institution.repository';
import { Institution } from '../domain/institution.entity';

@Injectable()
export class InstitutionService {
  constructor(
    @Inject(INSTITUTION_REPOSITORY)
    private readonly repository: InstitutionRepository,
    private readonly prisma: PrismaService,
  ) {}

  public async create(params: {
    name: string;
    institutionType: string;
    contactEmail: string;
    websiteUrl?: string;
    logoUrl?: string;
    masterAdmin: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      ci: string;
    };
  }): Promise<
    Result<{
      id: string;
      name: string;
      institutionType: string;
      contactEmail: string;
    }>
  > {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: params.masterAdmin.email },
    });
    if (existingEmail) {
      return Result.fail('Master admin email already in use');
    }

    const existingCi = await this.prisma.user.findUnique({
      where: { ci: params.masterAdmin.ci },
    });
    if (existingCi) {
      return Result.fail('Master admin CI already in use');
    }

    const salt = randomBytes(16).toString('hex');
    const hashed = scryptSync(params.masterAdmin.password, salt, 64).toString(
      'hex',
    );

    let institutionId = '';

    await this.prisma.$transaction(async (tx: PrismaClient) => {
      institutionId = randomUUID();
      const institution = await tx.institution.create({
        data: {
          id: institutionId,
          name: params.name,
          institutionType: params.institutionType as InstitutionType,
          contactEmail: params.contactEmail,
          websiteUrl: params.websiteUrl ?? null,
          logoUrl: params.logoUrl ?? null,
          isVerified: false,
        },
      });

      const masterRole = await tx.role.create({
        data: {
          institutionId: institution.id,
          name: 'master',
          isMaster: true,
          isStudent: false,
          isEditable: false,
        },
      });

      await tx.role.create({
        data: {
          institutionId: institution.id,
          name: 'student',
          isMaster: false,
          isStudent: true,
          isEditable: false,
        },
      });

      const masterUser = await tx.user.create({
        data: {
          email: params.masterAdmin.email,
          passwordHash: `${salt}:${hashed}`,
          firstName: params.masterAdmin.firstName,
          lastName: params.masterAdmin.lastName,
          ci: params.masterAdmin.ci,
          isSuperAdmin: false,
        },
      });

      const iu = await tx.institutionUser.create({
        data: { userId: masterUser.id, institutionId: institution.id },
      });

      await tx.institutionUserRole.create({
        data: { institutionUserId: iu.id, roleId: masterRole.id },
      });
    });

    return Result.ok({
      id: institutionId,
      name: params.name,
      institutionType: params.institutionType,
      contactEmail: params.contactEmail,
    });
  }

  public async findAll(): Promise<
    Result<Array<{ id: string; name: string; institutionType: string }>>
  > {
    const institutions = await this.repository.findMany();
    return Result.ok(
      institutions.map((i: Institution) => ({
        id: i.id,
        name: i.name,
        institutionType: i.institutionType,
      })),
    );
  }

  public async findById(id: string): Promise<
    Result<{
      id: string;
      name: string;
      institutionType: string;
      contactEmail: string;
      websiteUrl: string | null;
      logoUrl: string | null;
      isVerified: boolean;
    }>
  > {
    const institution = await this.repository.findById(id);
    if (!institution) {
      return Result.fail('Institution not found');
    }
    return Result.ok({
      id: institution.id,
      name: institution.name,
      institutionType: institution.institutionType,
      contactEmail: institution.contactEmail,
      websiteUrl: institution.websiteUrl,
      logoUrl: institution.logoUrl,
      isVerified: institution.isVerified,
    });
  }

  public async createUser(
    institutionId: string,
    params: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      ci: string;
      phone?: string;
    },
  ): Promise<
    Result<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      institutionUserId: string;
    }>
  > {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: params.email },
    });
    if (existingEmail) {
      return Result.fail('Email already in use');
    }

    const existingCi = await this.prisma.user.findUnique({
      where: { ci: params.ci },
    });
    if (existingCi) {
      return Result.fail('CI already in use');
    }

    const salt = randomBytes(16).toString('hex');
    const hashed = scryptSync(params.password, salt, 64).toString('hex');

    const user = new User({
      email: params.email,
      passwordHash: `${salt}:${hashed}`,
      firstName: params.firstName,
      lastName: params.lastName,
      ci: params.ci,
      phone: params.phone ?? null,
      isSuperAdmin: false,
    });

    const iu = await this.prisma.$transaction(async (tx: PrismaClient) => {
      await tx.user.create({
        data: {
          id: user.id,
          email: user.email,
          passwordHash: user.passwordHash,
          firstName: user.firstName,
          lastName: user.lastName,
          ci: user.ci,
          phone: user.phone,
          isSuperAdmin: false,
        },
      });
      return tx.institutionUser.create({
        data: { userId: user.id, institutionId },
      });
    });

    return Result.ok({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      institutionUserId: iu.id,
    });
  }
}
