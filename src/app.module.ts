import { Module } from '@nestjs/common';
import { PrismaModule } from '@core/infrastructure/database/prisma.module';
import { AuthModule } from '@modules/auth/infrastructure/auth.module';
import { UserModule } from '@modules/user/infrastructure/user.module';

@Module({
  imports: [PrismaModule, AuthModule, UserModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
