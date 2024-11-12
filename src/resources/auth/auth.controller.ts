import { Controller, Get, Post, Body, Patch, Delete, Res, UseGuards, Req, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, Inject, HttpCode, HttpStatus, UseFilters } from '@nestjs/common';
import { AuthService } from './auth.service';
import { loginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { Response, Request } from 'express';
import { IsAuthed } from '@/resources/common/guards/is.authed.guard';
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
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { ConfigService } from '@nestjs/config';
import { GeneratorService } from '../common/generators/generator.service';

@UseFilters(AuthFilter)
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly generatorService: GeneratorService,
    private readonly authService: AuthService,
    private readonly userService: UsersService) { }

  @Get("")
  async f() {
    await new Promise(resolve => setTimeout(resolve, 6000))
    return "h"
  }

  @Throttle({ default: { limit: 1, ttl: 5000 } })
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
    const { id, password, username, role } = user
    const { ipAddress, deviceInfo } = await this.authService.getUserDeviceInfo(req)
    const { accessToken, refreshToken, userId } = await this.authService.login(
      { id, password, username, role },
      loginDto,
      ipAddress,
      deviceInfo);

      const accessTokenMaxAge = parseInt(this.configService.get("ACCESS_TOKEN_COOKIE_MAX_AGE"));
      const refreshTokenMaxAge = parseInt(this.configService.get("REFRESH_TOKEN_COOKIE_MAX_AGE"));
      
      res.cookie('accessToken', accessToken, this.generatorService.generateCookieOptions(accessTokenMaxAge));
      res.cookie('refreshToken', refreshToken, this.generatorService.generateCookieOptions(refreshTokenMaxAge));

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
  async logout(@AuthedUserReq() user: AuthedUserReqType, @Res() res: Response) {
    const sessionId = user?.sessionId
    if (!sessionId) {
      throw new DefaultHttpException(
        "Invalid refresh token",
        "Please login again",
        "Tokens Service",
        HttpStatus.UNAUTHORIZED
      );
    }
    const { message } = await this.authService.logout(sessionId);

    res.clearCookie('accessToken', this.generatorService.generateCookieOptions());
    res.clearCookie('refreshToken', this.generatorService.generateCookieOptions());

    return message
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(IsAuthed)
  @Post('/verify-email')
  async sendVerificationCodeEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    const { email } = verifyEmailDto
    const user = await this.userService.findUser({ email })
    if (user.isEmailVerified) {
      return { message: "User email already verified!", userId: user.id }
    }

    const { message } = await this.authService.verifyEmail(user.id, email)
    return { message, userId: user.id }
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(IsAuthed)
  @Post('/verify-email-code')
  async verifyEmailCode(@Body() verifyCodeDto: VerifyCodeDto) {
    const { email, code } = verifyCodeDto;

    const user = await this.userService.findUser({ email });

    if (user.isEmailVerified) {
      return { message: "User email already verified!", userId: user.id };
    }

    await this.authService.verifyEmailCode(user.id, code);

    await this.userService.updateUser(user.id, { isEmailVerified: true });

    return { message: "User email successfully verified!", userId: user.id };
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(IsAuthed)
  @Post('/verify-phone-number')
  async sendVerificationCodePhone(@Body() verifyPhoneNumberDto: VerifyPhoneNumberDto) {
    const { phoneNumber } = verifyPhoneNumberDto
    const user = await this.userService.findUser({ phoneNumber })
    if (user.isPhoneNumberVerified) {
      return { message: "User phone number already verified" }
    }
    const { message } = await this.authService.verifyPhoneNumber(user.id, phoneNumber)
    return { message, userId: user.id }
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(IsAuthed)
  @Post('/verify-phone-code')
  async verifyPhoneNumberCode(@Body() verifyPhoneNumberCodeDto: VerifyPhoneNumberCodeDto) {
    const { phoneNumber, code } = verifyPhoneNumberCodeDto;

    const user = await this.userService.findUser({ phoneNumber });

    if (user.isPhoneNumberVerified) {
      return { message: "User phone number already verified!" }
    }

    await this.authService.verifyPhoneNumberCode(user.id, code)

    await this.userService.updateUser(user.id, { isPhoneNumberVerified: true });

    return { message: "User phone number successfully verified", userId: user.id };
  }

  @HttpCode(HttpStatus.OK)
  @Post('/forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.userService.findUser({ email });

    const { message } = await this.authService.forgotPassword(user.id, email);

    return { message }
  }

  @HttpCode(HttpStatus.OK)
  @Post('/reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const { email, code, password } = resetPasswordDto;
    const user = await this.userService.findUser({ email });
    const { hashedPassword } = await this.authService.resetPassword(user.id, code, password);
    await this.userService.updateUser(user.id, { password: hashedPassword });

    return { message: 'Password successfully reset', userId: user.id };
  }

  @UseGuards(RefreshTokenGuard)
  @HttpCode(HttpStatus.OK)
  @Post('/rt')
  async refreshToken(@Req() req: Request, @Res() res: Response) {
    const sessionId = req.sessionId;
    const { userId, accessToken, newRefreshToken } = await this.authService.refreshToken(sessionId);

    const accessTokenMaxAge = parseInt(this.configService.get("JWT_EXPIRES_IN"));
    const refreshTokenMaxAge = parseInt(this.configService.get("JWT_REFRESH_TOKEN_EXPIRES_IN"));
    
    res.cookie('accessToken', accessToken, this.generatorService.generateCookieOptions(accessTokenMaxAge));
    res.cookie('refreshToken', newRefreshToken, this.generatorService.generateCookieOptions(refreshTokenMaxAge));

    return res.json({ userId, accessToken });
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
    await this.userService.isNotAdmin(user.id)
    await this.userService.updateUser(user.id, { role: "ADMIN" })
  }
}
