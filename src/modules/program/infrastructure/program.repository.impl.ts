import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { ProgramRepository } from '../domain/program.repository';
import type {
  PensumData,
  PensumCourse,
  PensumCoursePrereq,
  ProgramSummaryData,
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

  public async getSummary(id: string): Promise<ProgramSummaryData | null> {
    const record = await this.prisma.program.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        termType: true,
        totalCredits: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!record) {
      return null;
    }

    const [
      courseAgg,
      creditsAgg,
      prerequisiteChainsCount,
      sectionCount,
      sectionAgg,
      enrolledStudentIds,
      dropoutStudentIds,
      teacherRows,
      historicalTranscriptsCount,
    ] = await Promise.all([
      this.prisma.course.aggregate({
        where: { programId: id, deletedAt: null },
        _count: { _all: true },
        _max: { termLevel: true },
      }),
      this.prisma.course.aggregate({
        where: { programId: id, deletedAt: null },
        _sum: { credits: true },
      }),
      this.prisma.course.count({
        where: {
          programId: id,
          deletedAt: null,
          prerequisites: { some: {} },
        },
      }),
      this.prisma.courseSection.count({
        where: {
          deletedAt: null,
          course: { programId: id, deletedAt: null },
        },
      }),
      this.prisma.courseSection.aggregate({
        where: {
          deletedAt: null,
          course: { programId: id, deletedAt: null },
        },
        _sum: { capacity: true },
      }),
      this.prisma.enrollment.findMany({
        where: {
          status: 'ENROLLED',
          section: {
            deletedAt: null,
            course: { programId: id, deletedAt: null },
          },
        },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      this.prisma.enrollment.findMany({
        where: {
          status: { in: ['DROPPED', 'WITHDRAWN'] },
          section: {
            deletedAt: null,
            course: { programId: id, deletedAt: null },
          },
        },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      this.prisma.courseSection.findMany({
        where: {
          deletedAt: null,
          course: { programId: id, deletedAt: null },
        },
        select: { teacherId: true },
        distinct: ['teacherId'],
      }),
      this.prisma.transcript.count({
        where: { course: { programId: id } },
      }),
    ]);

    const studentCount = enrolledStudentIds.length;
    const totalCapacity = sectionAgg._sum.capacity ?? 0;

    return {
      id: record.id,
      name: record.name,
      termType: record.termType,
      totalCredits: record.totalCredits,
      allocatedCredits: creditsAgg._sum.credits ?? 0,
      courseCount: courseAgg._count._all,
      totalTermLevels: courseAgg._max.termLevel ?? 0,
      prerequisiteChainsCount,
      sectionCount,
      studentCount,
      dropoutCount: dropoutStudentIds.length,
      activeTeachersCount: teacherRows.length,
      totalCapacity,
      availableSpots: totalCapacity - studentCount,
      historicalTranscriptsCount,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
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
