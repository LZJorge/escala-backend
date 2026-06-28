import { User } from '@core/domain/user.entity';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface InstitutionMembership {
  id: string;
  institutionId: string;
  institutionName: string;
  institutionType: string;
  institutionUserId?: string;
}

export interface AuthRepository {
  findByEmail(email: string, institutionId?: string): Promise<User | null>;
  findInstitutionById(
    id: string,
    userId?: string,
  ): Promise<InstitutionMembership | null>;
}
