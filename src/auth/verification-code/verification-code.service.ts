import { EmailService } from '@/common/emails/email.service';
import { DefaultHttpException } from '@/common/errors/error/custom-error.error';
import { GeneratorService } from '@/common/generators/generator.service';
import { SMSService } from '@/common/sms/sms.service';
import { DrizzleAsyncProvider } from '@/database/database.module';
import * as db_schema from '@/database/schema';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gt, lt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { VerificationCodeType } from './enums/code-type.enum';

@Injectable()
export class VerificationCodeService {
  private readonly logger = new Logger(VerificationCodeService.name);

  constructor(
    @Inject(DrizzleAsyncProvider) private db: NodePgDatabase<typeof db_schema>,
    private readonly generatorService: GeneratorService,
    private readonly emailService: EmailService,
    private readonly smsService: SMSService,
  ) {}

  async sendEmailVerificationCode(userId: string, email: string) {
    this.logger.log(`User ${userId} requested email verification`);
    await this.checkExistingCode(userId, VerificationCodeType.email);

    const code = this.generatorService.generateNumericCode(6);
    const html = `<h1> Use this code to confirm your email:</h1><strong>${code}</strong>`;
    const isSent = await this.emailService.sendEmail({
      email,
      subject: 'Your verification code',
      html,
    });

    if (!isSent) {
      this.logger.error(`Failed to send email verification code to ${email}`);
      throw new DefaultHttpException(
        'Unable to send verification code.',
        'Please ensure your email address is correct and try again.',
        'Email Verification Service',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.storeVerificationCode(userId, VerificationCodeType.email, code);
    await this.cleanupExpiredCodes();

    this.logger.log(`Email verification code sent successfully to ${email}`);
    return { message: 'Verification code sent!' };
  }

  async verifyEmailCode(userId: string, code: string) {
    this.logger.log(`User ${userId} is verifying email code`);
    await this.validateCode(userId, VerificationCodeType.email, code);
    this.logger.log(`User ${userId} successfully verified email code`);
  }

  async sendPhoneVerificationCode(userId: string, phoneNumber: string) {
    this.logger.log(`User ${userId} requested phone verification`);
    await this.checkExistingCode(userId, VerificationCodeType.phone_number);

    const code = this.generatorService.generateNumericCode(6);
    const isSent = await this.smsService.send({
      phoneNumber,
      message: `Your verification code ${code}`,
    });

    if (!isSent) {
      this.logger.error(
        `Failed to send phone verification code to ${phoneNumber}`,
      );
      throw new DefaultHttpException(
        'Unable to send the verification code.',
        'Please check your phone number and try again.',
        'Phone Verification Service',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.storeVerificationCode(
      userId,
      VerificationCodeType.phone_number,
      code,
    );
    await this.cleanupExpiredCodes();

    this.logger.log(
      `Phone verification code sent successfully to ${phoneNumber}`,
    );
    return { message: 'Verification code sent!' };
  }

  async verifyPhoneCode(userId: string, code: string) {
    this.logger.log(`User ${userId} is verifying phone code`);
    await this.validateCode(userId, VerificationCodeType.phone_number, code);
    this.logger.log(`User ${userId} successfully verified phone code`);
  }

  async sendPasswordResetCode(userId: string, email: string) {
    this.logger.log(`User ${userId} requested password reset`);
    await this.checkExistingCode(userId, VerificationCodeType.password_reset);

    const code = this.generatorService.generateNumericCode(6);
    const html = `<h1>Use this code to reset your password:</h1><strong>${code}</strong>`;
    const isSent = await this.emailService.sendEmail({
      email,
      subject: 'Your password reset code',
      html,
    });

    if (!isSent) {
      this.logger.error(`Failed to send password reset code to ${email}`);
      throw new DefaultHttpException(
        'Unable to send reset code.',
        'Please check your email address and try again.',
        'Reset Password Service',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.storeVerificationCode(
      userId,
      VerificationCodeType.password_reset,
      code,
    );
    await this.cleanupExpiredCodes();

    this.logger.log(`Password reset code sent successfully to ${email}`);
    return { message: 'Password reset code sent!' };
  }

  async verifyPasswordResetCode(userId: string, code: string) {
    this.logger.log(`User ${userId} is verifying password reset code`);
    await this.validateCode(userId, VerificationCodeType.password_reset, code);
    this.logger.log(`User ${userId} successfully verified password reset code`);
  }

  async checkExistingCode(userId: string, type: VerificationCodeType) {
    this.logger.log(
      `Checking for existing code for user ${userId} of type ${type}`,
    );
    const existingCode = await this.db
      .select()
      .from(db_schema.VerificationCode)
      .where(
        and(
          eq(db_schema.VerificationCode.type, type),
          eq(db_schema.VerificationCode.userId, userId),
          gt(db_schema.VerificationCode.expiresAt, new Date()),
        ),
      );

    if (existingCode.length > 0) {
      this.logger.warn(
        `A code for user ${userId} of type ${type} already exists`,
      );
      const updatedType = type.charAt(0).toUpperCase() + type.slice(1);
      throw new DefaultHttpException(
        `A code has already been sent.`,
        'Please check your email or phone.',
        `${updatedType} Verification Service`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async storeVerificationCode(
    userId: string,
    type: VerificationCodeType,
    code: string,
  ) {
    this.logger.log(
      `Storing verification code for user ${userId} of type ${type}`,
    );
    const verificationCode: typeof db_schema.VerificationCode.$inferInsert = {
      userId,
      type,
      code,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
    await this.db.insert(db_schema.VerificationCode).values(verificationCode);
  }

  async validateCode(userId: string, type: VerificationCodeType, code: string) {
    this.logger.log(
      `Validating verification code for user ${userId} of type ${type}`,
    );
    const existingCode = await this.db
      .select()
      .from(db_schema.VerificationCode)
      .where(
        and(
          eq(db_schema.VerificationCode.type, type),
          eq(db_schema.VerificationCode.userId, userId),
          eq(db_schema.VerificationCode.code, code),
          gt(db_schema.VerificationCode.expiresAt, new Date()),
        ),
      );

    if (existingCode.length === 0) {
      this.logger.error(
        `Invalid or expired verification code for user ${userId} of type ${type}`,
      );
      const updatedType = type.charAt(0).toUpperCase() + type.slice(1);

      throw new DefaultHttpException(
        'Invalid or expired code.',
        `Please request a new ${updatedType} code.`,
        `${updatedType} Verification Service`,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.db
      .delete(db_schema.VerificationCode)
      .where(eq(db_schema.VerificationCode.id, existingCode[0].id));
  }

  async cleanupExpiredCodes() {
    this.logger.log('Cleaning up expired verification codes');
    const now = new Date();
    await this.db
      .delete(db_schema.VerificationCode)
      .where(lt(db_schema.VerificationCode.expiresAt, now));
  }
}
