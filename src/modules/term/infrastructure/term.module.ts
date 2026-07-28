import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/infrastructure/auth.module';
import { TermController } from './term.controller';
import { TermService } from '../application/term.service';
import { PrismaTermRepository } from './term.repository.impl';
import { TERM_REPOSITORY } from '../domain/term.repository';

@Module({
  imports: [AuthModule],
  controllers: [TermController],
  providers: [
    TermService,
    {
      provide: TERM_REPOSITORY,
      useClass: PrismaTermRepository,
    },
  ],
  exports: [TermService],
})
export class TermModule {}
