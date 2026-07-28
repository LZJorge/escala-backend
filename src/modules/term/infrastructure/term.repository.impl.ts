import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { TermRepository } from '../domain/term.repository';
import { Term } from '../domain/term.entity';

import type { Term as PrismaTerm } from '@prisma/client';

@Injectable()
export class PrismaTermRepository implements TermRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async create(term: Term): Promise<Term> {
    const record = await this.prisma.term.create({
      data: {
        id: term.id,
        name: term.name,
        startDate: term.startDate,
        endDate: term.endDate,
        status: term.status,
      },
    });

    return this.toEntity(record);
  }

  public async findAll(status?: string): Promise<Term[]> {
    const where: Record<string, unknown> = { deletedAt: null };

    if (status) {
      where.status = status;
    }

    const records = await this.prisma.term.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });

    return records.map((r: PrismaTerm) => this.toEntity(r));
  }

  public async findById(id: string): Promise<Term | null> {
    const record = await this.prisma.term.findUnique({
      where: { id, deletedAt: null },
    });

    if (!record) {
      return null;
    }

    return this.toEntity(record);
  }

  public async findActive(): Promise<Term | null> {
    const record = await this.prisma.term.findFirst({
      where: { status: 'ACTIVE', deletedAt: null },
    });

    if (!record) {
      return null;
    }

    return this.toEntity(record);
  }

  public async update(term: Term): Promise<Term> {
    const record = await this.prisma.term.update({
      where: { id: term.id },
      data: {
        name: term.name,
        startDate: term.startDate,
        endDate: term.endDate,
        status: term.status,
      },
    });

    return this.toEntity(record);
  }

  public async softDelete(id: string): Promise<void> {
    await this.prisma.term.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  public async countSections(termId: string): Promise<number> {
    return this.prisma.courseSection.count({
      where: { termId },
    });
  }

  private toEntity(record: PrismaTerm): Term {
    return new Term(
      {
        name: record.name,
        startDate: record.startDate,
        endDate: record.endDate,
        status: record.status,
      },
      record.id,
    );
  }
}
