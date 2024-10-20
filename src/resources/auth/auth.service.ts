import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { loginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Session } from '../users/entities/session.entity';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerificationCode } from '../users/entities/verification.code.entity';
import { generateNumericCode } from 'src/utils/generateCode';
import { sendVerificationCode } from 'src/utils/sendEmails';
import { UsersService } from '../users/users.service';

const bcrypt = require('bcryptjs');

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Session) private readonly session: Repository<Session>,
    @InjectRepository(VerificationCode) private readonly verificationCode: Repository<VerificationCode>,
    private readonly tokenService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
    
  ) { }


  async login(user: User, loginDto: loginDto) {

    const isValid = await bcrypt.compare(loginDto.password, user?.password)

    if (!isValid) {
      throw new BadRequestException("Invalid credentials")
    }

    const accessToken = this.tokenService.sign(
      { userId: user.id },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN'),
      },
    );

    const refreshToken = this.tokenService.sign(
      { userId: user.id },
      {
        secret: this.configService.get('JWT_REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_TOKEN_EXPIRES_IN'),
      },
    );

    const sessionData = this.session.create({
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await this.session.save(sessionData);

    return {
      accessToken,
      refreshToken,
      userId: user.id
    }
  }

  async logout(refreshToken: string, res: Response) {

    const session = await this.session.findOne({ where: { refreshToken } });

    if (!session) {
      throw new UnauthorizedException('Session not found or already logged out');
    }

    await this.session.delete({ refreshToken });

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

    return { message: 'Logout successful' };
  }


  async verifyEmail(email: string, userId: string) {

    const existingCode = await this.verificationCode.findOne({
      where: {
        userId: userId,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (existingCode) {
      return { message: 'A verification code has already been sent. Please check your email.' };
    }
    const code = generateNumericCode(6);

    const isSent = await sendVerificationCode(this.configService.get("RESEND_API_KEY"), email, code, "Your email verification code", "Use this code to confirm your email");

    if (!isSent) {
      throw new BadRequestException("Can't send the verification code, try again!");
    }

    const verificationCode = this.verificationCode.create({
      userId: userId,
      code,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });

    await this.verificationCode.save(verificationCode);

    return { message: 'Verification code sent!' };

  }

  async verifyCode(userId: string, code: string) {

    const userVerificationCode = await this.verificationCode.findOne({
      where: {
        userId: userId,
        code: code,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!userVerificationCode) {
      return false;
    }

    await this.verificationCode.delete({ id: userVerificationCode.id });

    return true;
  }

  async resetPassword(userId: string, email: string, code: string, newPassword: string) {

    const resetCode = await this.verificationCode.findOne({
      where: {
        userId: userId,
        code: code,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!resetCode) {
      throw new BadRequestException('Invalid or expired reset code.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.PASSWORD_SALT || '13'));
    await this.verificationCode.delete({ id: resetCode.id });


    return { hashedPassword };
  }


  async forgotPassword(userId: string, email: string) {

    const existingResetCode = await this.verificationCode.findOne({
      where: {
        userId: userId,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (existingResetCode) {
      return { message: 'A verification code has already been sent. Please check your email.' };
    }

    const resetCode = generateNumericCode(6);

    const isSent = await sendVerificationCode(this.configService.get("RESEND_API_KEY"), email, resetCode, "Your password verification code", "Use this code to reset your password");
    if (!isSent) {
      throw new BadRequestException('Failed to send the reset code. Please try again.');
    }

    const verificationCode = this.verificationCode.create({
      userId,
      code: resetCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    await this.verificationCode.save(verificationCode);

    return { message: 'Password reset code sent!' };
  }

  async refreshToken(refreshToken: string) {
    const session = await this.session.findOne({ where: { refreshToken } });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { userId } = await this.tokenService.verifyAsync(
      refreshToken,
      {
        secret: this.configService.get("JWT_REFRESH_TOKEN_SECRET")
      }
    )

    if (!userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    
    const user = await this.userService.findById(userId)

    if(!user){
      throw new BadRequestException('Invalid refresh token');
    }

    const accessToken = this.tokenService.sign(
      { userId: user.id },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN'),
      },
    );

    return {
      accessToken,
      userId: user.id
    }

  }

}
