import { Entity } from './entity.base';

export interface UserProps {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  ci: string;
  phone: string | null;
  isSuperAdmin: boolean;
}

export class User extends Entity<UserProps> {
  public get email(): string {
    return this.props.email;
  }

  public get passwordHash(): string {
    return this.props.passwordHash;
  }

  public get firstName(): string {
    return this.props.firstName;
  }

  public get lastName(): string {
    return this.props.lastName;
  }

  public get ci(): string {
    return this.props.ci;
  }

  public get phone(): string | null {
    return this.props.phone;
  }

  public get isSuperAdmin(): boolean {
    return this.props.isSuperAdmin;
  }
}
