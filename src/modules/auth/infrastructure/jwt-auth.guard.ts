import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthenticatedRequest } from './authenticated-request';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

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
        roleType: 'SUPER_ADMIN' | 'USER';
      }>(token);
      request.user = payload;
      return true;
    } catch {
      throw new DomainException(
        ErrorCodes.SEC_AUTH_TOKEN_EXPIRED,
        'Authentication token is invalid or expired',
      );
    }
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
