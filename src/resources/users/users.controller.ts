import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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
