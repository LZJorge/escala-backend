import { Result } from '../domain/result';

export abstract class UseCase<IRequest, IResponse> {
  public abstract execute(
    request?: IRequest,
  ): Promise<Result<IResponse>> | Result<IResponse>;
}
