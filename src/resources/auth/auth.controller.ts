import { Controller, Get, Post, Body, Patch, Delete, Res, UseGuards, Req, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, Inject, HttpCode, HttpStatus, UseFilters } from '@nestjs/common';
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
import { AuthedUserReq } from '@/resources/common/decorators/authed-user.decorator';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { AuthFilter } from '../common/errors/filters/auth.filter';
import { DefaultHttpException } from '../common/errors/error/custom-error.error';
import { Throttle } from '@nestjs/throttler';
import { AuthedUserReqType } from './interfaces/authed-user.interface';

@UseFilters(AuthFilter)
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly authService: AuthService,
    private readonly userService: UsersService) { }

  @Get("")
  async f() {
    await new Promise(resolve => setTimeout(resolve, 6000))
    return "h"
  }

  // @Throttle({ default: { limit: 5, ttl: 300000 } })
  @HttpCode(HttpStatus.OK)
  @Post("/register")
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Throttle({ default: { limit: 1, ttl: 5000 } })
  @Post("/login")
  async login(
    @Req() req: Request,
    @Body() loginDto: loginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const { email } = loginDto
    const user = await this.userService.findUser({ email })
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

    return { message: 'Login successful', userId, accessToken };
  }

  @UseGuards(IsAuthed)
  @Get("/me")
  async getMe(@AuthedUserReq() user: AuthedUserReqType) {
    const cachedUserData = await this.cacheManager.get(user.userId)
    if (cachedUserData) {
      return cachedUserData
    }
    const dbUserData = await this.userService.getMe(user.userId)
    await this.cacheManager.set(user.userId, dbUserData)
    return dbUserData
  }

  @UseGuards(IsAuthed)
  @Patch("/uploads/profile")
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: "static/uploads/profile",
      filename: (req, file, cb) => {
        const { username } = req.authedUser
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

  @HttpCode(HttpStatus.OK)
  @UseGuards(IsAuthed)
  @Delete("/me")
  async deleteMe(@AuthedUserReq() user: AuthedUserReqType, @Res() res: Response) {
    const { message } = await this.userService.deleteUser(user.userId)

    return message
  }

  @UseGuards(IsAuthed)
  @Post('/logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies["refreshToken"]
    if (!refreshToken) {
      throw new DefaultHttpException(
        "Invalid refresh token",
        "Please login again",
        "Tokens Service",
        HttpStatus.UNAUTHORIZED
      );
    }
    return this.authService.logout(refreshToken, res);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/verify-email')
  async sendVerificationCodeEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    const { email } = verifyEmailDto
    const user = await this.userService.findUser({ email })
    if (user.isEmailVerified) {
      return { message: "User already verified" }
    }

    const { message } = await this.authService.verifyEmail(email, user.id)
    return message
  }

  @HttpCode(HttpStatus.OK)
  @Post('/verify-email-code')
  async verifyEmailCode(@Body() verifyCodeDto: VerifyCodeDto) {
    const { email, code } = verifyCodeDto;

    const user = await this.userService.findUser({ email });

    if (user.isEmailVerified) {
      return { message: "User already verified" };
    }

    await this.authService.verifyEmailCode(user, code);

    await this.userService.updateUser(user.id, { isEmailVerified: true });

    return { message: "User successfully verified" };
  }

  @HttpCode(HttpStatus.OK)
  @Post('/verify-phone-number')
  async sendVerificationCodePhone(@Body() verifyPhoneNumberDto: VerifyPhoneNumberDto) {
    const { phoneNumber } = verifyPhoneNumberDto
    const user = await this.userService.findUser({ phoneNumber })
    if (user.isPhoneNumberVerified) {
      return { message: "User already verified" }
    }
    const { message } = await this.authService.verifyPhoneNumber(phoneNumber, user.id)
    return message
  }

  @HttpCode(HttpStatus.OK)
  @Post('/verify-phone-code')
  async verifyPhoneNumberCode(@Body() verifyPhoneNumberCodeDto: VerifyPhoneNumberCodeDto) {
    const { phoneNumber, code } = verifyPhoneNumberCodeDto;

    const user = await this.userService.findUser({ phoneNumber });

    if (user.isPhoneNumberVerified) {
      return { message: "User already verified" };
    }

    await this.authService.verifyPhoneNumberCode(user.id, code)

    await this.userService.updateUser(user.id, { isPhoneNumberVerified: true });

    return { message: "User successfully verified" };
  }

  @HttpCode(HttpStatus.OK)
  @Post('/forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.userService.findUser({ email });

    const { message } = await this.authService.forgotPassword(user, email);

    return message
  }

  @HttpCode(HttpStatus.OK)
  @Post('/reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const { email, code, password } = resetPasswordDto;
    const user = await this.userService.findUser({ email });
    const { hashedPassword } = await this.authService.resetPassword(user, code, password);
    await this.userService.updateUser(user.id, { password: hashedPassword });

    return { message: 'Password successfully reset' };
  }

  @HttpCode(HttpStatus.OK)
  @Post('/rt')
  async refreshToken(@Req() req: Request, @Res() res: Response) {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      throw new DefaultHttpException(
        "Access denied, token missing!",
        "Please login again",
        "Tokens Service",
        HttpStatus.UNAUTHORIZED
      );
    }
    const { ipAddress, deviceInfo } = await this.authService.getUserDeviceInfo(req)

    const { userId, accessToken, newRefreshToken } = await this.authService.refreshToken(refreshToken, ipAddress, deviceInfo);


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
    return res.json({ userId, accessToken, refreshToken });
  }

  @UseGuards(IsAuthed)
  @HttpCode(HttpStatus.OK)
  @Get("/sessions")
  async getSessions(@AuthedUserReq() user: AuthedUserReqType) {
    const sessions = await this.authService.getSessions(user.userId)
    return sessions
  }


  @Post('/admin')
  async addAmin(@Body() verifyEmailDto: VerifyEmailDto) {
    const { email } = verifyEmailDto
    const user = await this.userService.findUser({ email })
    await this.authService.isNotAdmin(user)
    await this.userService.updateUser(user.id, { role: "ADMIN" })
  }
}
