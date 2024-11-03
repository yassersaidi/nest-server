import {
  Controller,
  Get, Query, UseGuards
} from '@nestjs/common';
import { UsersService } from './users.service';
import { IsAuthed } from '@/guards/is.authed.guard';
import { IsAdmin } from '@/guards/is.admin.guard';
import { SearchUsersQueryDto } from './dto/search-users.dto';

@Controller('users')
export class UsersController {  
  constructor(private readonly usersService: UsersService) { }

  @UseGuards(IsAuthed, IsAdmin)
  @Get('/all')
  getAllUsers() {
    return this.usersService.getAll()
  }


  @UseGuards(IsAuthed)
  @Get("/search")
  searchInUsers(@Query() searchUsersQuery: SearchUsersQueryDto){
    return this.usersService.searchUsers(searchUsersQuery)
  }


}
