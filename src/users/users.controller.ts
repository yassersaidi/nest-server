import { IsAuthed } from '@/common/guards/is.authed.guard';
import { UserRolesGuard } from '@/common/guards/user-roles.guard';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Controller,
  Get,
  Inject,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Cache } from 'cache-manager';
import { AccessRoles } from '../common/decorators/user-roles.decorator';
import { UserRoles } from '../common/enums/user-roles.enum';
import { GetUsersQueryDto } from './dto/get-users.dto';
import { SearchUsersQueryDto } from './dto/search-users.dto';
import { UserInterceptor } from './interceptors/users.interceptor';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('AuthGuard')
@UseGuards(IsAuthed, UserRolesGuard)
@UseInterceptors(UserInterceptor)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @AccessRoles([UserRoles.ADMIN])
  @Get('/all')
  async getAllUsers(@Query() getUsersQuery: GetUsersQueryDto) {
    const cachedUsers = await this.cacheManager.get('users');
    if (cachedUsers) {
      return cachedUsers;
    }
    const users = await this.usersService.getAll(getUsersQuery);
    await this.cacheManager.set('users', users, 10000);
    return users;
  }

  @Get('/search')
  searchInUsers(@Query() searchUsersQuery: SearchUsersQueryDto) {
    return this.usersService.searchUsers(searchUsersQuery);
  }
}
