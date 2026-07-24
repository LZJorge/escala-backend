import { User } from '@core/domain/user.entity';

export function buildUserProps(
  overrides?: Partial<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    ci: string;
    phone: string | null;
  }>,
): {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  ci: string;
  phone: string | null;
} {
  return {
    email: 'user@example.com',
    password:
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:3122d1dd0646fdad8330dbe454bcef4366840dd47b6fca5b8bd16ade0e69b46120b9fa7283d933c4218d1cdca8dfdda66e1040570fbd0ce0e9d9e5e748746dbe',
    firstName: 'Test',
    lastName: 'User',
    ci: '12345678',
    phone: null,
    ...overrides,
  };
}

export function buildUser(
  overrides?: Partial<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    ci: string;
    phone: string | null;
  }>,
  id?: string,
): User {
  return new User(buildUserProps(overrides), id ?? 'test-user-id');
}
