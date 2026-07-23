import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { ProgramRepository } from '../domain/program.repository';
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
