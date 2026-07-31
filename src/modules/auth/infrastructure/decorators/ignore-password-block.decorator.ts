import { SetMetadata } from '@nestjs/common';

export const IGNORE_PASSWORD_BLOCK_KEY = 'ignorePasswordBlock';
export const IgnorePasswordBlock = (): MethodDecorator =>
  SetMetadata(IGNORE_PASSWORD_BLOCK_KEY, true);
