export abstract class Repository<TEntity> {
  public abstract save(entity: TEntity): Promise<void>;
  public abstract findById(id: string): Promise<TEntity | null>;
  public abstract findMany(): Promise<TEntity[]>;
  public abstract update(id: string, entity: TEntity): Promise<void>;
  public abstract delete(id: string): Promise<boolean>;
}
