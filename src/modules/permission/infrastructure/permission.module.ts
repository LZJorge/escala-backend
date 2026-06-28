import { Module } from '@nestjs/common';
import { PermissionController } from './permission.controller';
import { PermissionService } from '../application/permission.service';
import { PrismaPermissionRepository } from './permission.repository.impl';
import { PERMISSION_REPOSITORY } from '../domain/permission.repository';

@Module({
  controllers: [PermissionController],
  providers: [
    PermissionService,
    { provide: PERMISSION_REPOSITORY, useClass: PrismaPermissionRepository },
  ],
  exports: [PermissionService],
})
export class PermissionModule {}
