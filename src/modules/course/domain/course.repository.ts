import { Course } from './course.entity';

export const COURSE_REPOSITORY = Symbol('COURSE_REPOSITORY');

export interface CoursePrerequisiteRow {
  courseId: string;
  requiredCourseId: string | null;
  requiredCredits: number | null;
}

export interface CourseRepository {
  create(course: Course): Promise<Course>;
  findAllByProgram(programId: string): Promise<Course[]>;
  findById(id: string): Promise<Course | null>;
  update(course: Course): Promise<Course>;
  softDelete(id: string): Promise<void>;
  getPrerequisites(courseId: string): Promise<CoursePrerequisiteRow[]>;
  getPrerequisitesForCourses(
    courseIds: string[],
  ): Promise<CoursePrerequisiteRow[]>;
  setPrerequisites(
    courseId: string,
    prerequisites: Omit<CoursePrerequisiteRow, 'courseId'>[],
  ): Promise<void>;
}
