import { Institution } from './institution.entity';

export const INSTITUTION_REPOSITORY = Symbol('INSTITUTION_REPOSITORY');

export interface InstitutionRepository {
  find(): Promise<Institution | null>;
  update(institution: Institution): Promise<void>;
}
