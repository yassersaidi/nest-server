import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import UAParser from 'ua-parser-js';
import { PROVIDERS } from '@/common/constants';
import { UserRoles } from '@/common/enums/user-roles.enum';
import { DefaultHttpException } from '@/common/errors/error/custom-error.error';
import { loginDto } from './dto/login.dto';
import { LoginUserType } from './interfaces/login-user.interface';
import { SessionService } from './sessions/session.service';
import { VerificationCodeService } from './verification-code/verification-code.service';

import bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PROVIDERS.USER_AGENT_PARSER) private readonly uap: UAParser,
    private readonly sessionService: SessionService,
    private readonly verificationCodeService: VerificationCodeService,
  ) {}

  async login(
    user: LoginUserType,
    loginDto: loginDto,
    ip: string | string[],
    deviceInfo: string,
  ) {
    this.logger.log('Attempting to login user with email: ' + loginDto.email);

    const isValid = await bcrypt.compare(loginDto.password, user?.password);

    if (!isValid) {
      this.logger.warn(
        `Invalid login attempt for user with email: ${loginDto.email}`,
      );
      throw new DefaultHttpException(
        'Invalid credentials',
        'Enter valid email or password',
        'Login Service',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(`User ${user.id} logged in successfully.`);

    const sessionId = await this.sessionService.createSession(
      user.id,
      ip.toString(),
      deviceInfo,
    );

    const newAccessToken = this.sessionService.generateAccessToken({
      id: user.id,
      role: user.role as UserRoles,
      username: user.username,
      sessionId,
    });

    const newRefreshToken = this.sessionService.generateRefreshToken(sessionId);
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      userId: user.id,
    };
  }

  async logout(sessionId: string) {
    this.logger.log('Attempting to log out user with session id: ' + sessionId);
    const session = await this.sessionService.findSessionById(sessionId);
    if (!session) {
      this.logger.warn(`No session found for id: ${sessionId}`);
      throw new DefaultHttpException(
        'Session not found or already logged out',
        'Ensure you are logged in before attempting to log out.',
        'Logout',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.sessionService.deleteSessionById(sessionId);
    this.logger.log(`User with id ${session.userId} logged out successfully`);
    return { message: 'Logout successful' };
  }

  async verifyEmail(userId: string, email: string) {
    this.logger.log(
      `Sending email verification code to user ${userId} at email: ${email}`,
    );
    return this.verificationCodeService.sendEmailVerificationCode(
      userId,
      email,
    );
  }

  async verifyEmailCode(userId: string, code: string) {
    this.logger.log(`Verifying email code for user ${userId}`);
    return this.verificationCodeService.verifyEmailCode(userId, code);
  }

  async verifyPhoneNumber(userId: string, phoneNumber: string) {
    this.logger.log(
      `Sending phone verification code to user ${userId} at phone number: ${phoneNumber}`,
    );
    return this.verificationCodeService.sendPhoneVerificationCode(
      userId,
      phoneNumber,
    );
  }

  async verifyPhoneNumberCode(userId: string, code: string) {
    this.logger.log(`Verifying phone code for user ${userId}`);
    return this.verificationCodeService.verifyPhoneCode(userId, code);
  }

  async forgotPassword(userId: string, email: string) {
    this.logger.log(
      `Sending password reset code to user ${userId} at email: ${email}`,
    );
    return this.verificationCodeService.sendPasswordResetCode(userId, email);
  }

  async resetPassword(userId: string, code: string, newPassword: string) {
    this.logger.log(`Resetting password for user ${userId}`);
    await this.verificationCodeService.verifyPasswordResetCode(userId, code);

    const hashedPassword = await bcrypt.hash(
      newPassword,
      parseInt(process.env.PASSWORD_SALT || '13'),
    );
    return { hashedPassword };
  }

  async refreshToken(sessionId: string) {
    this.logger.log(`Refreshing token for session id: ${sessionId}`);
    return this.sessionService.refreshToken(sessionId);
  }

  async getUserDeviceInfo(req: Request) {
    const userAgent = this.uap.setUA(req.headers['user-agent']).getResult();
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const deviceInfo = `${userAgent.browser.name}${userAgent.browser.version} - ${userAgent.device.model} - ${userAgent.os.name}`;
    return {
      deviceInfo,
      ipAddress,
    };
  }

  async getSessions(userId: string) {
    this.logger.log(`Fetching sessions for user ${userId}`);
    return this.sessionService.getSessions(userId);
  }
}
