import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    email: string;
    roleType: 'SUPER_ADMIN' | 'USER';
  };
}
