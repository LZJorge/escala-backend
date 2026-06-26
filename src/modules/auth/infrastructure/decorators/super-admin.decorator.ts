import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { SuperAdminGuard } from '../super-admin.guard';

export function SuperAdmin(): MethodDecorator {
  return applyDecorators(
    UseGuards(JwtAuthGuard, SuperAdminGuard),
    ApiBearerAuth(),
  );
}
