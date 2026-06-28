import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type InstitutionType } from '@prisma/client';
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

  private async resolveSlug(
    slug: string | undefined,
    name: string,
  ): Promise<string> {
    if (slug) {
      return slug;
    }

    let candidate = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let counter = 1;
    while (
      await this.prisma.institution.findUnique({ where: { slug: candidate } })
    ) {
      candidate = `${candidate}-${counter++}`;
    }

    return candidate;
  }

  public async create(params: {
    name: string;
    slug?: string;
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
      slug: string;
      institutionType: string;
      contactEmail: string;
    }>
  > {
    const slug = await this.resolveSlug(params.slug, params.name);
    const salt = randomBytes(16).toString('hex');
    const hashed = scryptSync(params.masterAdmin.password, salt, 64).toString(
      'hex',
    );

    let institutionId = '';

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      institutionId = randomUUID();
      const institution = await tx.institution.create({
        data: {
          id: institutionId,
          name: params.name,
          slug,
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
          institutionId: institution.id,
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
      slug,
      institutionType: params.institutionType,
      contactEmail: params.contactEmail,
    });
  }

  public async findAll(): Promise<
    Result<
      Array<{
        id: string;
        name: string;
        slug: string;
        institutionType: string;
      }>
    >
  > {
    const institutions = await this.repository.findMany();
    return Result.ok(
      institutions.map((i: Institution) => ({
        id: i.id,
        name: i.name,
        slug: i.slug,
        institutionType: i.institutionType,
      })),
    );
  }

  public async findById(id: string): Promise<
    Result<{
      id: string;
      name: string;
      slug: string;
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
      slug: institution.slug,
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
    const existingEmail = await this.prisma.user.findFirst({
      where: { email: params.email, institutionId },
    });
    if (existingEmail) {
      return Result.fail('Email already in use in this institution');
    }

    const existingCi = await this.prisma.user.findFirst({
      where: { ci: params.ci, institutionId },
    });
    if (existingCi) {
      return Result.fail('CI already in use in this institution');
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
      institutionId,
    });

    const iu = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
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
            institutionId,
          },
        });
        const institutionUser = await tx.institutionUser.create({
          data: { userId: user.id, institutionId },
        });

        const studentRole = await tx.role.findFirst({
          where: { institutionId, isStudent: true },
        });
        if (studentRole) {
          await tx.institutionUserRole.create({
            data: {
              institutionUserId: institutionUser.id,
              roleId: studentRole.id,
            },
          });
        }

        return institutionUser;
      },
    );

    return Result.ok({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      institutionUserId: iu.id,
    });
  }
}
