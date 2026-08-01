import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedRequest } from './authenticated-request';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';
import { IGNORE_PASSWORD_BLOCK_KEY } from './decorators/ignore-password-block.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new DomainException(
        ErrorCodes.SEC_AUTH_TOKEN_MISSING,
        'Authentication token is missing',
      );
    }

    try {
      const payload = this.jwtService.verify<{
        sub: string;
        email: string;
        mustChangePassword: boolean;
        roleType: 'SUPER_ADMIN' | 'USER';
        profiles?: Array<'ADMIN' | 'STUDENT'>;
        adminRoles?: string[];
        studentProfileId?: string | null;
        adminProfileId?: string | null;
      }>(token);

      request.user = payload;
    } catch {
      throw new DomainException(
        ErrorCodes.SEC_AUTH_TOKEN_EXPIRED,
        'Authentication token is invalid or expired',
      );
    }

    if (request.user.mustChangePassword) {
      const ignoreBlock = this.reflector.getAllAndOverride<boolean>(
        IGNORE_PASSWORD_BLOCK_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (!ignoreBlock) {
        throw new DomainException(
          ErrorCodes.SEC_AUTH_PASSWORD_CHANGE_REQUIRED,
          'Password change is required before continuing',
        );
      }
    }

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
