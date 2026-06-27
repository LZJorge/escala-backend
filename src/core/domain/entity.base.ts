export abstract class Entity<T> {
  protected readonly _id: string;
  protected readonly props: T;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: T, id?: string) {
    this._id = id ?? crypto.randomUUID();
    this._createdAt = new Date();
    this._updatedAt = new Date();
    this.props = props;
  }

  public get id(): string {
    return this._id;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }
}
