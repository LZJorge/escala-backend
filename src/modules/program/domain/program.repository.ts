import { Program } from './program.entity';

export const PROGRAM_REPOSITORY = Symbol('PROGRAM_REPOSITORY');

export interface PensumCoursePrereq {
  requiredCourseId: string | null;
  requiredCredits: number | null;
}

export interface PensumCourse {
  id: string;
  code: string;
  name: string;
  credits: number;
  termLevel: number;
  prerequisites: PensumCoursePrereq[];
}

export interface PensumData {
  id: string;
  name: string;
  termType: string;
  totalCredits: number;
  updatedAt: Date;
  courses: PensumCourse[];
}

export interface ProgramSummaryData {
  id: string;
  name: string;
  termType: string;
  totalCredits: number;
  allocatedCredits: number;
  courseCount: number;
  totalTermLevels: number;
  prerequisiteChainsCount: number;
  sectionCount: number;
  studentCount: number;
  dropoutCount: number;
  activeTeachersCount: number;
  totalCapacity: number;
  availableSpots: number;
  historicalTranscriptsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgramRepository {
  create(program: Program): Promise<Program>;
  findAll(): Promise<Program[]>;
  findById(id: string): Promise<Program | null>;
  update(program: Program): Promise<Program>;
  softDelete(id: string): Promise<void>;
  getPensum(id: string): Promise<PensumData | null>;
  getSummary(id: string): Promise<ProgramSummaryData | null>;
}
