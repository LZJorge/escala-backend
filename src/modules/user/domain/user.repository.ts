import { User } from '@core/domain/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByCi(ci: string): Promise<User | null>;
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  softDelete(id: string): Promise<void>;
}
