import { Entity } from '@core/domain/entity.base';
import type { DayOfWeek } from '@prisma/client';

export interface SectionScheduleProps {
  sectionId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  roomIdentifier: string | null;
}

export class SectionSchedule extends Entity<SectionScheduleProps> {
  public get sectionId(): string {
    return this.props.sectionId;
  }

  public get dayOfWeek(): DayOfWeek {
    return this.props.dayOfWeek;
  }

  public get startTime(): string {
    return this.props.startTime;
  }

  public get endTime(): string {
    return this.props.endTime;
  }

  public get roomIdentifier(): string | null {
    return this.props.roomIdentifier;
  }
}
