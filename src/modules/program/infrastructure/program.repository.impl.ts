import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { ProgramRepository } from '../domain/program.repository';
import type {
  PensumData,
  PensumCourse,
  PensumCoursePrereq,
} from '../domain/program.repository';
import { Program } from '../domain/program.entity';

import type { Program as PrismaProgram } from '@prisma/client';

@Injectable()
export class PrismaProgramRepository implements ProgramRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async create(program: Program): Promise<Program> {
    const record = await this.prisma.program.create({
      data: {
        id: program.id,
        name: program.name,
        termType: program.termType,
        totalCredits: program.totalCredits,
      },
    });

    return this.toEntity(record);
  }

  public async findAll(): Promise<Program[]> {
    const records = await this.prisma.program.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r: PrismaProgram) => this.toEntity(r));
  }

  public async findById(id: string): Promise<Program | null> {
    const record = await this.prisma.program.findUnique({
      where: { id, deletedAt: null },
    });

    if (!record) {
      return null;
    }

    return this.toEntity(record);
  }

  public async update(program: Program): Promise<Program> {
    const record = await this.prisma.program.update({
      where: { id: program.id },
      data: {
        name: program.name,
        termType: program.termType,
        totalCredits: program.totalCredits,
      },
    });

    return this.toEntity(record);
  }

  public async softDelete(id: string): Promise<void> {
    await this.prisma.program.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  public async getPensum(id: string): Promise<PensumData | null> {
    const record = await this.prisma.program.findUnique({
      where: { id, deletedAt: null },
      include: {
        courses: {
          where: { deletedAt: null },
          orderBy: { termLevel: 'asc' },
          include: {
            prerequisites: true,
          },
        },
      },
    });

    if (!record) {
      return null;
    }

    const timestamps: Date[] = [record.updatedAt];

    const courses: PensumCourse[] = record.courses.map(
      (c: {
        id: string;
        code: string;
        name: string;
        credits: number;
        termLevel: number;
        updatedAt: Date;
        prerequisites: Array<{
          updatedAt: Date;
          requiredCourseId: string | null;
          requiredCredits: number | null;
        }>;
      }): PensumCourse => {
        timestamps.push(c.updatedAt);

        return {
          id: c.id,
          code: c.code,
          name: c.name,
          credits: c.credits,
          termLevel: c.termLevel,
          prerequisites: c.prerequisites.map(
            (p: {
              updatedAt: Date;
              requiredCourseId: string | null;
              requiredCredits: number | null;
            }): PensumCoursePrereq => {
              timestamps.push(p.updatedAt);

              return {
                requiredCourseId: p.requiredCourseId,
                requiredCredits: p.requiredCredits,
              };
            },
          ),
        };
      },
    );

    const updatedAt = new Date(
      Math.max(...timestamps.map((t: Date) => t.getTime())),
    );

    return {
      id: record.id,
      name: record.name,
      termType: record.termType,
      totalCredits: record.totalCredits,
      updatedAt,
      courses,
    };
  }

  private toEntity(record: PrismaProgram): Program {
    return new Program(
      {
        name: record.name,
        termType: record.termType,
        totalCredits: record.totalCredits,
      },
      record.id,
    );
  }
}
