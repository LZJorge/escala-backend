import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { Result } from '@core/domain/result';
import { AUTH_REPOSITORY } from '../domain/auth.repository';
import type { AuthRepository } from '../domain/auth.repository';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  public async login(params: { email: string; password: string }): Promise<
    Result<{
      accessToken: string;
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        roleType: 'SUPER_ADMIN' | 'USER';
      };
    }>
  > {
    if (!params.email || !params.password) {
      return Result.fail('Email and password are required');
    }

    const superAdmin = await this.authRepository.findSuperAdminByEmail(
      params.email,
    );

    if (superAdmin) {
      const [salt, storedHash] = superAdmin.password.split(':');
      const hashBuf = scryptSync(params.password, salt, 64);
      const storedBuf = Buffer.from(storedHash, 'hex');

      if (
        hashBuf.length !== storedBuf.length ||
        !timingSafeEqual(hashBuf, storedBuf)
      ) {
        return Result.fail('Invalid email or password');
      }

      const jwtPayload: Record<string, unknown> = {
        sub: superAdmin.id,
        email: superAdmin.email,
        roleType: 'SUPER_ADMIN',
      };

      const accessToken = this.jwtService.sign(jwtPayload);

      return Result.ok({
        accessToken,
        user: {
          id: superAdmin.id,
          email: superAdmin.email,
          firstName: '',
          lastName: '',
          roleType: 'SUPER_ADMIN',
        },
      });
    }

    const user = await this.authRepository.findByEmail(params.email);

    if (!user) {
      return Result.fail('Invalid email or password');
    }

    const [salt, storedHash] = user.password.split(':');
    const hashBuf = scryptSync(params.password, salt, 64);
    const storedBuf = Buffer.from(storedHash, 'hex');

    if (
      hashBuf.length !== storedBuf.length ||
      !timingSafeEqual(hashBuf, storedBuf)
    ) {
      return Result.fail('Invalid email or password');
    }

    const jwtPayload: Record<string, unknown> = {
      sub: user.id,
      email: user.email,
      roleType: 'USER',
    };

    const accessToken = this.jwtService.sign(jwtPayload);

    return Result.ok({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleType: 'USER',
      },
    });
  }
}
