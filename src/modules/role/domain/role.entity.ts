import { Entity } from '@core/domain/entity.base';

export interface RoleProps {
  institutionId: string | null;
  name: string;
  isStudent: boolean;
  isMaster: boolean;
  isEditable: boolean;
}

export class Role extends Entity<RoleProps> {
  public get institutionId(): string | null {
    return this.props.institutionId;
  }

  public get name(): string {
    return this.props.name;
  }

  public get isStudent(): boolean {
    return this.props.isStudent;
  }

  public get isMaster(): boolean {
    return this.props.isMaster;
  }

  public get isEditable(): boolean {
    return this.props.isEditable;
  }
}
