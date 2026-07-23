import { Entity } from '@core/domain/entity.base';
import type { TermType } from '@prisma/client';

export interface ProgramProps {
  name: string;
  termType: TermType;
  totalCredits: number;
}

export class Program extends Entity<ProgramProps> {
  public get name(): string {
    return this.props.name;
  }

  public get termType(): TermType {
    return this.props.termType;
  }

  public get totalCredits(): number {
    return this.props.totalCredits;
  }
}
