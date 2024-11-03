import { Controller, Get, Post, Body, Patch, Delete, Res, NotFoundException, UseGuards, Req, BadRequestException, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { AuthService } from './auth.service';
import { loginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { Response, Request } from 'express';
import { IsAuthed } from '@/guards/is.authed.guard';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forget-password.dto';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UsersService) { }

  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post("/register")
  createUser(@Body() CreateUserDto: CreateUserDto) {
    return this.userService.create(CreateUserDto);
  }

  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Post("/login")
  async login(
    @Body() loginDto: loginDto,
    @Res({ passthrough: true }) res: Response
  ) {

    const user = await this.userService.findByEmail(loginDto.email)
    if (!user) {
      throw new NotFoundException("No user found")
    }

    const { accessToken, refreshToken, userId } = await this.authService.login(user, loginDto);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 1000,
      secure: true,
      sameSite: 'lax',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: true,
      sameSite: 'lax',
    });

    return { message: 'Login successful', userId };
  }


  @UseGuards(IsAuthed)
  @Get("/me")
  getMe(@Req() req: Request) {
    return this.userService.getMe(req.userId)
  }

  @UseGuards(IsAuthed)
  @Patch("/uploads/profile")
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: "static/uploads/profile",
      filename: (req, file, cb) => {
        const { username } = req
        const ext = file.mimetype.split("/")[1]
        console.log(file)
        const filename = `${username}_profile.${ext}`;
        cb(null, filename);
      },
    }), 
  }))
  updateProfilePicture(@UploadedFile(
    new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: 1000000, message: "Picture should be less then 1mb." }),
        new FileTypeValidator({ fileType: /^(image\/jpeg|image\/png)$/ }),
      ],
    }),) file: Express.Multer.File) {

    return { message: 'Profile picture uploaded successfully', path: file.path.replace("static","")};
  }

  @UseGuards(IsAuthed)
  @Delete("/me")
  async deleteMe(@Req() req, @Res() res: Response) {
    const { message } = await this.userService.deleteUser(req.userId)

    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });

    return message
  }

  @UseGuards(IsAuthed)
  @Post('/logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies["refreshToken"]
    if (!refreshToken) {
      throw new BadRequestException("No refresh token provided")
    }
    return this.authService.logout(refreshToken, res);
  }

  @Post('/verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    const { email } = verifyEmailDto
    const user = await this.userService.findByEmail(email)
    if (!user) {
      throw new BadRequestException("No User found")
    }
    if (user.verified) {
      return { message: "User already verified" }
    }

    const { message } = await this.authService.verifyEmail(email, user)
    return message
  }

  @Post('/verify-code')
  async verifyCode(@Body() verifyCodeDto: VerifyCodeDto) {
    const { email, code } = verifyCodeDto;

    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new BadRequestException("Invalid credentials");
    }

    if (user.verified) {
      return { message: "User already verified" };
    }

    const isVerified = await this.authService.verifyCode(user, code);
    if (!isVerified) {
      throw new BadRequestException("Invalid or expired verification code");
    }

    await this.userService.updateUser(user.id, { verified: true });

    return { message: "User successfully verified" };
  }

  @Post('/forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }

    const { message } = await this.authService.forgotPassword(user, email);

    if (!message) {
      throw new BadRequestException('Failed to send the reset code. Please try again.');
    }

    return message
  }

  @Post('/reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const { email, code, password } = resetPasswordDto;
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }
    const { hashedPassword } = await this.authService.resetPassword(user, email, code, password);
    if (!hashedPassword) {
      throw new BadRequestException('Invalid or expired reset code.');
    }

    await this.userService.updateUser(user.id, { password: hashedPassword });

    return { message: 'Password successfully reset' };
  }

  @Post('/rt')
  async refreshToken(@Req() req: Request, @Res() res: Response) {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      throw new BadRequestException('Access denied, token missing!');
    }

    const { userId, accessToken } = await this.authService.refreshToken(refreshToken);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 1000,
      secure: true,
      sameSite: 'lax',
    });

    return res.json({ userId });
  }

  @Post('/admin')
  async addAmin(@Body() verifyEmailDto: VerifyEmailDto) {
    const {email} = verifyEmailDto
    const user = await this.userService.findByEmail(email)

    if(!user){
      throw new BadRequestException("Invalid credentials")
    }

    return this.authService.addAdmin(user)
  }

}
