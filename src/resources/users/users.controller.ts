import {
  Controller,
  Get, Inject, Query, UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { UsersService } from './users.service';
import { IsAuthed } from '@/resources/common/guards/is.authed.guard';
import { SearchUsersQueryDto } from './dto/search-users.dto';
import { UserRolesGuard } from '@/resources/common/guards/user-roles.guard';
import { AccessRoles } from '../common/decorators/user-roles.decorator';
import { UserRoles } from '../common/enums/user-roles.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { UserInterceptor } from './interceptors/users.interceptor';
import { GetUsersQueryDto } from './dto/get-users.dto';

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
  async getAllUsers(@Query() getUsersQuery: GetUsersQueryDto) {
    const cachedUsers = await this.cacheManager.get("users")
    if (cachedUsers) {
      return cachedUsers
    }
    const users = await this.usersService.getAll(getUsersQuery)
    await this.cacheManager.set("users", users, 10000)
    return users
  }


  @UseGuards(IsAuthed)
  @UseInterceptors(UserInterceptor)
  @Get("/search")
  searchInUsers(@Query() searchUsersQuery: SearchUsersQueryDto) {
    return this.usersService.searchUsers(searchUsersQuery)
  }


}
