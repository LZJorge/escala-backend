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
        institutionId: program.institutionId,
        name: program.name,
        termType: program.termType,
        totalCredits: program.totalCredits,
      },
    });

    return this.toEntity(record);
  }

  public async findAll(institutionId: string): Promise<Program[]> {
    const records = await this.prisma.program.findMany({
      where: { institutionId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r: PrismaProgram) => this.toEntity(r));
  }

  public async findById(id: string): Promise<Program | null> {
    const record = await this.prisma.program.findUnique({
      where: { id },
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

  public async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.program.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  private toEntity(record: PrismaProgram): Program {
    return new Program(
      {
        institutionId: record.institutionId,
        name: record.name,
        termType: record.termType,
        totalCredits: record.totalCredits,
      },
      record.id,
    );
  }
}
