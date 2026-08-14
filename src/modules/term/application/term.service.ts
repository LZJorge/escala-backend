import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@core/domain/result';
import { TERM_REPOSITORY } from '../domain/term.repository';
import type { TermRepository } from '../domain/term.repository';
import { Term } from '../domain/term.entity';
import type { TermStatus } from '@prisma/client';

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
    const terms = await this.repository.findAll(status, programId);

    return Result.ok(terms.map((t: Term) => this.toResponse(t)));
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
    const term = await this.repository.findActive(programId);

    if (!term) {
      return Result.ok(null);
    }

    return Result.ok(this.toResponse(term));
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
    const term = await this.repository.findById(id);

    if (!term) {
      return Result.fail('Term not found');
    }

    return Result.ok(this.toResponse(term));
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

    return Result.ok(this.toResponse(saved));
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

    return Result.ok(undefined);
  }
}
