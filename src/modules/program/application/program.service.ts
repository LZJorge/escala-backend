import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@core/domain/result';
import { PROGRAM_REPOSITORY } from '../domain/program.repository';
import type { ProgramRepository } from '../domain/program.repository';
import { Program } from '../domain/program.entity';
import type { TermType } from '@prisma/client';

@Injectable()
export class ProgramService {
  constructor(
    @Inject(PROGRAM_REPOSITORY)
    private readonly repository: ProgramRepository,
  ) {}

  public async create(
    institutionId: string,
    params: {
      name: string;
      termType: TermType;
      totalCredits: number;
    },
  ): Promise<
    Result<{
      id: string;
      institutionId: string;
      name: string;
      termType: string;
      totalCredits: number;
      createdAt: string;
    }>
  > {
    const program = new Program({
      institutionId,
      name: params.name,
      termType: params.termType,
      totalCredits: params.totalCredits,
    });

    const saved = await this.repository.create(program);

    return Result.ok({
      id: saved.id,
      institutionId: saved.institutionId,
      name: saved.name,
      termType: saved.termType,
      totalCredits: saved.totalCredits,
      createdAt: saved.createdAt.toISOString(),
    });
  }

  public async findAll(institutionId: string): Promise<
    Result<
      Array<{
        id: string;
        institutionId: string;
        name: string;
        termType: string;
        totalCredits: number;
        createdAt: string;
      }>
    >
  > {
    const programs = await this.repository.findAll(institutionId);

    return Result.ok(
      programs.map((p: Program) => ({
        id: p.id,
        institutionId: p.institutionId,
        name: p.name,
        termType: p.termType,
        totalCredits: p.totalCredits,
        createdAt: p.createdAt.toISOString(),
      })),
    );
  }

  public async findById(id: string): Promise<
    Result<{
      id: string;
      institutionId: string;
      name: string;
      termType: string;
      totalCredits: number;
      createdAt: string;
    }>
  > {
    const program = await this.repository.findById(id);

    if (!program) {
      return Result.fail('Program not found');
    }

    return Result.ok({
      id: program.id,
      institutionId: program.institutionId,
      name: program.name,
      termType: program.termType,
      totalCredits: program.totalCredits,
      createdAt: program.createdAt.toISOString(),
    });
  }

  public async update(
    id: string,
    params: {
      name?: string;
      termType?: TermType;
      totalCredits?: number;
    },
  ): Promise<
    Result<{
      id: string;
      institutionId: string;
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
        institutionId: existing.institutionId,
        name: params.name ?? existing.name,
        termType: params.termType ?? existing.termType,
        totalCredits: params.totalCredits ?? existing.totalCredits,
      },
      existing.id,
    );

    const saved = await this.repository.update(updated);

    return Result.ok({
      id: saved.id,
      institutionId: saved.institutionId,
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

    await this.repository.delete(id);

    return Result.ok(undefined);
  }
}
