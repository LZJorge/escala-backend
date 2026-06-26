import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Result } from '@core/domain/result';
import { AUTH_REPOSITORY } from '../domain/auth.repository';
import type { AuthRepository } from '../domain/auth.repository';
import { User } from '../domain/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  public async register(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    ci: string;
    phone?: string;
  }): Promise<
    Result<{
      accessToken: string;
      user: { id: string; email: string; firstName: string; lastName: string };
    }>
  > {
    if (
      !params.email ||
      !params.password ||
      !params.firstName ||
      !params.lastName ||
      !params.ci
    ) {
      return Result.fail('Missing required fields');
    }

    const existingEmail = await this.authRepository.findByEmail(params.email);
    if (existingEmail) {
      return Result.fail('Email already in use');
    }

    const existingCi = await this.authRepository.findByCi(params.ci);
    if (existingCi) {
      return Result.fail('CI already in use');
    }

    const salt = randomBytes(16).toString('hex');
    const hashed = scryptSync(params.password, salt, 64).toString('hex');
    const passwordHash = `${salt}:${hashed}`;

    const user = new User({
      email: params.email,
      passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
      ci: params.ci,
      phone: params.phone ?? null,
    });

    await this.authRepository.create(user);

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return Result.ok({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  }

  public async login(params: { email: string; password: string }): Promise<
    Result<{
      accessToken: string;
      user: { id: string; email: string; firstName: string; lastName: string };
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

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return Result.ok({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  }
}
