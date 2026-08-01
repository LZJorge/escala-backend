import { User } from '@core/domain/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserListFilter {
  q?: string;
  profile?: 'ADMIN' | 'STUDENT' | 'NONE';
  isActive?: boolean;
  roleId?: string;
  enrollmentYear?: number;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  ci: string;
  phone: string | null;
  isActive: boolean;
  profiles: Array<'ADMIN' | 'STUDENT'>;
  roles: string[];
}

export interface UserRepository {
  findAll(
    params: { skip: number; take: number } & UserListFilter,
  ): Promise<UserListItem[]>;
  count(filter?: UserListFilter): Promise<number>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByCi(ci: string): Promise<User | null>;
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  softDelete(id: string): Promise<void>;
}
