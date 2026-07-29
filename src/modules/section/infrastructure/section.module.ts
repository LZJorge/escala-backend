import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/infrastructure/auth.module';
import { SectionController } from './section.controller';
import { SectionService } from '../application/section.service';
import { PrismaSectionRepository } from './section.repository.impl';
import { SECTION_REPOSITORY } from '../domain/section.repository';

@Module({
  imports: [AuthModule],
  controllers: [SectionController],
  providers: [
    SectionService,
    {
      provide: SECTION_REPOSITORY,
      useClass: PrismaSectionRepository,
    },
  ],
  exports: [SectionService],
})
export class SectionModule {}
