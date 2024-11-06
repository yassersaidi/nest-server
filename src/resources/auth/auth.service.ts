import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { loginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { generateNumericCode } from 'src/utils/generateCode';
import { sendVerificationCode } from 'src/utils/sendEmails';
import { DrizzleAsyncProvider } from '../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as db_schema from '@/resources/database/schema';
import { lt, eq, and, gt } from 'drizzle-orm';
import UAParser from 'ua-parser-js';
import { sendSMS } from '@/utils/sendSMS';

const bcrypt = require('bcryptjs');

type UserType = typeof db_schema.User.$inferSelect

@Injectable()
export class AuthService {
  constructor(
    @Inject(DrizzleAsyncProvider) private db: NodePgDatabase<typeof db_schema>,
    @Inject('UAParser') private readonly uap: UAParser,
    private readonly tokenService: JwtService,
    private readonly configService: ConfigService,
  ) { }


  async login(user: UserType, loginDto: loginDto, ip: string | string[], deviceInfo: string) {

    const isValid = await bcrypt.compare(loginDto.password, user?.password)

    if (!isValid) {
      throw new BadRequestException("Invalid credentials")
    }

    const isAdmin = await this.getAdmin(user)

    const accessToken = this.tokenService.sign(
      { userId: user.id, username: user.username, role: isAdmin ? "admin" : "user" },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN'),
      },
    );

    const refreshToken = this.tokenService.sign(
      { userId: user.id, username: user.username, role: isAdmin ? "admin" : "user" },
      {
        secret: this.configService.get('JWT_REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_TOKEN_EXPIRES_IN'),
      },
    );

    await this.db.insert(db_schema.Session).values({
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      refreshToken,
      deviceInfo,
      ipAddress: ip.toString()
    })

    await this.db.delete(db_schema.Session).where(lt(db_schema.Session.expiresAt, new Date()))

    return {
      accessToken,
      refreshToken,
      userId: user.id
    }
  }

  async logout(refreshToken: string, res: Response) {
    const session = await this.db.select().from(db_schema.Session).where(eq(db_schema.Session.refreshToken, refreshToken)).limit(1);

    if (session.length === 0) {
      throw new UnauthorizedException('Session not found or already logged out');
    }

    await this.db.delete(db_schema.Session).where(eq(db_schema.Session.refreshToken, refreshToken));

    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    return { message: 'Logout successful' };
  }


  async verifyEmail(email: string, user: UserType) {
    const existingCode = await this.db.select().from(db_schema.VerificationCode).where(and(
      eq(db_schema.VerificationCode.type, 'email'),
      eq(db_schema.VerificationCode.userId, user.id),
      gt(db_schema.VerificationCode.expiresAt, new Date())
    ))

    if (existingCode.length > 0) {
      return { message: 'A verification code has already been sent. Please check your email.' };
    }

    const code = generateNumericCode(6);

    const isSent = await sendVerificationCode(email, code, "Your email verification code", "Use this code to confirm your email");

    if (!isSent) {
      throw new BadRequestException("Can't send the verification code, try again!");
    }

    const verificationCode: typeof db_schema.VerificationCode.$inferInsert = {
      userId: user.id,
      type: "email",
      code,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    };

    await this.db.insert(db_schema.VerificationCode).values(verificationCode);

    const now = new Date();
    await this.db.delete(db_schema.VerificationCode).where(lt(db_schema.VerificationCode.expiresAt, now));

    return { message: 'Verification code sent!' };
  }

  async verifyEmailCode(user: UserType, code: string) {

    const existingCode = await this.db.select().from(db_schema.VerificationCode).where(and(
      eq(db_schema.VerificationCode.type, 'email'),
      eq(db_schema.VerificationCode.userId, user.id),
      eq(db_schema.VerificationCode.code, code),
      gt(db_schema.VerificationCode.expiresAt, new Date())
    ))

    if (existingCode.length === 0) {
      throw new BadRequestException('Invalid or expired code.');
    }

    await this.db.delete(db_schema.VerificationCode).where(eq(db_schema.VerificationCode.id, existingCode[0].id))

    return true;
  }

  async verifyPhoneNumber(phoneNumber: string, user: UserType) {
    const existingCode = await this.db.select().from(db_schema.VerificationCode).where(and(
      eq(db_schema.VerificationCode.type, 'phone_number'),
      eq(db_schema.VerificationCode.userId, user.id),
      gt(db_schema.VerificationCode.expiresAt, new Date())
    ))

    if (existingCode.length > 0) {
      return { message: 'A verification code has already been sent. Please check your messages.' };
    }

    const code = generateNumericCode(6);

    const isSent = await sendSMS(phoneNumber, `Your verification code ${code}`);

    if (!isSent) {
      throw new BadRequestException("Can't send the verification code, try again!");
    }

    const verificationCode: typeof db_schema.VerificationCode.$inferInsert = {
      userId: user.id,
      type: "phone_number",
      code,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    };

    await this.db.insert(db_schema.VerificationCode).values(verificationCode);

    const now = new Date();
    await this.db.delete(db_schema.VerificationCode).where(lt(db_schema.VerificationCode.expiresAt, now));

    return { message: 'Verification code sent!' };
  }

  async verifyPhoneNumberCode(user: UserType, code: string) {

    const existingCode = await this.db.select().from(db_schema.VerificationCode).where(and(
      eq(db_schema.VerificationCode.type, 'phone_number'),
      eq(db_schema.VerificationCode.userId, user.id),
      eq(db_schema.VerificationCode.code, code),
      gt(db_schema.VerificationCode.expiresAt, new Date())
    ))

    if (existingCode.length === 0) {
      throw new BadRequestException('Invalid or expired code.');
    }

    await this.db.delete(db_schema.VerificationCode).where(eq(db_schema.VerificationCode.id, existingCode[0].id))

    return true;
  }

  async forgotPassword(user: UserType, email: string) {

    const existingCode = await this.db.select().from(db_schema.VerificationCode).where(and(
      eq(db_schema.VerificationCode.type, 'password_reset'),
      eq(db_schema.VerificationCode.userId, user.id),
      gt(db_schema.VerificationCode.expiresAt, new Date())
    ))

    if (existingCode.length > 0) {
      return { message: 'A reset code has already been sent. Please check your email.' };
    }

    const code = generateNumericCode(6);

    const isSent = await sendVerificationCode(email, code, "Your password verification code", "Use this code to reset your password");

    if (!isSent) {
      throw new BadRequestException('Failed to send the reset code. Please try again.');
    }

    const verificationCode: typeof db_schema.VerificationCode.$inferInsert = {
      userId: user.id,
      type: "password_reset",
      code,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    };

    await this.db.insert(db_schema.VerificationCode).values(verificationCode);

    const now = new Date();
    await this.db.delete(db_schema.VerificationCode).where(lt(db_schema.VerificationCode.expiresAt, now));

    return { message: 'Password reset code sent!' };
  }

  async resetPassword(user: UserType, email: string, code: string, newPassword: string) {

    const existingCode = await this.db.select().from(db_schema.VerificationCode).where(and(
      eq(db_schema.VerificationCode.type, 'password_reset'),
      eq(db_schema.VerificationCode.userId, user.id),
      eq(db_schema.VerificationCode.code, code),
      gt(db_schema.VerificationCode.expiresAt, new Date())
    ))

    if (existingCode.length === 0) {
      throw new BadRequestException('Invalid or expired reset password code.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.PASSWORD_SALT || '13'));
    await this.db.delete(db_schema.VerificationCode).where(eq(db_schema.VerificationCode.id, existingCode[0].id))

    return { hashedPassword };
  }

  async refreshToken(refreshToken: string) {
    const session = await this.db.select().from(db_schema.Session).where(and(
      eq(db_schema.Session.refreshToken, refreshToken),
      lt(db_schema.Session.expiresAt, new Date())
    ))

    if (session.length === 0) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { userId, username, role } = await this.tokenService.verifyAsync(
      refreshToken,
      {
        secret: this.configService.get("JWT_REFRESH_TOKEN_SECRET")
      }
    )

    if (!userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = this.tokenService.sign(
      { userId, username, role },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN'),
      },
    );

    return {
      accessToken,
      userId
    }

  }

  async getAdmin(user: UserType) {
    const admins = await this.db.select().from(db_schema.Admin).where(eq(db_schema.Admin.email, user.email))
    if (admins.length === 0) {
      return false
    }
    return true
  }

  async addAdmin(user: UserType) {
    const isAdmin = await this.db.select().from(db_schema.Admin).where(eq(db_schema.Admin.email, user.email))
    if (isAdmin.length > 0) {
      throw new BadRequestException("This user is already an admin")
    }
    const admin: typeof db_schema.Admin.$inferInsert = {
      email: user.email,
      userId: user.id
    }

    await this.db.insert(db_schema.Admin).values(admin)
  }

  async getUserDeviceInfo(req: Request) { 
    const userAgent = this.uap.setUA(req.headers["user-agent"]).getResult()
    const ipAddress = req.ip || req.headers['x-forwarded-for']
    const deviceInfo = `${userAgent.browser.name}${userAgent.browser.version} - ${userAgent.device.model} - ${userAgent.os.name}`
    return {
      deviceInfo,
      ipAddress
    };  
  }
}
