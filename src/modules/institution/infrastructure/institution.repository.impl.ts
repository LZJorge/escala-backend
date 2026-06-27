import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { InstitutionRepository } from '../domain/institution.repository';
import { Institution } from '../domain/institution.entity';

import type { Institution as PrismaInstitution } from '@prisma/client';

@Injectable()
export class PrismaInstitutionRepository implements InstitutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findById(id: string): Promise<Institution | null> {
    const record = await this.prisma.institution.findUnique({ where: { id } });
    if (!record) {
      return null;
    }
    return new Institution(
      {
        name: record.name,
        slug: record.slug,
        institutionType: record.institutionType,
        contactEmail: record.contactEmail,
        websiteUrl: record.websiteUrl,
        logoUrl: record.logoUrl,
        isVerified: record.isVerified,
      },
      record.id,
    );
  }

  public async findMany(): Promise<Institution[]> {
    const records = await this.prisma.institution.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return records.map(
      (r: PrismaInstitution) =>
        new Institution(
          {
            name: r.name,
            slug: r.slug,
            institutionType: r.institutionType,
            contactEmail: r.contactEmail,
            websiteUrl: r.websiteUrl,
            logoUrl: r.logoUrl,
            isVerified: r.isVerified,
          },
          r.id,
        ),
    );
  }

  public async save(institution: Institution): Promise<void> {
    await this.prisma.institution.create({
      data: {
        id: institution.id,
        name: institution.name,
        slug: institution.slug,
        institutionType: institution.institutionType,
        contactEmail: institution.contactEmail,
        websiteUrl: institution.websiteUrl,
        logoUrl: institution.logoUrl,
        isVerified: institution.isVerified,
      },
    });
  }

  public async update(institution: Institution): Promise<void> {
    await this.prisma.institution.update({
      where: { id: institution.id },
      data: {
        name: institution.name,
        slug: institution.slug,
        institutionType: institution.institutionType,
        contactEmail: institution.contactEmail,
        websiteUrl: institution.websiteUrl,
        logoUrl: institution.logoUrl,
        isVerified: institution.isVerified,
      },
    });
  }

  public async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.institution.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
