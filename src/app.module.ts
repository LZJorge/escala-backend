import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PrismaModule } from '@core/infrastructure/database/prisma.module';
import { AuthModule } from '@modules/auth/infrastructure/auth.module';
import { UserModule } from '@modules/user/infrastructure/user.module';
import { InstitutionModule } from '@modules/institution/infrastructure/institution.module';
import { ExceptionFilter } from '@core/infrastructure/http/exception.filter';

@Module({
  imports: [PrismaModule, AuthModule, UserModule, InstitutionModule],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ExceptionFilter,
    },
  ],
})
export class AppModule {}
