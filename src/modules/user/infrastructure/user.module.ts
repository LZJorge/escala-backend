import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/infrastructure/auth.module';
import { UserController } from './user.controller';
import { UserService } from '../application/user.service';
import { PrismaUserRepository } from './user.repository.impl';
import { USER_REPOSITORY } from '../domain/user.repository';

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [
    UserService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
  ],
})
export class UserModule {}
