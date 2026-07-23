import { Program } from './program.entity';

export const PROGRAM_REPOSITORY = Symbol('PROGRAM_REPOSITORY');

export interface ProgramRepository {
  create(program: Program): Promise<Program>;
  findAll(institutionId: string): Promise<Program[]>;
  findById(id: string): Promise<Program | null>;
  update(program: Program): Promise<Program>;
  delete(id: string): Promise<boolean>;
}
