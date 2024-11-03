import { Admin } from "@/resources/users/entities/admin.entity";
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

@Injectable()
export class IsAdmin implements CanActivate {
  constructor(@InjectRepository(Admin) private readonly admins: Repository<Admin>) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.userId;

    if (!userId) {
      throw new ForbiddenException('You are not authorized to access this resource');
    }

    const user = await this.admins.findOne({
      where: {
        user: {
          id: userId
        }
      }
    })

    if (!user) {
      throw new ForbiddenException('You must be an admin to access this resource');
    }

    return true;
  }
}
