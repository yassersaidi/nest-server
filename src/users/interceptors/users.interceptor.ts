import { UserRoles } from '@/common/enums/user-roles.enum';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  UserResponse,
  UserSchemaType,
  UserSearchType,
} from '../interfaces/users-search.interface';

@Injectable()
export class UserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request: Request = context.switchToHttp().getRequest();
    const { role } = request.authedUser;
    return next.handle().pipe(
      map((data) => {
        const searchData = this.cleanData(data, role);
        return searchData;
      }),
    );
  }

  private cleanData = (data: UserSchemaType[], role: UserRoles) => {
    return data.map((user) => {
      if (role === UserRoles.ADMIN || role === UserRoles.SUPER_ADMIN) {
        /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
        const { password, ...userResponse } = user;
        return userResponse as UserResponse;
      } else {
        const { id, email, username, profilePicture } = user;
        return { id, email, username, profilePicture } as UserSearchType;
      }
    });
  };
}
