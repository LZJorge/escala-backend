import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PROFILES_KEY = 'required_profiles';

export const RequireProfile = (...profiles: string[]): MethodDecorator =>
  SetMetadata(REQUIRED_PROFILES_KEY, profiles);
