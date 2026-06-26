import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { Result } from '@core/domain/result';
import { AUTH_REPOSITORY } from '../domain/auth.repository';
import type {
  AuthRepository,
  InstitutionMembership,
} from '../domain/auth.repository';

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
        isSuperAdmin: boolean;
      };
      institutions: InstitutionMembership[];
    }>
  > {
    if (!params.email || !params.password) {
      return Result.fail('Email and password are required');
    }

    const user = await this.authRepository.findByEmail(params.email);
    if (!user) {
      return Result.fail('Invalid email or password');
    }

    const [salt, storedHash] = user.passwordHash.split(':');
    const hashBuf = scryptSync(params.password, salt, 64);
    const storedBuf = Buffer.from(storedHash, 'hex');

    if (
      hashBuf.length !== storedBuf.length ||
      !timingSafeEqual(hashBuf, storedBuf)
    ) {
      return Result.fail('Invalid email or password');
    }

    const institutions = await this.authRepository.findUserInstitutions(
      user.id,
    );

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
    });

    return Result.ok({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin,
      },
      institutions,
    });
  }
}
