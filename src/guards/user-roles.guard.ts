import { AccessRoles } from "@/resources/common/decorators/user-roles.decorator";
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

@Injectable()
export class UserRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }
  async canActivate(context: ExecutionContext): Promise<boolean> {

    const accessRoles = this.reflector.get(AccessRoles, context.getHandler())
    if (!accessRoles) {
      return true
    }
    const request: Request = context.switchToHttp().getRequest();
    const role = request.authedUser.role;

    if (!accessRoles.includes(role)) {
      throw new ForbiddenException({
        message: "You are not authorized to access this resource",
        from: "Roles Guard"
      });
    }

    return true;
  }
}
