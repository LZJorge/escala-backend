import { User } from '@core/domain/user.entity';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface SuperAdminRecord {
  id: string;
  email: string;
  password: string;
}

export interface AuthRepository {
  findByEmail(email: string): Promise<User | null>;
  findSuperAdminByEmail(email: string): Promise<SuperAdminRecord | null>;
}
