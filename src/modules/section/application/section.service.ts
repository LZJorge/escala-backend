import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@core/domain/result';
import { SECTION_REPOSITORY } from '../domain/section.repository';
import type {
  SectionRepository,
  SectionWithSchedules,
} from '../domain/section.repository';
import { CourseSection } from '../domain/course-section.entity';
import { SectionSchedule } from '../domain/section-schedule.entity';
import type { DayOfWeek } from '@prisma/client';

@Injectable()
export class SectionService {
  constructor(
    @Inject(SECTION_REPOSITORY)
    private readonly repository: SectionRepository,
  ) {}

  public async create(params: {
    courseId: string;
    termId: string;
    teacherId: string;
    name: string;
    capacity: number;
    schedules?: Array<{
      dayOfWeek: DayOfWeek;
      startTime: string;
      endTime: string;
      roomIdentifier?: string;
    }>;
  }): Promise<
    Result<{
      id: string;
      courseId: string;
      termId: string;
      teacherId: string;
      name: string;
      capacity: number;
      createdAt: string;
      schedules: Array<{
        id: string;
        dayOfWeek: string;
        startTime: string;
        endTime: string;
        roomIdentifier: string | null;
      }>;
    }>
  > {
    const termStatus = await this.repository.getTermStatus(params.termId);

    if (!termStatus) {
      return Result.fail('Term not found');
    }

    if (termStatus === 'CLOSED') {
      return Result.fail('Cannot create sections in a closed term');
    }

    const isCourseAvailable = await this.repository.isCourseAvailable(
      params.courseId,
    );

    if (!isCourseAvailable) {
      return Result.fail('Cannot create a section for an unavailable course');
    }

    const isTeacher = await this.repository.isTeacher(params.teacherId);

    if (!isTeacher) {
      return Result.fail('The assigned teacher is not a teacher');
    }

    if (params.schedules) {
      for (const s of params.schedules) {
        if (s.endTime <= s.startTime) {
          return Result.fail(
            'endTime must be after startTime in each schedule',
          );
        }
      }
    }

    const section = new CourseSection({
      courseId: params.courseId,
      termId: params.termId,
      teacherId: params.teacherId,
      name: params.name,
      capacity: params.capacity,
    });

    const saved = await this.repository.create(section);

    let schedules: SectionSchedule[] = [];

    if (params.schedules && params.schedules.length > 0) {
      const scheduleEntities = params.schedules.map(
        (s: {
          dayOfWeek: DayOfWeek;
          startTime: string;
          endTime: string;
          roomIdentifier?: string;
        }) =>
          new SectionSchedule({
            sectionId: saved.id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            roomIdentifier: s.roomIdentifier ?? null,
          }),
      );

      schedules = await this.repository.createSchedules(scheduleEntities);
    }

    return Result.ok({
      id: saved.id,
      courseId: saved.courseId,
      termId: saved.termId,
      teacherId: saved.teacherId,
      name: saved.name,
      capacity: saved.capacity,
      createdAt: saved.createdAt.toISOString(),
      schedules: schedules.map((s: SectionSchedule) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        roomIdentifier: s.roomIdentifier,
      })),
    });
  }

  public async findAll(filters: {
    termId?: string;
    courseId?: string;
    teacherId?: string;
  }): Promise<
    Result<
      Array<{
        id: string;
        courseId: string;
        termId: string;
        teacherId: string;
        name: string;
        capacity: number;
        createdAt: string;
        schedules: Array<{
          id: string;
          dayOfWeek: string;
          startTime: string;
          endTime: string;
          roomIdentifier: string | null;
        }>;
      }>
    >
  > {
    const items = await this.repository.findAll(filters);

    return Result.ok(
      items.map((item: SectionWithSchedules) => ({
        id: item.section.id,
        courseId: item.section.courseId,
        termId: item.section.termId,
        teacherId: item.section.teacherId,
        name: item.section.name,
        capacity: item.section.capacity,
        createdAt: item.section.createdAt.toISOString(),
        schedules: item.schedules.map((s: SectionSchedule) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          roomIdentifier: s.roomIdentifier,
        })),
      })),
    );
  }

  public async findById(id: string): Promise<
    Result<{
      id: string;
      courseId: string;
      termId: string;
      teacherId: string;
      name: string;
      capacity: number;
      createdAt: string;
      schedules: Array<{
        id: string;
        dayOfWeek: string;
        startTime: string;
        endTime: string;
        roomIdentifier: string | null;
      }>;
    }>
  > {
    const item = await this.repository.findById(id);

    if (!item) {
      return Result.fail('Section not found');
    }

    return Result.ok({
      id: item.section.id,
      courseId: item.section.courseId,
      termId: item.section.termId,
      teacherId: item.section.teacherId,
      name: item.section.name,
      capacity: item.section.capacity,
      createdAt: item.section.createdAt.toISOString(),
      schedules: item.schedules.map((s: SectionSchedule) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        roomIdentifier: s.roomIdentifier,
      })),
    });
  }

  public async update(
    id: string,
    params: { name?: string; capacity?: number; teacherId?: string },
  ): Promise<
    Result<{
      id: string;
      courseId: string;
      termId: string;
      teacherId: string;
      name: string;
      capacity: number;
      createdAt: string;
      schedules: Array<{
        id: string;
        dayOfWeek: string;
        startTime: string;
        endTime: string;
        roomIdentifier: string | null;
      }>;
    }>
  > {
    const existing = await this.repository.findById(id);

    if (!existing) {
      return Result.fail('Section not found');
    }

    const termStatus = await this.repository.getTermStatus(
      existing.section.termId,
    );

    if (termStatus === 'CLOSED') {
      return Result.fail('Cannot modify a section in a closed term');
    }

    if (
      params.capacity !== undefined &&
      params.capacity < existing.section.capacity
    ) {
      const enrolled = await this.repository.countEnrollments(id);

      if (enrolled > params.capacity) {
        return Result.fail(
          `Cannot reduce capacity to ${params.capacity}: ${enrolled} students are already enrolled`,
        );
      }
    }

    const updated = new CourseSection(
      {
        courseId: existing.section.courseId,
        termId: existing.section.termId,
        teacherId: params.teacherId ?? existing.section.teacherId,
        name: params.name ?? existing.section.name,
        capacity: params.capacity ?? existing.section.capacity,
      },
      existing.section.id,
    );

    const saved = await this.repository.update(updated);

    return Result.ok({
      id: saved.id,
      courseId: saved.courseId,
      termId: saved.termId,
      teacherId: saved.teacherId,
      name: saved.name,
      capacity: saved.capacity,
      createdAt: saved.createdAt.toISOString(),
      schedules: existing.schedules.map((s: SectionSchedule) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        roomIdentifier: s.roomIdentifier,
      })),
    });
  }

  public async delete(id: string): Promise<Result<void>> {
    const existing = await this.repository.findById(id);

    if (!existing) {
      return Result.fail('Section not found');
    }

    const termStatus = await this.repository.getTermStatus(
      existing.section.termId,
    );

    if (termStatus === 'CLOSED') {
      return Result.fail('Cannot delete a section in a closed term');
    }

    const enrollments = await this.repository.countEnrollments(id);

    if (enrollments > 0) {
      return Result.fail('Cannot delete section with active enrollments');
    }

    const assessments = await this.repository.countAssessments(id);

    if (assessments > 0) {
      return Result.fail('Cannot delete section with existing assessments');
    }

    await this.repository.softDelete(id);

    return Result.ok(undefined);
  }

  public async addSchedule(
    sectionId: string,
    params: {
      dayOfWeek: DayOfWeek;
      startTime: string;
      endTime: string;
      roomIdentifier?: string;
    },
  ): Promise<
    Result<{
      id: string;
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      roomIdentifier: string | null;
    }>
  > {
    if (params.endTime <= params.startTime) {
      return Result.fail('endTime must be after startTime');
    }

    const existing = await this.repository.findById(sectionId);

    if (!existing) {
      return Result.fail('Section not found');
    }

    const termStatus = await this.repository.getTermStatus(
      existing.section.termId,
    );

    if (termStatus === 'CLOSED') {
      return Result.fail('Cannot modify a section in a closed term');
    }

    const teacherConflicts = await this.repository.findTeacherConflicts(
      existing.section.termId,
      existing.section.teacherId,
      params.dayOfWeek,
      params.startTime,
      params.endTime,
      sectionId,
    );

    if (teacherConflicts.length > 0) {
      return Result.fail(
        `Teacher already has a conflicting schedule: ${teacherConflicts[0].sectionName} (${teacherConflicts[0].startTime}-${teacherConflicts[0].endTime})`,
      );
    }

    if (params.roomIdentifier) {
      const roomConflicts = await this.repository.findRoomConflicts(
        existing.section.termId,
        params.roomIdentifier,
        params.dayOfWeek,
        params.startTime,
        params.endTime,
        sectionId,
      );

      if (roomConflicts.length > 0) {
        return Result.fail(
          `Room ${params.roomIdentifier} is already occupied: ${roomConflicts[0].sectionName} (${roomConflicts[0].startTime}-${roomConflicts[0].endTime})`,
        );
      }
    }

    const schedule = new SectionSchedule({
      sectionId,
      dayOfWeek: params.dayOfWeek,
      startTime: params.startTime,
      endTime: params.endTime,
      roomIdentifier: params.roomIdentifier ?? null,
    });

    const saved = await this.repository.addSchedule(schedule);

    return Result.ok({
      id: saved.id,
      dayOfWeek: saved.dayOfWeek,
      startTime: saved.startTime,
      endTime: saved.endTime,
      roomIdentifier: saved.roomIdentifier,
    });
  }

  public async deleteSchedule(
    sectionId: string,
    scheduleId: string,
  ): Promise<Result<void>> {
    const existing = await this.repository.findById(sectionId);

    if (!existing) {
      return Result.fail('Section not found');
    }

    await this.repository.deleteSchedule(scheduleId);

    return Result.ok(undefined);
  }
}
