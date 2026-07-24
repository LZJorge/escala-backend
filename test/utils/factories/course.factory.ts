import { Course } from '@modules/course/domain/course.entity';

export function buildCourseProps(
  overrides?: Partial<{
    programId: string;
    code: string;
    name: string;
    credits: number;
    termLevel: number;
  }>,
): {
  programId: string;
  code: string;
  name: string;
  credits: number;
  termLevel: number;
} {
  return {
    programId: '550e8400-e29b-41d4-a716-446655440000',
    code: 'CS101',
    name: 'Intro to CS',
    credits: 4,
    termLevel: 1,
    ...overrides,
  };
}

export function buildCourse(
  overrides?: Partial<{
    programId: string;
    code: string;
    name: string;
    credits: number;
    termLevel: number;
  }>,
  id?: string,
): Course {
  return new Course(buildCourseProps(overrides), id ?? 'test-course-id');
}
