import { Institution } from './institution.entity';

export const INSTITUTION_REPOSITORY = Symbol('INSTITUTION_REPOSITORY');

export interface InstitutionRepository {
  findById(id: string): Promise<Institution | null>;
  findMany(): Promise<Institution[]>;
  save(institution: Institution): Promise<void>;
  update(institution: Institution): Promise<void>;
  delete(id: string): Promise<boolean>;
}
