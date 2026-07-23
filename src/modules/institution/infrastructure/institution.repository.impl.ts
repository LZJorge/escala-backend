import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { InstitutionRepository } from '../domain/institution.repository';
import { Institution } from '../domain/institution.entity';

@Injectable()
export class PrismaInstitutionRepository implements InstitutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async find(): Promise<Institution | null> {
    const record = await this.prisma.institution.findFirst();
    if (!record) {
      return null;
    }
    return new Institution(
      {
        name: record.name,
        contactEmail: record.contactEmail,
        websiteUrl: record.websiteUrl,
        logoUrl: record.logoUrl,
      },
      record.id,
    );
  }

  public async update(institution: Institution): Promise<void> {
    await this.prisma.institution.update({
      where: { id: institution.id },
      data: {
        name: institution.name,
        contactEmail: institution.contactEmail,
        websiteUrl: institution.websiteUrl,
        logoUrl: institution.logoUrl,
      },
    });
  }
}
