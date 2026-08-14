import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@core/domain/result';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { CacheKeys } from '@core/infrastructure/cache/cache-keys.factory';
import { COURSE_REPOSITORY } from '../domain/course.repository';
import type {
  CourseRepository,
  CoursePrerequisiteRow,
} from '../domain/course.repository';
import { Course } from '../domain/course.entity';
import type { CourseResponseDto } from './course.dto';

const CACHE_TTL_SECONDS = 30 * 60;

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
    private readonly redisService: RedisService,
  ) {}

  private async invalidateCourseCache(
    programId: string,
    courseId?: string,
  ): Promise<void> {
    await this.redisService.delete(CacheKeys.COURSE_BY_PROGRAM(programId));

    if (courseId !== undefined) {
      await this.redisService.delete(CacheKeys.COURSE_BY_ID(courseId));
    }

    await this.redisService.delete(CacheKeys.PROGRAM_ALL());
    await this.redisService.delete(CacheKeys.PROGRAM_BY_ID(programId));
    await this.redisService.delete(CacheKeys.PROGRAM_SUMMARY(programId));
    await this.redisService.delete(CacheKeys.PROGRAM_PENSUM(programId));
  }

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

    if (!(await this.repository.programExists(params.programId))) {
      return Result.fail('Program not found');
    }

    if (await this.hasDuplicateCode(params.programId, params.code)) {
      return Result.fail('Course code already exists in this program');
    }

    const saved = await this.repository.create(course);

    await this.invalidateCourseCache(params.programId);

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
    const cacheKey = CacheKeys.COURSE_BY_PROGRAM(programId);
    const cached = await this.redisService.get<CourseResponseDto[]>(cacheKey);

    if (cached) {
      return Result.ok(cached);
    }

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

    const result = courses.map((c: Course) => ({
      id: c.id,
      programId: c.programId,
      code: c.code,
      name: c.name,
      credits: c.credits,
      termLevel: c.termLevel,
      createdAt: c.createdAt.toISOString(),
      prerequisites: prereqsByCourse.get(c.id) ?? [],
    }));

    await this.redisService.set(cacheKey, result, CACHE_TTL_SECONDS);

    return Result.ok(result);
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
    const cacheKey = CacheKeys.COURSE_BY_ID(id);
    const cached = await this.redisService.get<CourseResponseDto>(cacheKey);

    if (cached) {
      return Result.ok(cached);
    }

    const course = await this.repository.findById(id);

    if (!course) {
      return Result.fail('Course not found');
    }

    const prereqs = await this.repository.getPrerequisites(id);

    const result = {
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
    };

    await this.redisService.set(cacheKey, result, CACHE_TTL_SECONDS);

    return Result.ok(result);
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

    if (
      params.termLevel !== undefined &&
      params.termLevel !== existing.termLevel
    ) {
      const levelCheck = await this.validateLevelChange(
        existing.id,
        existing.programId,
        params.termLevel,
      );

      if (levelCheck.isFailure) {
        return Result.fail(levelCheck.error as string);
      }
    }

    if (
      params.code !== undefined &&
      params.code !== existing.code &&
      (await this.hasDuplicateCode(existing.programId, params.code, id))
    ) {
      return Result.fail('Course code already exists in this program');
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

    await this.invalidateCourseCache(existing.programId, existing.id);

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

    await this.repository.purgePrerequisites(id);

    await this.invalidateCourseCache(existing.programId, existing.id);

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

    const programCourses = await this.repository.findAllByProgram(
      course.programId,
    );
    const levelById = new Map<string, number>(
      programCourses.map((c: Course) => [c.id, c.termLevel]),
    );

    const newEdges: string[] = [];
    for (const p of prerequisites) {
      if (p.requiredCourseId === null && p.requiredCredits === null) {
        return Result.fail(
          'Each prerequisite must define a required course or required credits',
        );
      }

      if (p.requiredCourseId !== null) {
        if (p.requiredCourseId === course.id) {
          return Result.fail('A course cannot be its own prerequisite');
        }

        const level = levelById.get(p.requiredCourseId);

        if (level === undefined) {
          return Result.fail(
            'Prerequisite course must exist in the same program',
          );
        }

        if (level >= course.termLevel) {
          return Result.fail(
            'Prerequisite courses must belong to an earlier term level',
          );
        }

        newEdges.push(p.requiredCourseId);
      }
    }

    const cycleCheck = await this.wouldCreateCycle(
      course.id,
      course.programId,
      newEdges,
    );

    if (cycleCheck.isFailure) {
      return cycleCheck;
    }

    await this.repository.setPrerequisites(courseId, prerequisites);

    await this.invalidateCourseCache(course.programId, course.id);

    return Result.ok(undefined);
  }

  private async hasDuplicateCode(
    programId: string,
    code: string,
    excludeId?: string,
  ): Promise<boolean> {
    const courses = await this.repository.findAllByProgram(programId);

    return courses.some((c: Course) => c.code === code && c.id !== excludeId);
  }

  private async validateLevelChange(
    courseId: string,
    programId: string,
    newLevel: number,
  ): Promise<Result<void>> {
    const programCourses = await this.repository.findAllByProgram(programId);
    const levelById = new Map<string, number>(
      programCourses.map((c: Course) => [c.id, c.termLevel]),
    );

    const ownPrereqs = await this.repository.getPrerequisites(courseId);

    for (const row of ownPrereqs) {
      if (!row.requiredCourseId) {
        continue;
      }

      const level = levelById.get(row.requiredCourseId);

      if (level !== undefined && level >= newLevel) {
        return Result.fail(
          'Cannot move course: a prerequisite must be in an earlier term level',
        );
      }
    }

    const dependents = await this.repository.findDependentCourses(courseId);

    for (const dependent of dependents) {
      const level = levelById.get(dependent.id);

      if (level !== undefined && level <= newLevel) {
        return Result.fail(
          'Cannot move course: it is a prerequisite of a course in the same or earlier term level',
        );
      }
    }

    return Result.ok(undefined);
  }

  private async wouldCreateCycle(
    courseId: string,
    programId: string,
    newEdges: string[],
  ): Promise<Result<void>> {
    const programCourses = await this.repository.findAllByProgram(programId);
    const programIds = programCourses.map((c: Course) => c.id);
    const existingRows =
      await this.repository.getPrerequisitesForCourses(programIds);

    const adjacency = new Map<string, string[]>();
    for (const id of programIds) {
      adjacency.set(id, []);
    }
    for (const row of existingRows) {
      if (!row.requiredCourseId) {
        continue;
      }
      adjacency.get(row.courseId)?.push(row.requiredCourseId);
    }
    if (adjacency.has(courseId)) {
      adjacency.get(courseId)?.push(...newEdges);
    }

    const visited = new Set<string>();
    const stack: string[] = [...newEdges];

    while (stack.length > 0) {
      const node = stack.pop() as string;

      if (node === courseId) {
        return Result.fail('Prerequisites would create a cycle');
      }

      if (visited.has(node)) {
        continue;
      }

      visited.add(node);

      for (const next of adjacency.get(node) ?? []) {
        stack.push(next);
      }
    }

    return Result.ok(undefined);
  }
}
