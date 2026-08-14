import { Term } from './term.entity';

export const TERM_REPOSITORY = Symbol('TERM_REPOSITORY');

export interface TermRepository {
  create(term: Term): Promise<Term>;
  findAll(status?: string, programId?: string): Promise<Term[]>;
  findById(id: string): Promise<Term | null>;
  findActive(programId?: string): Promise<Term | null>;
  update(term: Term): Promise<Term>;
  softDelete(id: string): Promise<void>;
  countSections(termId: string): Promise<number>;
}
