export class Result<T> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  public readonly error: string | null;
  private readonly _value: T | null;

  private constructor(isSuccess: boolean, error?: string | null, value?: T) {
    if (isSuccess && error) {
      throw new Error('An successful result cannot contain an error.');
    }
    if (!isSuccess && !error) {
      throw new Error('An failure result must contain an error.');
    }
    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this.error = error ?? null;
    this._value = value ?? null;
  }

  public get value(): T {
    if (!this.isSuccess) {
      throw new Error('Cannot get the value of a failure result.');
    }
    return this._value as T;
  }

  public static ok<U>(value?: U): Result<U> {
    return new Result<U>(true, null, value);
  }

  public static fail<U>(error: string): Result<U> {
    return new Result<U>(false, error);
  }
}
