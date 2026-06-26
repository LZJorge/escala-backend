import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/infrastructure/auth.module';
import { InstitutionController } from './institution.controller';
import { InstitutionService } from '../application/institution.service';
import { PrismaInstitutionRepository } from './institution.repository.impl';
import { INSTITUTION_REPOSITORY } from '../domain/institution.repository';

@Module({
  imports: [AuthModule],
  controllers: [InstitutionController],
  providers: [
    InstitutionService,
    { provide: INSTITUTION_REPOSITORY, useClass: PrismaInstitutionRepository },
  ],
  exports: [InstitutionService],
})
export class InstitutionModule {}
