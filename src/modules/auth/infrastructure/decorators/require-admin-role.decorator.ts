import { SetMetadata } from '@nestjs/common';

export const REQUIRED_ADMIN_ROLES_KEY = 'required_admin_roles';

export const RequireAdminRole = (...roles: string[]): MethodDecorator =>
  SetMetadata(REQUIRED_ADMIN_ROLES_KEY, roles);
