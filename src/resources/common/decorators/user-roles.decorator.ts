import { UserRoles } from '../enums/user-roles.enum';
import { Reflector } from '@nestjs/core';
export const AccessRoles = Reflector.createDecorator<UserRoles[]>();
