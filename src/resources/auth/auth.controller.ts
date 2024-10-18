import { Controller, Get, Post, Body, Patch, Param, Delete, Res, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { loginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { Response } from 'express';


@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UsersService) { }

  @Post("/register")
  createUser(@Body() CreateUserDto: CreateUserDto) {
    return this.userService.create(CreateUserDto);
  }

  @Post("/login")
  async login(
    @Body() loginDto: loginDto,
    @Res({passthrough: true}) res: Response
  ) {
    const user = await this.userService.findByEmail(loginDto.email)
    if(!user){
      throw new NotFoundException("No user found")
    }
    const {accessToken, refreshToken, userId} = await this.authService.login(user, loginDto);

    res.cookie('accessToken', accessToken, {
      httpOnly: true, 
      maxAge: 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'strict', 
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return { message: 'Login successful', userId };
  }

}
