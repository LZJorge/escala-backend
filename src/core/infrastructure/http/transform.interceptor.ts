import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { EnvelopeResponse } from './envelope-response.type';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  EnvelopeResponse<T>
> {
  public intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<EnvelopeResponse<T>> {
    return next.handle().pipe(
      map((res: T) => {
        if (res && typeof res === 'object' && 'meta' in res && 'data' in res) {
          return res as unknown as EnvelopeResponse<T>;
        }
        return { data: res };
      }),
    );
  }
}
