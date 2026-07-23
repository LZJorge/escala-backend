import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PrismaModule } from '@core/infrastructure/database/prisma.module';
import { RedisModule } from '@core/infrastructure/cache/redis.module';
import { AuthModule } from '@modules/auth/infrastructure/auth.module';
import { UserModule } from '@modules/user/infrastructure/user.module';
import { InstitutionModule } from '@modules/institution/infrastructure/institution.module';
import { PermissionModule } from '@modules/permission/infrastructure/permission.module';
import { RoleModule } from '@modules/role/infrastructure/role.module';
import { ProgramModule } from '@modules/program/infrastructure/program.module';
import { ExceptionFilter } from '@core/infrastructure/http/exception.filter';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    UserModule,
    InstitutionModule,
    PermissionModule,
    RoleModule,
    ProgramModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ExceptionFilter,
    },
  ],
})
export class AppModule {}
