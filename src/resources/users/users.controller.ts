import {
  Controller,
  Get, Inject, Query, UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { UsersService } from './users.service';
import { IsAuthed } from '@/guards/is.authed.guard';
import { SearchUsersQueryDto } from './dto/search-users.dto';
import { UserRolesGuard } from '@/guards/user-roles.guard';
import { AccessRoles } from '../common/decorators/user-roles.decorator';
import { UserRoles } from '../common/enums/user-roles.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { UserInterceptor } from './interceptors/users.interceptor';

@UseGuards(IsAuthed, UserRolesGuard)
@UseInterceptors(UserInterceptor)
@Controller('users')
export class UsersController {

  constructor(
    private readonly usersService: UsersService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) { }

  @AccessRoles([UserRoles.ADMIN])
  @Get('/all')
  async getAllUsers() {
    const cachedUsers = await this.cacheManager.get("users")
    if (cachedUsers) {
      return cachedUsers
    }
    const users = await this.usersService.getAll()
    await this.cacheManager.set("users", users)
    return users
  }


  @UseGuards(IsAuthed)
  @UseInterceptors(UserInterceptor)
  @Get("/search")
  searchInUsers(@Query() searchUsersQuery: SearchUsersQueryDto) {
    return this.usersService.searchUsers(searchUsersQuery)
  }


}
