import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/infrastructure/auth.module';
import { ProgramController } from './program.controller';
import { ProgramService } from '../application/program.service';
import { PrismaProgramRepository } from './program.repository.impl';
import { PROGRAM_REPOSITORY } from '../domain/program.repository';

@Module({
  imports: [AuthModule],
  controllers: [ProgramController],
  providers: [
    ProgramService,
    {
      provide: PROGRAM_REPOSITORY,
      useClass: PrismaProgramRepository,
    },
  ],
  exports: [ProgramService],
})
export class ProgramModule {}
