import { AccessRoles } from '@/common/decorators/user-roles.decorator';
import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { DefaultHttpException } from '../errors/error/custom-error.error';

@Injectable()
export class UserRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const accessRoles = this.reflector.get(AccessRoles, context.getHandler());
    if (!accessRoles) {
      return true;
    }
    const request: Request = context.switchToHttp().getRequest();
    const role = request.authedUser.role;

    if (!accessRoles.includes(role)) {
      throw new DefaultHttpException(
        'You are not authorized to access this resource',
        '',
        'Roles Guard',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return true;
  }
}
