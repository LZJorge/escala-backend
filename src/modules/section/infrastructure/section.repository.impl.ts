import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { SectionRepository } from '../domain/section.repository';
import type {
  ScheduleConflict,
  SectionWithSchedules,
} from '../domain/section.repository';
import { CourseSection } from '../domain/course-section.entity';
import { SectionSchedule } from '../domain/section-schedule.entity';

import type {
  CourseSection as PrismaCourseSection,
  SectionSchedule as PrismaSectionSchedule,
} from '@prisma/client';

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);

  return h * 60 + m;
}

function timesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return (
    timeToMinutes(startA) < timeToMinutes(endB) &&
    timeToMinutes(endA) > timeToMinutes(startB)
  );
}

function timeToDateString(time: Date | string): string {
  if (typeof time === 'string') {
    return time.length <= 5 ? `${time}:00` : time;
  }

  return time.toISOString().slice(11, 19);
}

function timeStringToDate(t: string): Date {
  const [h, m, s = '00'] = t.split(':');

  return new Date(Date.UTC(1970, 0, 1, Number(h), Number(m), Number(s)));
}

@Injectable()
export class PrismaSectionRepository implements SectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async getTermStatus(termId: string): Promise<string | null> {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      select: { status: true },
    });

    return term?.status ?? null;
  }

  public async isTeacher(teacherId: string): Promise<boolean> {
    const record = await this.prisma.adminProfile.findFirst({
      where: {
        id: teacherId,
        roles: {
          some: {
            role: {
              permissions: {
                some: { permission: { code: 'teacher.teach' } },
              },
            },
          },
        },
      },
      select: { id: true },
    });

    return record !== null;
  }

  public async isCourseAvailable(courseId: string): Promise<boolean> {
    const record = await this.prisma.course.findUnique({
      where: { id: courseId, deletedAt: null },
      select: { id: true },
    });

    return record !== null;
  }

  public async getCourseProgramId(courseId: string): Promise<string | null> {
    const record = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { programId: true },
    });

    return record?.programId ?? null;
  }

  public async create(section: CourseSection): Promise<CourseSection> {
    const record = await this.prisma.courseSection.create({
      data: {
        id: section.id,
        courseId: section.courseId,
        termId: section.termId,
        teacherId: section.teacherId,
        name: section.name,
        capacity: section.capacity,
      },
    });

    return this.toSectionEntity(record);
  }

  public async createSchedules(
    schedules: SectionSchedule[],
  ): Promise<SectionSchedule[]> {
    const records = await this.prisma.$transaction(
      schedules.map((s: SectionSchedule) =>
        this.prisma.sectionSchedule.create({
          data: {
            id: s.id,
            sectionId: s.sectionId,
            dayOfWeek: s.dayOfWeek,
            startTime: timeStringToDate(s.startTime),
            endTime: timeStringToDate(s.endTime),
            roomIdentifier: s.roomIdentifier,
          },
        }),
      ),
    );

    return records.map((r: PrismaSectionSchedule) => this.toScheduleEntity(r));
  }

  public async findAll(filters: {
    termId?: string;
    courseId?: string;
    teacherId?: string;
  }): Promise<SectionWithSchedules[]> {
    const where: Record<string, unknown> = { deletedAt: null };

    if (filters.termId) {
      where.termId = filters.termId;
    }

    if (filters.courseId) {
      where.courseId = filters.courseId;
    }

    if (filters.teacherId) {
      where.teacherId = filters.teacherId;
    }

    const records = await this.prisma.courseSection.findMany({
      where,
      include: { schedules: true },
      orderBy: { id: 'desc' },
    });

    return records.map(
      (r: PrismaCourseSection & { schedules: PrismaSectionSchedule[] }) => ({
        section: this.toSectionEntity(r),
        schedules: r.schedules.map((s: PrismaSectionSchedule) =>
          this.toScheduleEntity(s),
        ),
      }),
    );
  }

  public async findById(id: string): Promise<SectionWithSchedules | null> {
    const record = await this.prisma.courseSection.findUnique({
      where: { id, deletedAt: null },
      include: { schedules: true },
    });

    if (!record) {
      return null;
    }

    return {
      section: this.toSectionEntity(record),
      schedules: record.schedules.map((s: PrismaSectionSchedule) =>
        this.toScheduleEntity(s),
      ),
    };
  }

  public async update(section: CourseSection): Promise<CourseSection> {
    const record = await this.prisma.courseSection.update({
      where: { id: section.id },
      data: {
        name: section.name,
        capacity: section.capacity,
        teacherId: section.teacherId,
      },
    });

    return this.toSectionEntity(record);
  }

  public async softDelete(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.sectionSchedule.deleteMany({ where: { sectionId: id } }),
      this.prisma.courseSection.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    ]);
  }

  public async addSchedule(
    schedule: SectionSchedule,
  ): Promise<SectionSchedule> {
    const record = await this.prisma.sectionSchedule.create({
      data: {
        id: schedule.id,
        sectionId: schedule.sectionId,
        dayOfWeek: schedule.dayOfWeek,
        startTime: timeStringToDate(schedule.startTime),
        endTime: timeStringToDate(schedule.endTime),
        roomIdentifier: schedule.roomIdentifier,
      },
    });

    return this.toScheduleEntity(record);
  }

  public async deleteSchedule(scheduleId: string): Promise<void> {
    await this.prisma.sectionSchedule.delete({
      where: { id: scheduleId },
    });
  }

  public async countEnrollments(sectionId: string): Promise<number> {
    return this.prisma.enrollment.count({
      where: { sectionId, status: 'ENROLLED' },
    });
  }

  public async countAssessments(sectionId: string): Promise<number> {
    return this.prisma.assessment.count({
      where: { sectionId },
    });
  }

  public async findTeacherConflicts(
    termId: string,
    teacherId: string,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    excludeSectionId?: string,
  ): Promise<ScheduleConflict[]> {
    const sections = await this.prisma.courseSection.findMany({
      where: {
        termId,
        teacherId,
        deletedAt: null,
        id: excludeSectionId ? { not: excludeSectionId } : undefined,
      },
      include: { schedules: true },
    });

    const conflicts: ScheduleConflict[] = [];

    for (const section of sections) {
      for (const schedule of section.schedules) {
        if (
          schedule.dayOfWeek === dayOfWeek &&
          timesOverlap(
            startTime,
            endTime,
            timeToDateString(schedule.startTime),
            timeToDateString(schedule.endTime),
          )
        ) {
          conflicts.push({
            sectionId: section.id,
            sectionName: section.name,
            dayOfWeek: schedule.dayOfWeek,
            startTime: timeToDateString(schedule.startTime),
            endTime: timeToDateString(schedule.endTime),
            roomIdentifier: schedule.roomIdentifier,
            conflictingTeacherId: teacherId,
          });
        }
      }
    }

    return conflicts;
  }

  public async findRoomConflicts(
    termId: string,
    roomIdentifier: string,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    excludeSectionId?: string,
  ): Promise<ScheduleConflict[]> {
    const sections = (await this.prisma.courseSection.findMany({
      where: {
        termId,
        deletedAt: null,
        id: excludeSectionId ? { not: excludeSectionId } : undefined,
      },
      include: {
        schedules: {
          where: { roomIdentifier, dayOfWeek: dayOfWeek as never },
        },
      },
    })) as unknown as Array<
      PrismaCourseSection & { schedules: PrismaSectionSchedule[] }
    >;

    const conflicts: ScheduleConflict[] = [];

    for (const section of sections) {
      for (const schedule of section.schedules) {
        if (
          timesOverlap(
            startTime,
            endTime,
            timeToDateString(schedule.startTime),
            timeToDateString(schedule.endTime),
          )
        ) {
          conflicts.push({
            sectionId: section.id,
            sectionName: section.name,
            dayOfWeek: schedule.dayOfWeek,
            startTime: timeToDateString(schedule.startTime),
            endTime: timeToDateString(schedule.endTime),
            roomIdentifier: schedule.roomIdentifier,
          });
        }
      }
    }

    return conflicts;
  }

  private toSectionEntity(record: PrismaCourseSection): CourseSection {
    return new CourseSection(
      {
        courseId: record.courseId,
        termId: record.termId,
        teacherId: record.teacherId,
        name: record.name,
        capacity: record.capacity,
      },
      record.id,
    );
  }

  private toScheduleEntity(record: PrismaSectionSchedule): SectionSchedule {
    return new SectionSchedule(
      {
        sectionId: record.sectionId,
        dayOfWeek: record.dayOfWeek,
        startTime: timeToDateString(record.startTime),
        endTime: timeToDateString(record.endTime),
        roomIdentifier: record.roomIdentifier,
      },
      record.id,
    );
  }
}
