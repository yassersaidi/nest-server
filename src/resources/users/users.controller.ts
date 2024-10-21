import {
  Controller,
  Get, UseGuards
} from '@nestjs/common';
import { UsersService } from './users.service';
import { IsAuthed } from 'src/guards/is.authed.gaurd';
import { IsAdmin } from 'src/guards/is.admin.gaurd';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @UseGuards(IsAuthed, IsAdmin)
  @Get('/all')
  getAllUsers() {
    return this.usersService.getAll()
  }

}
