import { Program } from '@modules/program/domain/program.entity';
import type { TermType } from '@prisma/client';

export function buildProgramProps(
  overrides?: Partial<{
    name: string;
    termType: TermType;
    totalCredits: number;
  }>,
): {
  name: string;
  termType: TermType;
  totalCredits: number;
} {
  return {
    name: 'Computer Science',
    termType: 'SEMESTER',
    totalCredits: 160,
    ...overrides,
  };
}

export function buildProgram(
  overrides?: Partial<{
    name: string;
    termType: TermType;
    totalCredits: number;
  }>,
  id?: string,
): Program {
  return new Program(buildProgramProps(overrides), id ?? 'test-prog-id');
}
