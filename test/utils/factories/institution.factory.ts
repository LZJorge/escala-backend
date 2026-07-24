import { Institution } from '@modules/institution/domain/institution.entity';

export function buildInstitutionProps(
  overrides?: Partial<{
    name: string;
    contactEmail: string | null;
    websiteUrl: string | null;
    logoUrl: string | null;
  }>,
): {
  name: string;
  contactEmail: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
} {
  return {
    name: 'Test University',
    contactEmail: 'contact@test.edu',
    websiteUrl: null,
    logoUrl: null,
    ...overrides,
  };
}

export function buildInstitution(
  overrides?: Partial<{
    name: string;
    contactEmail: string | null;
    websiteUrl: string | null;
    logoUrl: string | null;
  }>,
  id?: string,
): Institution {
  return new Institution(
    buildInstitutionProps(overrides),
    id ?? 'test-inst-id',
  );
}
