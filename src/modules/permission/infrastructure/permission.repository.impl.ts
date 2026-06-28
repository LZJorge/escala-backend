import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { PermissionRepository } from '../domain/permission.repository';
import type { PermissionRecord } from '../domain/permission.repository';

@Injectable()
export class PrismaPermissionRepository implements PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findAll(): Promise<PermissionRecord[]> {
    return this.prisma.permission.findMany({ orderBy: { module: 'asc' } });
  }

  public async findByCodes(codes: string[]): Promise<PermissionRecord[]> {
    return this.prisma.permission.findMany({ where: { code: { in: codes } } });
  }
}
