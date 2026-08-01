import { User } from '@core/domain/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  ci: string;
  phone: string | null;
  isActive: boolean;
  roles: string[];
}

export interface UserRepository {
  findAll(params: { skip: number; take: number }): Promise<UserListItem[]>;
  count(): Promise<number>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByCi(ci: string): Promise<User | null>;
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  softDelete(id: string): Promise<void>;
}
