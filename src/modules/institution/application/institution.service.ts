import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@core/domain/result';
import { INSTITUTION_REPOSITORY } from '../domain/institution.repository';
import type { InstitutionRepository } from '../domain/institution.repository';
import { Institution } from '../domain/institution.entity';

@Injectable()
export class InstitutionService {
  constructor(
    @Inject(INSTITUTION_REPOSITORY)
    private readonly repository: InstitutionRepository,
  ) {}

  public async get(): Promise<
    Result<{
      id: string;
      name: string;
      contactEmail: string | null;
      websiteUrl: string | null;
      logoUrl: string | null;
    }>
  > {
    const institution = await this.repository.find();
    if (!institution) {
      return Result.fail('Institution not found');
    }
    return Result.ok({
      id: institution.id,
      name: institution.name,
      contactEmail: institution.contactEmail,
      websiteUrl: institution.websiteUrl,
      logoUrl: institution.logoUrl,
    });
  }

  public async update(params: {
    name?: string;
    contactEmail?: string;
    websiteUrl?: string;
    logoUrl?: string;
  }): Promise<
    Result<{
      id: string;
      name: string;
      contactEmail: string | null;
      websiteUrl: string | null;
      logoUrl: string | null;
    }>
  > {
    const institution = await this.repository.find();
    if (!institution) {
      return Result.fail('Institution not found');
    }

    const updated = new Institution(
      {
        name: params.name ?? institution.name,
        contactEmail: params.contactEmail ?? institution.contactEmail,
        websiteUrl: params.websiteUrl ?? institution.websiteUrl,
        logoUrl: params.logoUrl ?? institution.logoUrl,
      },
      institution.id,
    );

    await this.repository.update(updated);

    return Result.ok({
      id: updated.id,
      name: updated.name,
      contactEmail: updated.contactEmail,
      websiteUrl: updated.websiteUrl,
      logoUrl: updated.logoUrl,
    });
  }
}
