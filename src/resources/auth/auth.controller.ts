import { Controller, Get, Post, Body, Patch, Delete, Res, UseGuards, Req, BadRequestException, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, Inject } from '@nestjs/common';
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
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { VerifyPhoneNumberDto } from './dto/verify-phone-number.dto';
import { VerifyPhoneNumberCodeDto } from './dto/verify-phone-number-code.dto';
import { UserReq, UserReqType } from '@/decorators/user.decorator';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly authService: AuthService,
    private readonly userService: UsersService) { }

  // @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post("/register")
  createUser(@Body() CreateUserDto: CreateUserDto) {
    return this.userService.create(CreateUserDto);
  }

  // @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Post("/login")
  async login(
    @Req() req: Request,
    @Body() loginDto: loginDto,
    @Res({ passthrough: true }) res: Response
  ) {

    const user = await this.userService.findUser(loginDto.email)
    const { ipAddress, deviceInfo } = await this.authService.getUserDeviceInfo(req)
    const { accessToken, refreshToken, userId } = await this.authService.login(user, loginDto, ipAddress, deviceInfo);

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
  async getMe(@UserReq() user: UserReqType) {
    const cachedUserData = await this.cacheManager.get(user.userId)
    if(cachedUserData){
      return cachedUserData
    }
    const dbUserData = await this.userService.getMe(user.userId)
    await this.cacheManager.set(user.userId, dbUserData, 5000)
    return dbUserData
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

    return { message: 'Profile picture uploaded successfully', path: file.path.replace("static", "") };
  }

  @UseGuards(IsAuthed)
  @Delete("/me")
  async deleteMe(@UserReq() user: UserReqType, @Res() res: Response) {
    const { message } = await this.userService.deleteUser(user.userId)

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
  async sendVerificationCodeEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    const { email } = verifyEmailDto
    const user = await this.userService.findUser(email)
    if (user.isEmailVerified) {
      return { message: "User already verified" }
    }

    const { message } = await this.authService.verifyEmail(email, user)
    return message
  }

  @Post('/verify-email-code')
  async verifyEmailCode(@Body() verifyCodeDto: VerifyCodeDto) {
    const { email, code } = verifyCodeDto;

    const user = await this.userService.findUser(email);

    if (user.isEmailVerified) {
      return { message: "User already verified" };
    }

    const isValid = await this.authService.verifyEmailCode(user, code);
    if (!isValid) {
      throw new BadRequestException("Invalid or expired verification code");
    }

    await this.userService.updateUser(user.id, { isEmailVerified: true });

    return { message: "User successfully verified" };
  }

  @Post('/verify-phone-number')
  async sendVerificationCodePhone(@Body() verifyPhoneNumberDto: VerifyPhoneNumberDto) {
    const { phoneNumber, email } = verifyPhoneNumberDto
    const user = await this.userService.findUser(email)
    if (user.isPhoneNumberVerified) {
      return { message: "User already verified" }
    }

    const { message } = await this.authService.verifyPhoneNumber(phoneNumber, user)
    return message
  }

  @Post('/verify-phone-code')
  async verifyPhoneNumberCode(@Body() verifyPhoneNumberCodeDto: VerifyPhoneNumberCodeDto) {
    const { email, phoneNumber, code } = verifyPhoneNumberCodeDto;

    const user = await this.userService.findUser(email);

    if (user.isPhoneNumberVerified) {
      return { message: "User already verified" };
    }

    const isValid = await this.authService.verifyPhoneNumberCode(user, code)
    if (!isValid) {
      throw new BadRequestException("Invalid or expired verification code");
    }

    await this.userService.updateUser(user.id, { isPhoneNumberVerified: true });

    return { message: "User successfully verified" };
  }

  @Post('/forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.userService.findUser(email);

    const { message } = await this.authService.forgotPassword(user, email);

    if (!message) {
      throw new BadRequestException('Failed to send the reset code. Please try again.');
    }

    return message
  }

  @Post('/reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const { email, code, password } = resetPasswordDto;
    const user = await this.userService.findUser(email);
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
    const { email } = verifyEmailDto
    const user = await this.userService.findUser(email)
    return this.authService.addAdmin(user)
  }

}
