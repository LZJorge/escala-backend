import { Entity } from '@core/domain/entity.base';

export interface CourseProps {
  programId: string;
  code: string;
  name: string;
  credits: number;
  termLevel: number;
}

export class Course extends Entity<CourseProps> {
  public get programId(): string {
    return this.props.programId;
  }

  public get code(): string {
    return this.props.code;
  }

  public get name(): string {
    return this.props.name;
  }

  public get credits(): number {
    return this.props.credits;
  }

  public get termLevel(): number {
    return this.props.termLevel;
  }
}
