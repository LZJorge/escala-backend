import { User } from './user.entity';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface AuthRepository {
  findByEmail(email: string): Promise<User | null>;
  findByCi(ci: string): Promise<User | null>;
  create(user: User): Promise<void>;
}
