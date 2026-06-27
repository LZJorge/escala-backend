import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { MasterAdminGuard } from '../master-admin.guard';

export function MasterAdmin(): MethodDecorator {
  return applyDecorators(
    UseGuards(JwtAuthGuard, MasterAdminGuard),
    ApiBearerAuth(),
  );
}
