import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";
import { UsersService } from "src/resources/users/users.service";

@Injectable()
export class IsAdmin implements CanActivate {
  constructor(private readonly userService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.userId; 

    if (!userId) {
      throw new ForbiddenException('You are not authorized to access this resource');
    }

    const user = await this.userService.findById(userId);

    console.log(user.admin)

    if (!user || !user.admin) {  
      throw new ForbiddenException('You must be an admin to access this resource');
    }

    return true;
  }
}
