import { Entity } from '@core/domain/entity.base';

export interface RoleProps {
  name: string;
  isStudent: boolean;
  isEditable: boolean;
}

export class Role extends Entity<RoleProps> {
  public get name(): string {
    return this.props.name;
  }

  public get isStudent(): boolean {
    return this.props.isStudent;
  }

  public get isEditable(): boolean {
    return this.props.isEditable;
  }
}
