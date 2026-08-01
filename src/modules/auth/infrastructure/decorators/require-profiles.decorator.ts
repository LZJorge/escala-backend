import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { ProfilesGuard } from '../profiles.guard';
import { RequireProfile } from './require-profile.decorator';
import { RequireAdminRole } from './require-admin-role.decorator';

export function RequireProfiles(...profiles: string[]): MethodDecorator {
  return applyDecorators(
    UseGuards(JwtAuthGuard, ProfilesGuard),
    ApiBearerAuth(),
    RequireProfile(...profiles),
  );
}

export function RequireAdminRoles(...roles: string[]): MethodDecorator {
  return applyDecorators(
    UseGuards(JwtAuthGuard, ProfilesGuard),
    ApiBearerAuth(),
    RequireAdminRole(...roles),
  );
}
