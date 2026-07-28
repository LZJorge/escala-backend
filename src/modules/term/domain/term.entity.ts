import { Entity } from '@core/domain/entity.base';
import type { TermStatus } from '@prisma/client';

export interface TermProps {
  name: string;
  startDate: Date;
  endDate: Date;
  status: TermStatus;
}

export class Term extends Entity<TermProps> {
  public get name(): string {
    return this.props.name;
  }

  public get startDate(): Date {
    return this.props.startDate;
  }

  public get endDate(): Date {
    return this.props.endDate;
  }

  public get status(): TermStatus {
    return this.props.status;
  }
}
