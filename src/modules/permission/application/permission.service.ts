import { Inject, Injectable } from '@nestjs/common';
import { PERMISSION_REPOSITORY } from '../domain/permission.repository';
import type { PermissionRepository } from '../domain/permission.repository';

@Injectable()
export class PermissionService {
  constructor(
    @Inject(PERMISSION_REPOSITORY)
    private readonly repository: PermissionRepository,
  ) {}

  public async findAll(): Promise<
    Array<{
      id: string;
      code: string;
      module: string;
      description: string | null;
    }>
  > {
    return this.repository.findAll();
  }
}
