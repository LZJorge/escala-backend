import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@core/domain/result';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { CacheKeys } from '@core/infrastructure/cache/cache-keys.factory';
import type { ValidCacheKey } from '@core/infrastructure/cache/cache-keys.factory';
import { TERM_REPOSITORY } from '../domain/term.repository';
import type {
  TermRepository,
  MissingCourseSummary,
} from '../domain/term.repository';
import { Term } from '../domain/term.entity';
import type { TermStatus } from '@prisma/client';
import type { TermResponseDto } from './term.dto';

const CACHE_TTL_SECONDS = 30 * 60;

const VALID_TRANSITIONS: Record<string, string[]> = {
  UPCOMING: ['ACTIVE'],
  ACTIVE: ['CLOSED'],
  CLOSED: [],
};

@Injectable()
export class TermService {
  constructor(
    @Inject(TERM_REPOSITORY)
    private readonly repository: TermRepository,
    private readonly redisService: RedisService,
  ) {}

  private toResponse(term: Term): {
    id: string;
    programId: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: term.id,
      programId: term.programId,
      name: term.name,
      startDate: term.startDate.toISOString(),
      endDate: term.endDate.toISOString(),
      status: term.status,
      createdAt: term.createdAt.toISOString(),
      updatedAt: term.updatedAt.toISOString(),
    };
  }

  private async invalidateTermCache(
    termId: string,
    programId: string,
    statuses: TermStatus[],
  ): Promise<void> {
    const keys: ValidCacheKey[] = [
      CacheKeys.TERM_BY_ID(termId),
      CacheKeys.TERM_ACTIVE(programId),
      CacheKeys.TERM_ACTIVE(),
    ];

    for (const status of new Set([...statuses, undefined])) {
      keys.push(CacheKeys.TERM_LIST(status, programId));
      keys.push(CacheKeys.TERM_LIST(status, undefined));
    }

    for (const key of keys) {
      await this.redisService.delete(key);
    }
  }

  public async create(params: {
    programId: string;
    name: string;
    startDate: string;
    endDate: string;
  }): Promise<
    Result<{
      id: string;
      programId: string;
      name: string;
      startDate: string;
      endDate: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    }>
  > {
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);

    if (end <= start) {
      return Result.fail('endDate must be after startDate');
    }

    const term = new Term({
      programId: params.programId,
      name: params.name,
      startDate: start,
      endDate: end,
      status: 'UPCOMING',
    });

    const saved = await this.repository.create(term);

    await this.invalidateTermCache(saved.id, saved.programId, [saved.status]);

    return Result.ok(this.toResponse(saved));
  }

  public async findAll(
    status?: string,
    programId?: string,
  ): Promise<
    Result<
      Array<{
        id: string;
        programId: string;
        name: string;
        startDate: string;
        endDate: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      }>
    >
  > {
    const cacheKey = CacheKeys.TERM_LIST(status, programId);
    const cached = await this.redisService.get<TermResponseDto[]>(cacheKey);

    if (cached) {
      return Result.ok(cached);
    }

    const terms = await this.repository.findAll(status, programId);

    const result = terms.map((t: Term) => this.toResponse(t));

    await this.redisService.set(cacheKey, result, CACHE_TTL_SECONDS);

    return Result.ok(result);
  }

  public async findActive(programId?: string): Promise<
    Result<{
      id: string;
      programId: string;
      name: string;
      startDate: string;
      endDate: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    } | null>
  > {
    const cacheKey = CacheKeys.TERM_ACTIVE(programId);
    const cached = await this.redisService.get<TermResponseDto>(cacheKey);

    if (cached) {
      return Result.ok(cached);
    }

    const term = await this.repository.findActive(programId);

    if (!term) {
      return Result.ok(null);
    }

    const result = this.toResponse(term);

    await this.redisService.set(cacheKey, result, CACHE_TTL_SECONDS);

    return Result.ok(result);
  }

  public async findById(id: string): Promise<
    Result<{
      id: string;
      programId: string;
      name: string;
      startDate: string;
      endDate: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    }>
  > {
    const cacheKey = CacheKeys.TERM_BY_ID(id);
    const cached = await this.redisService.get<TermResponseDto>(cacheKey);

    if (cached) {
      return Result.ok(cached);
    }

    const term = await this.repository.findById(id);

    if (!term) {
      return Result.fail('Term not found');
    }

    const result = this.toResponse(term);

    await this.redisService.set(cacheKey, result, CACHE_TTL_SECONDS);

    return Result.ok(result);
  }

  public async update(
    id: string,
    params: {
      name?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<
    Result<{
      id: string;
      programId: string;
      name: string;
      startDate: string;
      endDate: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    }>
  > {
    const existing = await this.repository.findById(id);

    if (!existing) {
      return Result.fail('Term not found');
    }

    if (existing.status === 'CLOSED') {
      return Result.fail('Cannot modify a closed term');
    }

    const start = params.startDate
      ? new Date(params.startDate)
      : existing.startDate;
    const end = params.endDate ? new Date(params.endDate) : existing.endDate;

    if (end <= start) {
      return Result.fail('endDate must be after startDate');
    }

    const updated = new Term(
      {
        programId: existing.programId,
        name: params.name ?? existing.name,
        startDate: start,
        endDate: end,
        status: existing.status,
      },
      existing.id,
    );

    const saved = await this.repository.update(updated);

    await this.invalidateTermCache(saved.id, saved.programId, [saved.status]);

    return Result.ok(this.toResponse(saved));
  }

  public async changeStatus(
    id: string,
    newStatus: TermStatus,
  ): Promise<
    Result<{
      id: string;
      programId: string;
      name: string;
      startDate: string;
      endDate: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    }>
  > {
    const existing = await this.repository.findById(id);

    if (!existing) {
      return Result.fail('Term not found');
    }

    const allowed = VALID_TRANSITIONS[existing.status];

    if (!allowed?.includes(newStatus)) {
      return Result.fail(
        `Cannot transition from ${existing.status} to ${newStatus}`,
      );
    }

    if (newStatus === 'ACTIVE') {
      const activeTerm = await this.repository.findActive(existing.programId);

      if (activeTerm && activeTerm.id !== id) {
        return Result.fail('Another term is already active in this program');
      }
    }

    const updated = new Term(
      {
        programId: existing.programId,
        name: existing.name,
        startDate: existing.startDate,
        endDate: existing.endDate,
        status: newStatus,
      },
      existing.id,
    );

    const saved = await this.repository.update(updated);

    await this.invalidateTermCache(saved.id, saved.programId, [
      existing.status,
      newStatus,
    ]);

    return Result.ok(this.toResponse(saved));
  }

  public async getMissingCourses(
    termId: string,
  ): Promise<Result<MissingCourseSummary[]>> {
    const term = await this.repository.findById(termId);

    if (!term) {
      return Result.fail('Term not found');
    }

    const courses = await this.repository.findMissingCourses(
      termId,
      term.programId,
    );

    return Result.ok(courses);
  }

  public async delete(id: string): Promise<Result<void>> {
    const existing = await this.repository.findById(id);

    if (!existing) {
      return Result.fail('Term not found');
    }

    if (existing.status !== 'UPCOMING') {
      return Result.fail('Only upcoming terms can be deleted');
    }

    const sectionCount = await this.repository.countSections(id);

    if (sectionCount > 0) {
      return Result.fail(
        'Cannot delete term with existing sections. Remove or reassign sections first.',
      );
    }

    await this.repository.softDelete(id);

    await this.invalidateTermCache(id, existing.programId, [existing.status]);

    return Result.ok(undefined);
  }
}
