import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@core/domain/result';
import { COURSE_REPOSITORY } from '../domain/course.repository';
import type {
  CourseRepository,
  CoursePrerequisiteRow,
} from '../domain/course.repository';
import { Course } from '../domain/course.entity';

interface PrerequisiteResponse {
  courseId: string;
  requiredCourseId: string | null;
  requiredCredits: number | null;
}

@Injectable()
export class CourseService {
  constructor(
    @Inject(COURSE_REPOSITORY)
    private readonly repository: CourseRepository,
  ) {}

  public async create(params: {
    programId: string;
    code: string;
    name: string;
    credits: number;
    termLevel: number;
  }): Promise<
    Result<{
      id: string;
      programId: string;
      code: string;
      name: string;
      credits: number;
      termLevel: number;
      createdAt: string;
      prerequisites: PrerequisiteResponse[];
    }>
  > {
    const course = new Course({
      programId: params.programId,
      code: params.code,
      name: params.name,
      credits: params.credits,
      termLevel: params.termLevel,
    });

    const saved = await this.repository.create(course);

    return Result.ok({
      id: saved.id,
      programId: saved.programId,
      code: saved.code,
      name: saved.name,
      credits: saved.credits,
      termLevel: saved.termLevel,
      createdAt: saved.createdAt.toISOString(),
      prerequisites: [],
    });
  }

  public async findByProgram(programId: string): Promise<
    Result<
      Array<{
        id: string;
        programId: string;
        code: string;
        name: string;
        credits: number;
        termLevel: number;
        createdAt: string;
        prerequisites: PrerequisiteResponse[];
      }>
    >
  > {
    const courses = await this.repository.findAllByProgram(programId);

    const allPrereqs = await this.repository.getPrerequisitesForCourses(
      courses.map((c: Course) => c.id),
    );

    const prereqsByCourse = new Map<string, PrerequisiteResponse[]>();
    for (const p of allPrereqs) {
      const list = prereqsByCourse.get(p.courseId) ?? [];
      list.push({
        courseId: p.courseId,
        requiredCourseId: p.requiredCourseId,
        requiredCredits: p.requiredCredits,
      });
      prereqsByCourse.set(p.courseId, list);
    }

    return Result.ok(
      courses.map((c: Course) => ({
        id: c.id,
        programId: c.programId,
        code: c.code,
        name: c.name,
        credits: c.credits,
        termLevel: c.termLevel,
        createdAt: c.createdAt.toISOString(),
        prerequisites: prereqsByCourse.get(c.id) ?? [],
      })),
    );
  }

  public async findById(id: string): Promise<
    Result<{
      id: string;
      programId: string;
      code: string;
      name: string;
      credits: number;
      termLevel: number;
      createdAt: string;
      prerequisites: PrerequisiteResponse[];
    }>
  > {
    const course = await this.repository.findById(id);

    if (!course) {
      return Result.fail('Course not found');
    }

    const prereqs = await this.repository.getPrerequisites(id);

    return Result.ok({
      id: course.id,
      programId: course.programId,
      code: course.code,
      name: course.name,
      credits: course.credits,
      termLevel: course.termLevel,
      createdAt: course.createdAt.toISOString(),
      prerequisites: prereqs.map((p: CoursePrerequisiteRow) => ({
        courseId: p.courseId,
        requiredCourseId: p.requiredCourseId,
        requiredCredits: p.requiredCredits,
      })),
    });
  }

  public async update(
    id: string,
    params: {
      code?: string;
      name?: string;
      credits?: number;
      termLevel?: number;
    },
  ): Promise<
    Result<{
      id: string;
      programId: string;
      code: string;
      name: string;
      credits: number;
      termLevel: number;
      createdAt: string;
      prerequisites: PrerequisiteResponse[];
    }>
  > {
    const existing = await this.repository.findById(id);

    if (!existing) {
      return Result.fail('Course not found');
    }

    const updated = new Course(
      {
        programId: existing.programId,
        code: params.code ?? existing.code,
        name: params.name ?? existing.name,
        credits: params.credits ?? existing.credits,
        termLevel: params.termLevel ?? existing.termLevel,
      },
      existing.id,
    );

    const saved = await this.repository.update(updated);

    const prereqs = await this.repository.getPrerequisites(id);

    return Result.ok({
      id: saved.id,
      programId: saved.programId,
      code: saved.code,
      name: saved.name,
      credits: saved.credits,
      termLevel: saved.termLevel,
      createdAt: saved.createdAt.toISOString(),
      prerequisites: prereqs.map((p: CoursePrerequisiteRow) => ({
        courseId: p.courseId,
        requiredCourseId: p.requiredCourseId,
        requiredCredits: p.requiredCredits,
      })),
    });
  }

  public async delete(id: string): Promise<Result<void>> {
    const existing = await this.repository.findById(id);

    if (!existing) {
      return Result.fail('Course not found');
    }

    await this.repository.softDelete(id);

    return Result.ok(undefined);
  }

  public async setPrerequisites(
    courseId: string,
    prerequisites: Omit<CoursePrerequisiteRow, 'courseId'>[],
  ): Promise<Result<void>> {
    const course = await this.repository.findById(courseId);

    if (!course) {
      return Result.fail('Course not found');
    }

    await this.repository.setPrerequisites(courseId, prerequisites);

    return Result.ok(undefined);
  }
}
