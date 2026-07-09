import { User } from '@core/domain/user.entity';

export function buildUserProps(
  overrides?: Partial<{
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    ci: string;
    phone: string | null;
    isSuperAdmin: boolean;
    institutionId: string | null;
  }>,
): {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  ci: string;
  phone: string | null;
  isSuperAdmin: boolean;
  institutionId: string | null;
} {
  return {
    email: 'user@example.com',
    passwordHash: 'salt:hash',
    firstName: 'Test',
    lastName: 'User',
    ci: '12345678',
    phone: null,
    isSuperAdmin: false,
    institutionId: null,
    ...overrides,
  };
}

export function buildUser(
  overrides?: Partial<{
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    ci: string;
    phone: string | null;
    isSuperAdmin: boolean;
    institutionId: string | null;
  }>,
  id?: string,
): User {
  return new User(buildUserProps(overrides), id ?? 'test-user-id');
}

export function buildPrismaUserRecord(
  overrides?: Partial<{
    id: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    ci: string;
    phone: string | null;
    isSuperAdmin: boolean;
    institutionId: string | null;
  }>,
): {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  ci: string;
  phone: string | null;
  isSuperAdmin: boolean;
  institutionId: string | null;
} {
  return {
    id: 'test-user-id',
    email: 'user@example.com',
    passwordHash: 'salt:hash',
    firstName: 'Test',
    lastName: 'User',
    ci: '12345678',
    phone: null,
    isSuperAdmin: false,
    institutionId: null,
    ...overrides,
  };
}
