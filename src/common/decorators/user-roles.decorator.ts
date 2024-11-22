import { Reflector } from '@nestjs/core';
import { UserRoles } from '../enums/user-roles.enum';
export const AccessRoles = Reflector.createDecorator<UserRoles[]>();
