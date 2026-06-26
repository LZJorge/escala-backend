import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@core/domain/result';
import { User } from '@core/domain/user.entity';
import { USER_REPOSITORY } from '../domain/user.repository';
import type { UserRepository } from '../domain/user.repository';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  public async getProfile(userId: string): Promise<
    Result<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      ci: string;
      phone: string | null;
    }>
  > {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return Result.fail('User not found');
    }
    return Result.ok({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      ci: user.ci,
      phone: user.phone,
    });
  }

  public async updateProfile(
    userId: string,
    params: { firstName?: string; lastName?: string; phone?: string },
  ): Promise<
    Result<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      ci: string;
      phone: string | null;
    }>
  > {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return Result.fail('User not found');
    }

    const updated = new User(
      {
        email: user.email,
        passwordHash: user.passwordHash,
        firstName: params.firstName ?? user.firstName,
        lastName: params.lastName ?? user.lastName,
        ci: user.ci,
        phone: params.phone !== undefined ? params.phone : user.phone,
      },
      user.id,
    );

    await this.userRepository.update(updated);

    return Result.ok({
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      ci: updated.ci,
      phone: updated.phone,
    });
  }
}
