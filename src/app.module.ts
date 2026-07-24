import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '@core/infrastructure/database/prisma.module';
import { RedisModule } from '@core/infrastructure/cache/redis.module';
import { AuthModule } from '@modules/auth/infrastructure/auth.module';
import { UserModule } from '@modules/user/infrastructure/user.module';
import { InstitutionModule } from '@modules/institution/infrastructure/institution.module';
import { PermissionModule } from '@modules/permission/infrastructure/permission.module';
import { RoleModule } from '@modules/role/infrastructure/role.module';
import { ProgramModule } from '@modules/program/infrastructure/program.module';
import { CourseModule } from '@modules/course/infrastructure/course.module';
import { ExceptionFilter } from '@core/infrastructure/http/exception.filter';
import { TransformInterceptor } from '@core/infrastructure/http/transform.interceptor';

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
    CourseModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
