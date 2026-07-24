import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/infrastructure/auth.module';
import { CourseController } from './course.controller';
import { CourseService } from '../application/course.service';
import { PrismaCourseRepository } from './course.repository.impl';
import { COURSE_REPOSITORY } from '../domain/course.repository';

@Module({
  imports: [AuthModule],
  controllers: [CourseController],
  providers: [
    CourseService,
    {
      provide: COURSE_REPOSITORY,
      useClass: PrismaCourseRepository,
    },
  ],
  exports: [CourseService],
})
export class CourseModule {}
