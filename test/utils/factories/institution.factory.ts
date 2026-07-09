import { Institution } from '@modules/institution/domain/institution.entity';

export function buildInstitutionProps(
  overrides?: Partial<{
    name: string;
    slug: string;
    institutionType: string;
    contactEmail: string;
    websiteUrl: string | null;
    logoUrl: string | null;
    isVerified: boolean;
  }>,
): {
  name: string;
  slug: string;
  institutionType: string;
  contactEmail: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  isVerified: boolean;
} {
  return {
    name: 'Test University',
    slug: 'test-university',
    institutionType: 'UNIVERSITY',
    contactEmail: 'contact@test.edu',
    websiteUrl: null,
    logoUrl: null,
    isVerified: false,
    ...overrides,
  };
}

export function buildInstitution(
  overrides?: Partial<{
    name: string;
    slug: string;
    institutionType: string;
    contactEmail: string;
    websiteUrl: string | null;
    logoUrl: string | null;
    isVerified: boolean;
  }>,
  id?: string,
): Institution {
  return new Institution(
    buildInstitutionProps(overrides),
    id ?? 'test-inst-id',
  );
}
