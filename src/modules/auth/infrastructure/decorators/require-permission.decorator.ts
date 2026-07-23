import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { PermissionsGuard } from '../permissions.guard';
import { RequirePermissions } from './require-permissions.decorator';

export function RequirePermission(...permissions: string[]): MethodDecorator {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    ApiBearerAuth(),
    RequirePermissions(...permissions),
  );
}
