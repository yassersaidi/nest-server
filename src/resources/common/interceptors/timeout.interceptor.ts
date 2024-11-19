import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { DefaultHttpException } from '../errors/error/custom-error.error';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly timeout: number) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(this.timeout),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          throw new DefaultHttpException(
            `Request timed out after: ${this.timeout / 1000}s `,
            'The server took too long to respond, please try again later',
            'Server Timeout',
            HttpStatus.GATEWAY_TIMEOUT,
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
