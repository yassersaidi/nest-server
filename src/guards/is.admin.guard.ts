import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";

@Injectable()
export class IsAdmin implements CanActivate {

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const role = request.role;

    if (role === "user") {
      throw new ForbiddenException('You are not authorized to access this resource');
    }

    return true;
  }
}
