import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    email: string;
    mustChangePassword: boolean;
    roleType: 'SUPER_ADMIN' | 'USER';
    profiles?: Array<'ADMIN' | 'STUDENT'>;
    adminRoles?: string[];
    studentProfileId?: string | null;
    adminProfileId?: string | null;
  };
}
