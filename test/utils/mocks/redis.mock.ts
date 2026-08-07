export class PipelineMock {
  public readonly set = jest.fn().mockReturnThis();
  public readonly del = jest.fn().mockReturnThis();
  public readonly sadd = jest.fn().mockReturnThis();
  public readonly expire = jest.fn().mockReturnThis();
  public readonly get = jest.fn().mockReturnThis();
  public readonly smembers = jest.fn().mockReturnThis();
  public readonly exec = jest.fn().mockResolvedValue([]);
}

export class RedisServiceMock {
  public readonly get = jest.fn();
  public readonly set = jest.fn();
  public readonly delete = jest.fn();
  public readonly del = jest.fn();
  public readonly sadd = jest.fn();
  public readonly smembers = jest.fn();
  public readonly expire = jest.fn();
  public readonly pipeline = jest.fn();

  public constructor() {
    this.pipeline.mockReturnValue(new PipelineMock());
  }
}
