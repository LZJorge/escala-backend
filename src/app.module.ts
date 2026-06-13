import { Module } from '@nestjs/common';
import { PrismaModule } from '@core/infrastructure/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
