import { User } from '@core/domain/user.entity';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface InstitutionMembership {
  id: string;
  institutionId: string;
  institutionName: string;
  institutionType: string;
}

export interface AuthRepository {
  findByEmail(email: string): Promise<User | null>;
  findUserInstitutions(userId: string): Promise<InstitutionMembership[]>;
}
