import { User } from '@core/domain/user.entity';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface SuperAdminRecord {
  id: string;
  email: string;
  password: string;
  mustChangePassword: boolean;
}

export interface AuthUserWithProfiles {
  user: User;
  profiles: Array<'ADMIN' | 'STUDENT'>;
  adminRoles: string[];
  studentProfileId: string | null;
  adminProfileId: string | null;
}

export interface AuthRepository {
  findByEmail(email: string): Promise<AuthUserWithProfiles | null>;
  findSuperAdminByEmail(email: string): Promise<SuperAdminRecord | null>;
  findSuperAdminById(id: string): Promise<SuperAdminRecord | null>;
  changeSuperAdminPassword(id: string, password: string): Promise<void>;
}
