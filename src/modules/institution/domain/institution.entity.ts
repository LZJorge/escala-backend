import { Entity } from '@core/domain/entity.base';
import type { InstitutionType } from '@prisma/client';

export interface InstitutionProps {
  name: string;
  institutionType: InstitutionType;
  contactEmail: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  isVerified: boolean;
}

export class Institution extends Entity<InstitutionProps> {
  public get name(): string {
    return this.props.name;
  }

  public get institutionType(): InstitutionType {
    return this.props.institutionType;
  }

  public get contactEmail(): string {
    return this.props.contactEmail;
  }

  public get websiteUrl(): string | null {
    return this.props.websiteUrl;
  }

  public get logoUrl(): string | null {
    return this.props.logoUrl;
  }

  public get isVerified(): boolean {
    return this.props.isVerified;
  }
}
