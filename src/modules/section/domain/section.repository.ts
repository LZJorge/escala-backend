import { CourseSection } from './course-section.entity';
import { SectionSchedule } from './section-schedule.entity';

export const SECTION_REPOSITORY = Symbol('SECTION_REPOSITORY');

export interface ScheduleConflict {
  sectionId: string;
  sectionName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomIdentifier: string | null;
  conflictingTeacherId?: string;
}

export interface SectionWithSchedules {
  section: CourseSection;
  schedules: SectionSchedule[];
}

export interface SectionRepository {
  getTermStatus(termId: string): Promise<string | null>;
  isTeacher(userId: string): Promise<boolean>;
  isCourseAvailable(courseId: string): Promise<boolean>;
  getCourseProgramId(courseId: string): Promise<string | null>;
  create(section: CourseSection): Promise<CourseSection>;
  createSchedules(schedules: SectionSchedule[]): Promise<SectionSchedule[]>;
  findAll(filters: {
    termId?: string;
    courseId?: string;
    teacherId?: string;
  }): Promise<SectionWithSchedules[]>;
  findById(id: string): Promise<SectionWithSchedules | null>;
  update(section: CourseSection): Promise<CourseSection>;
  softDelete(id: string): Promise<void>;
  addSchedule(schedule: SectionSchedule): Promise<SectionSchedule>;
  deleteSchedule(scheduleId: string): Promise<void>;
  countEnrollments(sectionId: string): Promise<number>;
  countAssessments(sectionId: string): Promise<number>;
  findTeacherConflicts(
    termId: string,
    teacherId: string,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    excludeSectionId?: string,
  ): Promise<ScheduleConflict[]>;
  findRoomConflicts(
    termId: string,
    roomIdentifier: string,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    excludeSectionId?: string,
  ): Promise<ScheduleConflict[]>;
}
