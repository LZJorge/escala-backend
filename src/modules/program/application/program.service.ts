import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@core/domain/result';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { CacheKeys } from '@core/infrastructure/cache/cache-keys.factory';
import { PROGRAM_REPOSITORY } from '../domain/program.repository';
import type {
  ProgramRepository,
  PensumData,
  PensumCourse,
  PensumCoursePrereq,
  ProgramSummaryData,
} from '../domain/program.repository';
import { Program } from '../domain/program.entity';
import type { TermType } from '@prisma/client';
import type { PensumResponseDto, ProgramResponseDto } from './program.dto';

const CACHE_TTL_SECONDS = 30 * 60;

@Injectable()
export class ProgramService {
  constructor(
    @Inject(PROGRAM_REPOSITORY)
    private readonly repository: ProgramRepository,
    private readonly redisService: RedisService,
  ) {}

  public async create(params: { name: string; termType: TermType }): Promise<
    Result<{
      id: string;
      name: string;
      termType: string;
      totalCredits: number;
      createdAt: string;
    }>
  > {
    const program = new Program({
      name: params.name,
      termType: params.termType,
      totalCredits: 0,
    });

    const saved = await this.repository.create(program);

    await this.redisService.delete(CacheKeys.PROGRAM_ALL());

    return Result.ok({
      id: saved.id,
      name: saved.name,
      termType: saved.termType,
      totalCredits: saved.totalCredits,
      createdAt: saved.createdAt.toISOString(),
    });
  }

  public async findAll(): Promise<
    Result<
      Array<{
        id: string;
        name: string;
        termType: string;
        totalCredits: number;
        createdAt: string;
      }>
    >
  > {
    const cacheKey = CacheKeys.PROGRAM_ALL();
    const cached = await this.redisService.get<ProgramResponseDto[]>(cacheKey);

    if (cached) {
      return Result.ok(cached);
    }

    const programs = await this.repository.findAll();

    const result = programs.map((p: Program) => ({
      id: p.id,
      name: p.name,
      termType: p.termType,
      totalCredits: p.totalCredits,
      createdAt: p.createdAt.toISOString(),
    }));

    await this.redisService.set(cacheKey, result, CACHE_TTL_SECONDS);

    return Result.ok(result);
  }

  public async findById(id: string): Promise<
    Result<{
      id: string;
      name: string;
      termType: string;
      totalCredits: number;
      createdAt: string;
    }>
  > {
    const cacheKey = CacheKeys.PROGRAM_BY_ID(id);
    const cached = await this.redisService.get<ProgramResponseDto>(cacheKey);

    if (cached) {
      return Result.ok(cached);
    }

    const program = await this.repository.findById(id);

    if (!program) {
      return Result.fail('Program not found');
    }

    const result = {
      id: program.id,
      name: program.name,
      termType: program.termType,
      totalCredits: program.totalCredits,
      createdAt: program.createdAt.toISOString(),
    };

    await this.redisService.set(cacheKey, result, CACHE_TTL_SECONDS);

    return Result.ok(result);
  }

  public async update(
    id: string,
    params: {
      name?: string;
      termType?: TermType;
    },
  ): Promise<
    Result<{
      id: string;
      name: string;
      termType: string;
      totalCredits: number;
      createdAt: string;
    }>
  > {
    const existing = await this.repository.findById(id);

    if (!existing) {
      return Result.fail('Program not found');
    }

    const updated = new Program(
      {
        name: params.name ?? existing.name,
        termType: params.termType ?? existing.termType,
        totalCredits: existing.totalCredits,
      },
      existing.id,
    );

    const saved = await this.repository.update(updated);

    await this.invalidateProgramCache(id);

    return Result.ok({
      id: saved.id,
      name: saved.name,
      termType: saved.termType,
      totalCredits: saved.totalCredits,
      createdAt: saved.createdAt.toISOString(),
    });
  }

  public async delete(id: string): Promise<Result<void>> {
    const existing = await this.repository.findById(id);

    if (!existing) {
      return Result.fail('Program not found');
    }

    await this.repository.softDelete(id);

    await this.invalidateProgramCache(id);

    return Result.ok(undefined);
  }

  public async getSummary(id: string): Promise<
    Result<{
      programId: string;
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
      createdAt: string;
      updatedAt: string;
    }>
  > {
    const cacheKey = CacheKeys.PROGRAM_SUMMARY(id);
    const cached = await this.redisService.get<{
      programId: string;
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
      createdAt: string;
      updatedAt: string;
    }>(cacheKey);

    if (cached) {
      return Result.ok(cached);
    }

    const data: ProgramSummaryData | null =
      await this.repository.getSummary(id);

    if (!data) {
      return Result.fail('Program not found');
    }

    const summary = {
      programId: data.id,
      name: data.name,
      termType: data.termType,
      totalCredits: data.totalCredits,
      allocatedCredits: data.allocatedCredits,
      courseCount: data.courseCount,
      totalTermLevels: data.totalTermLevels,
      prerequisiteChainsCount: data.prerequisiteChainsCount,
      sectionCount: data.sectionCount,
      studentCount: data.studentCount,
      dropoutCount: data.dropoutCount,
      activeTeachersCount: data.activeTeachersCount,
      totalCapacity: data.totalCapacity,
      availableSpots: data.availableSpots,
      historicalTranscriptsCount: data.historicalTranscriptsCount,
      createdAt: data.createdAt.toISOString(),
      updatedAt: data.updatedAt.toISOString(),
    };

    await this.redisService.set(cacheKey, summary, CACHE_TTL_SECONDS);

    return Result.ok(summary);
  }

  public async getPensum(id: string): Promise<
    Result<{
      id: string;
      name: string;
      termType: string;
      totalCredits: number;
      updatedAt: string;
      courses: Array<{
        id: string;
        code: string;
        name: string;
        credits: number;
        termLevel: number;
        prerequisites: Array<{
          requiredCourseId: string | null;
          requiredCredits: number | null;
        }>;
      }>;
    }>
  > {
    const cacheKey = CacheKeys.PROGRAM_PENSUM(id);
    const cached = await this.redisService.get<PensumResponseDto>(cacheKey);

    if (cached) {
      return Result.ok(cached);
    }

    const data: PensumData | null = await this.repository.getPensum(id);

    if (!data) {
      return Result.fail('Program not found');
    }

    const result = {
      id: data.id,
      name: data.name,
      termType: data.termType,
      totalCredits: data.totalCredits,
      updatedAt: data.updatedAt.toISOString(),
      courses: data.courses.map((c: PensumCourse) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        credits: c.credits,
        termLevel: c.termLevel,
        prerequisites: c.prerequisites.map((p: PensumCoursePrereq) => ({
          requiredCourseId: p.requiredCourseId,
          requiredCredits: p.requiredCredits,
        })),
      })),
    };

    await this.redisService.set(cacheKey, result, CACHE_TTL_SECONDS);

    return Result.ok(result);
  }

  private async invalidateProgramCache(programId: string): Promise<void> {
    await this.redisService.delete(CacheKeys.PROGRAM_ALL());
    await this.redisService.delete(CacheKeys.PROGRAM_BY_ID(programId));
    await this.redisService.delete(CacheKeys.PROGRAM_SUMMARY(programId));
    await this.redisService.delete(CacheKeys.PROGRAM_PENSUM(programId));
  }
}
