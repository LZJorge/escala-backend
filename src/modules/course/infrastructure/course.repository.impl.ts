import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import type { Prisma } from '@prisma/client';
import { CourseRepository } from '../domain/course.repository';
import type { CoursePrerequisiteRow } from '../domain/course.repository';
import { Course } from '../domain/course.entity';

import type { Course as PrismaCourse } from '@prisma/client';

@Injectable()
export class PrismaCourseRepository implements CourseRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async create(course: Course): Promise<Course> {
    const record = await this.prisma.course.create({
      data: {
        id: course.id,
        programId: course.programId,
        code: course.code,
        name: course.name,
        credits: course.credits,
        termLevel: course.termLevel,
      },
    });

    return this.toEntity(record);
  }

  public async findAllByProgram(programId: string): Promise<Course[]> {
    const records = await this.prisma.course.findMany({
      where: { programId, deletedAt: null },
      orderBy: { termLevel: 'asc' },
    });

    return records.map((r: PrismaCourse) => this.toEntity(r));
  }

  public async findById(id: string): Promise<Course | null> {
    const record = await this.prisma.course.findUnique({
      where: { id, deletedAt: null },
    });

    if (!record) {
      return null;
    }

    return this.toEntity(record);
  }

  public async programExists(programId: string): Promise<boolean> {
    const count = await this.prisma.program.count({
      where: { id: programId, deletedAt: null },
    });

    return count > 0;
  }

  public async update(course: Course): Promise<Course> {
    const record = await this.prisma.course.update({
      where: { id: course.id },
      data: {
        code: course.code,
        name: course.name,
        credits: course.credits,
        termLevel: course.termLevel,
      },
    });

    return this.toEntity(record);
  }

  public async softDelete(id: string): Promise<void> {
    await this.prisma.course.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  public async getPrerequisites(
    courseId: string,
  ): Promise<CoursePrerequisiteRow[]> {
    const rows = await this.prisma.coursePrerequisite.findMany({
      where: { courseId },
    });

    return rows.map((r: PrismaCoursePrerequisite) => ({
      courseId: r.courseId,
      requiredCourseId: r.requiredCourseId,
      requiredCredits: r.requiredCredits,
    }));
  }

  public async getPrerequisitesForCourses(
    courseIds: string[],
  ): Promise<CoursePrerequisiteRow[]> {
    if (courseIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.coursePrerequisite.findMany({
      where: { courseId: { in: courseIds } },
    });

    return rows.map((r: PrismaCoursePrerequisite) => ({
      courseId: r.courseId,
      requiredCourseId: r.requiredCourseId,
      requiredCredits: r.requiredCredits,
    }));
  }

  public async setPrerequisites(
    courseId: string,
    prerequisites: Omit<CoursePrerequisiteRow, 'courseId'>[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.coursePrerequisite.deleteMany({ where: { courseId } });

      if (prerequisites.length > 0) {
        await tx.coursePrerequisite.createMany({
          data: prerequisites.map(
            (p: Omit<CoursePrerequisiteRow, 'courseId'>) => ({
              courseId,
              requiredCourseId: p.requiredCourseId,
              requiredCredits: p.requiredCredits,
            }),
          ),
        });
      }
    });
  }

  public async findDependentCourses(courseId: string): Promise<Course[]> {
    const rows = await this.prisma.coursePrerequisite.findMany({
      where: { requiredCourseId: courseId },
      select: { courseId: true },
    });

    const ids = rows.map((r: { courseId: string }) => r.courseId);

    if (ids.length === 0) {
      return [];
    }

    const records = await this.prisma.course.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });

    return records.map((r: PrismaCourse) => this.toEntity(r));
  }

  public async purgePrerequisites(courseId: string): Promise<void> {
    await this.prisma.coursePrerequisite.deleteMany({
      where: {
        OR: [{ courseId }, { requiredCourseId: courseId }],
      },
    });
  }

  private toEntity(record: PrismaCourse): Course {
    return new Course(
      {
        programId: record.programId,
        code: record.code,
        name: record.name,
        credits: record.credits,
        termLevel: record.termLevel,
      },
      record.id,
    );
  }
}

type PrismaCoursePrerequisite = {
  courseId: string;
  requiredCourseId: string | null;
  requiredCredits: number | null;
};
