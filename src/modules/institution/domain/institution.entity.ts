import { Entity } from '@core/domain/entity.base';

export interface InstitutionProps {
  name: string;
  contactEmail: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
}

export class Institution extends Entity<InstitutionProps> {
  public get name(): string {
    return this.props.name;
  }

  public get contactEmail(): string | null {
    return this.props.contactEmail;
  }

  public get websiteUrl(): string | null {
    return this.props.websiteUrl;
  }

  public get logoUrl(): string | null {
    return this.props.logoUrl;
  }
}
