import { Module } from '@nestjs/common';
import { PrismaModule } from '@core/infrastructure/database/prisma.module';
import { AuthModule } from '@modules/auth/infrastructure/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
