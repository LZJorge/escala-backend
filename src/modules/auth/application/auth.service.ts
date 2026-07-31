import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
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
        mustChangePassword: boolean;
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
        mustChangePassword: superAdmin.mustChangePassword,
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
          mustChangePassword: superAdmin.mustChangePassword,
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
      mustChangePassword: false,
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
        mustChangePassword: false,
        roleType: 'USER',
      },
    });
  }

  public async changeSuperAdminPassword(
    id: string,
    newPassword: string,
  ): Promise<
    Result<{
      accessToken: string;
      user: {
        id: string;
        email: string;
        mustChangePassword: boolean;
        roleType: 'SUPER_ADMIN';
      };
    }>
  > {
    const superadmin = await this.authRepository.findSuperAdminById(id);
    if (!superadmin) {
      return Result.fail('Super admin not found');
    }

    const salt = randomBytes(16).toString('hex');
    const hashBuf = scryptSync(newPassword, salt, 64);
    const hashedPassword = `${salt}:${hashBuf.toString('hex')}`;

    await this.authRepository.changeSuperAdminPassword(id, hashedPassword);

    const jwtPayload = {
      sub: superadmin.id,
      email: superadmin.email,
      mustChangePassword: false,
      roleType: 'SUPER_ADMIN',
    };

    const accessToken = this.jwtService.sign(jwtPayload);

    return Result.ok({
      accessToken,
      user: {
        id: superadmin.id,
        email: superadmin.email,
        mustChangePassword: false,
        roleType: 'SUPER_ADMIN',
      },
    });
  }
}
