import { EmailService } from '@/resources/common/emails/email.service';
import { EmailServiceMock } from '@/resources/common/emails/mocks/email.service.mock';
import { DefaultHttpException } from '@/resources/common/errors/error/custom-error.error';
import { GeneratorService } from '@/resources/common/generators/generator.service';
import { GeneratorServiceMock } from '@/resources/common/generators/mocks/generator.mock';
import { SMSServiceMock } from '@/resources/common/sms/mocks/sms.service.mock';
import { SMSService } from '@/resources/common/sms/sms.service';
import { DrizzleAsyncProvider } from '@/resources/database/database.module';
import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { VerificationCodeService } from './verification-code.service';

describe('VerificationCodeService', () => {
  let service: VerificationCodeService;
  let dbQueryResult: any[] = [];

  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      return dbQueryResult;
    }),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockImplementation(() => Promise.resolve()),
    delete: vi.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationCodeService,
        { provide: DrizzleAsyncProvider, useValue: mockDb },
        { provide: EmailService, useValue: EmailServiceMock },
        { provide: SMSService, useValue: SMSServiceMock },
        { provide: GeneratorService, useValue: GeneratorServiceMock },
      ],
    }).compile();

    service = module.get<VerificationCodeService>(VerificationCodeService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    dbQueryResult = [];
    GeneratorServiceMock.generateNumericCode.mockReturnValue('123456');
  });

  it('VerificationCode Service Should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmailVerificationCode', () => {
    const email = 'test@example.com';
    const userId = 'user123';

    it('Should send email verification code successfully', async () => {
      dbQueryResult = [];
      EmailServiceMock.sendEmail.mockResolvedValueOnce(true);

      const result = await service.sendEmailVerificationCode(userId, email);

      expect(result.message).toBe('Verification code sent!');
      expect(EmailServiceMock.sendEmail).toHaveBeenCalledWith({
        email,
        subject: 'Your verification code',
        html: expect.stringContaining('123456'),
      });
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('Should throw error if email sending fails', async () => {
      dbQueryResult = [];
      EmailServiceMock.sendEmail.mockResolvedValueOnce(false);

      await expect(
        service.sendEmailVerificationCode(userId, email),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Unable to send verification code.',
          'Please ensure your email address is correct and try again.',
          'Email Verification Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should throw error if code already exists', async () => {
      dbQueryResult = [{ id: 1 }];

      await expect(
        service.sendEmailVerificationCode(userId, email),
      ).rejects.toThrow(
        new DefaultHttpException(
          'A code has already been sent.',
          'Please check your email or phone.',
          'email Verification Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('sendPhoneVerificationCode', () => {
    const phoneNumber = '+2135454545';
    const userId = 'user123';

    it('Should send phone verification code successfully', async () => {
      dbQueryResult = [];
      SMSServiceMock.send.mockResolvedValueOnce(true);

      const result = await service.sendPhoneVerificationCode(
        userId,
        phoneNumber,
      );

      expect(result.message).toBe('Verification code sent!');
      expect(SMSServiceMock.send).toHaveBeenCalledWith({
        phoneNumber,
        message: expect.stringContaining('123456'),
      });
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('Should throw error if SMS sending fails', async () => {
      dbQueryResult = [];
      SMSServiceMock.send.mockResolvedValueOnce(false);

      await expect(
        service.sendPhoneVerificationCode(userId, phoneNumber),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Unable to send the verification code.',
          'Please check your phone number and try again.',
          'Phone Verification Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('verifyCode', () => {
    const userId = 'user123';
    const code = '123456';

    it('Should verify email code successfully', async () => {
      dbQueryResult = [{ id: 1 }];

      await service.verifyEmailCode(userId, code);

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('Should verify phone code successfully', async () => {
      dbQueryResult = [{ id: 1 }];

      await service.verifyPhoneCode(userId, code);

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('Should throw error for invalid email code', async () => {
      dbQueryResult = [];

      await expect(service.verifyEmailCode(userId, code)).rejects.toThrow(
        new DefaultHttpException(
          'Invalid or expired code.',
          'Please request a new email code.',
          'email Verification Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('sendPasswordResetCode', () => {
    const email = 'test@example.com';
    const userId = 'user123';
    const code = '123456';

    it('Should send password reset code successfully', async () => {
      dbQueryResult = [];
      EmailServiceMock.sendEmail.mockResolvedValueOnce(true);

      const result = await service.sendPasswordResetCode(userId, email);

      expect(result.message).toBe('Password reset code sent!');
      expect(EmailServiceMock.sendEmail).toHaveBeenCalledWith({
        email,
        subject: 'Your password reset code',
        html: expect.stringContaining('123456'),
      });
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('Should throw error if password reset code not sent', async () => {
      EmailServiceMock.sendEmail.mockResolvedValueOnce(false);

      await expect(
        service.sendPasswordResetCode(userId, email),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Unable to send reset code.',
          'Please check your email address and try again.',
          'Reset Password Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should verify password reset code successfully', async () => {
      dbQueryResult = [{ id: 1 }];

      await service.verifyPasswordResetCode(userId, code);

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('Should throw error for invalid password reset code', async () => {
      dbQueryResult = [];

      await expect(
        service.verifyPasswordResetCode(userId, code),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Invalid or expired code.',
          'Please request a new password_reset code.',
          'password_reset Verification Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('cleanup', () => {
    it('Should cleanup expired codes', async () => {
      await service.cleanupExpiredCodes();

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
