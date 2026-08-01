import { Entity } from '@core/domain/entity.base';

export interface RoleProps {
  name: string;
  isEditable: boolean;
}

export class Role extends Entity<RoleProps> {
  public get name(): string {
    return this.props.name;
  }

  public get isEditable(): boolean {
    return this.props.isEditable;
  }
}
