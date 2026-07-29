import { Entity } from '@core/domain/entity.base';

export interface CourseSectionProps {
  courseId: string;
  termId: string;
  teacherId: string;
  name: string;
  capacity: number;
}

export class CourseSection extends Entity<CourseSectionProps> {
  public get courseId(): string {
    return this.props.courseId;
  }

  public get termId(): string {
    return this.props.termId;
  }

  public get teacherId(): string {
    return this.props.teacherId;
  }

  public get name(): string {
    return this.props.name;
  }

  public get capacity(): number {
    return this.props.capacity;
  }
}
